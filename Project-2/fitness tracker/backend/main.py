
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional

# --- Config ---
SECRET_KEY = "fitness-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# --- DB ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./fitness.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)

class Meal(Base):
    __tablename__ = "meals"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    calories = Column(Integer)
    protein = Column(Integer, default=0)
    date = Column(String)  # YYYY-MM-DD

class Workout(Base):
    __tablename__ = "workouts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    calories_burned = Column(Integer)
    duration = Column(Integer, default=0)  # minutes
    date = Column(String)

Base.metadata.create_all(bind=engine)

# --- App ---
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Schemas ---
class RegisterIn(BaseModel):
    username: str
    password: str

class MealIn(BaseModel):
    name: str
    calories: int
    protein: int = 0
    date: str

class WorkoutIn(BaseModel):
    name: str
    calories_burned: int
    duration: int = 0
    date: str

# --- Auth ---
@app.post("/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(username=data.username, password=pwd_context.hash(data.password))
    db.add(user)
    db.commit()
    return {"message": "Registered successfully"}

@app.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not pwd_context.verify(form.password, user.password):
        raise HTTPException(status_code=401, detail="Wrong username or password")
    token = create_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer"}

# --- Meals ---
@app.post("/meals")
def add_meal(data: MealIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = Meal(user_id=user.id, name=data.name, calories=data.calories, protein=data.protein, date=data.date)
    db.add(m); db.commit(); db.refresh(m)
    return m

@app.get("/meals")
def list_meals(date: Optional[str] = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Meal).filter(Meal.user_id == user.id)
    if date:
        q = q.filter(Meal.date == date)
    return q.all()

@app.delete("/meals/{meal_id}")
def delete_meal(meal_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = db.query(Meal).filter(Meal.id == meal_id, Meal.user_id == user.id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(m); db.commit()
    return {"message": "Deleted"}

# --- Workouts ---
@app.post("/workouts")
def add_workout(data: WorkoutIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    w = Workout(user_id=user.id, name=data.name, calories_burned=data.calories_burned, duration=data.duration, date=data.date)
    db.add(w); db.commit(); db.refresh(w)
    return w

@app.get("/workouts")
def list_workouts(date: Optional[str] = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = db.query(Workout).filter(Workout.user_id == user.id)
    if date:
        q = q.filter(Workout.date == date)
    return q.all()

@app.delete("/workouts/{workout_id}")
def delete_workout(workout_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    w = db.query(Workout).filter(Workout.id == workout_id, Workout.user_id == user.id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")
    db.delete(w); db.commit()
    return {"message": "Deleted"}

# --- Summary ---
@app.get("/summary/daily")
def daily_summary(date: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meals = db.query(Meal).filter(Meal.user_id == user.id, Meal.date == date).all()
    workouts = db.query(Workout).filter(Workout.user_id == user.id, Workout.date == date).all()
    eaten = sum(m.calories for m in meals)
    burned = sum(w.calories_burned for w in workouts)
    protein = sum(m.protein for m in meals)
    return {
        "date": date,
        "calories_eaten": eaten,
        "calories_burned": burned,
        "net_calories": eaten - burned,
        "protein": protein,
        "meals_count": len(meals),
        "workouts_count": len(workouts)
    }

@app.get("/")
def root():
    return {"message": "Fitness Tracker API running"}
