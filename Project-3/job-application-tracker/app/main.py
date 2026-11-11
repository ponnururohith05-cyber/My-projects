import logging
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import JobApplication
from app.schemas import (
    ApplicationCreate,
    ApplicationPage,
    ApplicationRead,
    ApplicationStatus,
    ApplicationUpdate,
    MonthlyCount,
    StatusCount,
    TimeSeriesRead,
)

logger = logging.getLogger(__name__)
app = FastAPI(title="Job Application Tracker API", version="1.0.0")
DbSession = Annotated[Session, Depends(get_db)]
STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", include_in_schema=False)
def dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/analytics", include_in_schema=False)
def analytics_dashboard() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/database")
def database_health_check(db: DbSession) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        logger.exception("Could not connect to PostgreSQL")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed. Check your .env settings and ensure PostgreSQL is running.",
        ) from error
    return {"status": "connected"}


@app.post(
    "/applications",
    response_model=ApplicationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_application(payload: ApplicationCreate, db: DbSession) -> JobApplication:
    application = JobApplication(
        user_id=payload.user_id,
        company=payload.company,
        role=payload.role,
        status=payload.status.value,
        notes=payload.notes,
    )
    db.add(application)
    try:
        db.commit()
        db.refresh(application)
    except IntegrityError as error:
        db.rollback()
        logger.exception("Could not create job application")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not create the application. Ensure the user exists and the data is valid.",
        ) from error
    return application


@app.get("/applications", response_model=ApplicationPage)
def list_applications(
    db: DbSession,
    user_id: Annotated[int, Query(gt=0)],
    company: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    role: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    application_status: Annotated[
        ApplicationStatus | None, Query(alias="status")
    ] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> ApplicationPage:
    filters = [JobApplication.user_id == user_id]
    if company and company.strip():
        filters.append(JobApplication.company.ilike(f"%{company.strip()}%"))
    if role and role.strip():
        filters.append(JobApplication.role.ilike(f"%{role.strip()}%"))
    if application_status:
        filters.append(JobApplication.status == application_status.value)

    total = db.scalar(
        select(func.count()).select_from(JobApplication).where(*filters)
    ) or 0
    applications = db.scalars(
        select(JobApplication)
        .where(*filters)
        .order_by(JobApplication.created_at.desc(), JobApplication.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return ApplicationPage(
        items=applications,
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@app.get("/applications/{application_id}", response_model=ApplicationRead)
def get_application(
    application_id: int, user_id: Annotated[int, Query(gt=0)], db: DbSession
) -> JobApplication:
    application = db.scalar(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == user_id,
        )
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    return application


@app.patch("/applications/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: int,
    payload: ApplicationUpdate,
    user_id: Annotated[int, Query(gt=0)],
    db: DbSession,
) -> JobApplication:
    application = db.scalar(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == user_id,
        )
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        if isinstance(value, ApplicationStatus):
            value = value.value
        setattr(application, field, value)
    try:
        db.commit()
        db.refresh(application)
    except IntegrityError as error:
        db.rollback()
        logger.exception("Could not update job application %s", application_id)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not update the application. Check the submitted data.",
        ) from error
    return application


@app.delete(
    "/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_application(
    application_id: int,
    user_id: Annotated[int, Query(gt=0)],
    db: DbSession,
) -> Response:
    application = db.scalar(
        select(JobApplication).where(
            JobApplication.id == application_id,
            JobApplication.user_id == user_id,
        )
    )
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")
    db.delete(application)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/analytics/status", response_model=list[StatusCount])
def status_analytics(
    user_id: Annotated[int, Query(gt=0)], db: DbSession
) -> list[StatusCount]:
    counts = dict(
        db.execute(
            select(JobApplication.status, func.count(JobApplication.id))
            .where(JobApplication.user_id == user_id)
            .group_by(JobApplication.status)
        ).all()
    )
    return [
        StatusCount(
            status=application_status,
            count=counts.get(application_status.value, 0),
        )
        for application_status in ApplicationStatus
    ]


@app.get("/analytics/time-series", response_model=TimeSeriesRead)
def time_series_analytics(
    user_id: Annotated[int, Query(gt=0)],
    db: DbSession,
    months: Annotated[int, Query(ge=1, le=60)] = 12,
) -> TimeSeriesRead:
    now = datetime.now(UTC)
    month_index = now.year * 12 + now.month - 1
    first_month_index = month_index - months + 1
    start = datetime(
        first_month_index // 12,
        first_month_index % 12 + 1,
        1,
        tzinfo=UTC,
    )

    if db.bind is not None and db.bind.dialect.name == "sqlite":
        month_expression = func.strftime("%Y-%m", JobApplication.created_at)
    else:
        month_expression = func.to_char(
            func.date_trunc("month", JobApplication.created_at), "YYYY-MM"
        )
    rows = db.execute(
        select(month_expression, func.count(JobApplication.id))
        .where(
            JobApplication.user_id == user_id,
            JobApplication.created_at >= start,
        )
        .group_by(month_expression)
    ).all()
    counts = defaultdict(int, {month: count for month, count in rows})
    items = [
        MonthlyCount(
            month=f"{year:04d}-{month:02d}",
            count=counts[f"{year:04d}-{month:02d}"],
        )
        for index in range(first_month_index, month_index + 1)
        for year, month in [(index // 12, index % 12 + 1)]
    ]
    return TimeSeriesRead(user_id=user_id, months=months, items=items)
