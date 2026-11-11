const STATUS_OPTIONS = ["Applied", "Interview", "Offer", "Rejected"];
const PAGE_SIZE = 8;
const userIdInput = document.querySelector("#user-id");
const rowsElement = document.querySelector("#application-rows");
const dialog = document.querySelector("#application-dialog");
const applicationForm = document.querySelector("#application-form");
const toast = document.querySelector("#toast");
let currentPage = 1;
let totalPages = 0;
let editApplicationId = null;
let filterTimer;
let toastTimer;

const savedUserId = localStorage.getItem("careerlog-user-id");
if (savedUserId && Number.isInteger(Number(savedUserId)) && Number(savedUserId) > 0) {
  userIdInput.value = savedUserId;
}

function currentUserId() {
  const userId = Number(userIdInput.value);
  if (!Number.isInteger(userId) || userId < 1) {
    throw new Error("Enter a valid existing user ID to load your applications.");
  }
  return userId;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((issue) => issue.msg).join(" ");
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
    throw new Error(detail);
  }
  return response.status === 204 ? null : response.json();
}

function showToast(message, isError = false) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
}

function setLoading(message) {
  rowsElement.replaceChildren();
  const cell = document.createElement("td");
  cell.className = "table-message";
  cell.colSpan = 5;
  cell.textContent = message;
  const row = document.createElement("tr");
  row.append(cell);
  rowsElement.append(row);
}

function appendTextCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
}

function renderApplication(application) {
  const row = document.createElement("tr");
  const companyCell = document.createElement("td");
  const companyWrap = document.createElement("div");
  companyWrap.className = "company-cell";
  const mark = document.createElement("span");
  mark.className = "company-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = application.company.trim().slice(0, 1) || "?";
  const companyName = document.createElement("span");
  companyName.textContent = application.company;
  companyWrap.append(mark, companyName);
  companyCell.append(companyWrap);
  row.append(companyCell);
  appendTextCell(row, application.role);

  const statusCell = document.createElement("td");
  const badge = document.createElement("span");
  badge.className = `status-badge status-${application.status.toLowerCase()}`;
  badge.textContent = application.status;
  statusCell.append(badge);
  row.append(statusCell);

  const date = new Date(application.created_at);
  appendTextCell(row, Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date));

  const actionsCell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "row-actions";
  const editButton = document.createElement("button");
  editButton.className = "row-action";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-label", `Edit ${application.company} application`);
  editButton.addEventListener("click", () => openEditDialog(application));
  const deleteButton = document.createElement("button");
  deleteButton.className = "row-action delete";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete ${application.company} application`);
  deleteButton.addEventListener("click", () => deleteApplication(application));
  actions.append(editButton, deleteButton);
  actionsCell.append(actions);
  row.append(actionsCell);
  return row;
}

async function loadApplications() {
  setLoading("Loading applications…");
  try {
    const params = new URLSearchParams({
      user_id: String(currentUserId()),
      page: String(currentPage),
      page_size: String(PAGE_SIZE),
    });
    const company = document.querySelector("#filter-company").value.trim();
    const role = document.querySelector("#filter-role").value.trim();
    const applicationStatus = document.querySelector("#filter-status").value;
    if (company) params.set("company", company);
    if (role) params.set("role", role);
    if (applicationStatus) params.set("status", applicationStatus);

    const result = await request(`/applications?${params}`);
    rowsElement.replaceChildren();
    if (result.items.length) {
      result.items.forEach((application) => rowsElement.append(renderApplication(application)));
    } else {
      setLoading("No applications match these filters. Add an application to get started.");
    }
    totalPages = result.pages;
    document.querySelector("#result-count").textContent = `${result.total} ${result.total === 1 ? "application" : "applications"}`;
    document.querySelector("#page-summary").textContent = result.total
      ? `Page ${result.page} of ${result.pages}`
      : "No results";
    document.querySelector("#previous-page").disabled = currentPage <= 1;
    document.querySelector("#next-page").disabled = currentPage >= totalPages;
    document.querySelector("#total-count").textContent = result.total;
  } catch (error) {
    setLoading(error.message);
    document.querySelector("#result-count").textContent = "Unavailable";
    document.querySelector("#page-summary").textContent = "—";
    document.querySelector("#total-count").textContent = "—";
    document.querySelector("#previous-page").disabled = true;
    document.querySelector("#next-page").disabled = true;
    showToast(error.message, true);
  }
}

async function loadSummary() {
  try {
    const query = new URLSearchParams({ user_id: String(currentUserId()) });
    const statuses = await request(`/analytics/status?${query}`);
    const counts = Object.fromEntries(statuses.map((item) => [item.status, item.count]));
    document.querySelector("#interview-count").textContent = counts.Interview ?? 0;
    document.querySelector("#offer-count").textContent = counts.Offer ?? 0;
    renderStatusChart(statuses);
  } catch (error) {
    document.querySelector("#interview-count").textContent = "—";
    document.querySelector("#offer-count").textContent = "—";
    renderChartMessage("#status-chart", error.message);
  }
}

function renderChartMessage(selector, message) {
  const container = document.querySelector(selector);
  container.replaceChildren();
  const text = document.createElement("p");
  text.className = "chart-loading";
  text.textContent = message;
  container.append(text);
}

function renderStatusChart(statuses) {
  const container = document.querySelector("#status-chart");
  container.replaceChildren();
  const maximum = Math.max(1, ...statuses.map((item) => item.count));
  statuses.forEach((item) => {
    const row = document.createElement("div");
    row.className = "status-row";
    const label = document.createElement("span");
    label.className = "status-label";
    label.textContent = item.status;
    const track = document.createElement("div");
    track.className = "status-track";
    track.setAttribute("role", "meter");
    track.setAttribute("aria-label", `${item.status}: ${item.count}`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", String(maximum));
    track.setAttribute("aria-valuenow", String(item.count));
    const fill = document.createElement("div");
    fill.className = `status-fill ${item.status.toLowerCase()}`;
    fill.style.width = `${item.count ? Math.max(5, (item.count / maximum) * 100) : 0}%`;
    track.append(fill);
    const value = document.createElement("strong");
    value.className = "status-value";
    value.textContent = String(item.count);
    row.append(label, track, value);
    container.append(row);
  });
}

async function loadTimeline() {
  const months = Number(document.querySelector("#analytics-months").value);
  try {
    const query = new URLSearchParams({ user_id: String(currentUserId()), months: String(months) });
    const result = await request(`/analytics/time-series?${query}`);
    renderTimeline(result.items, months);
  } catch (error) {
    renderChartMessage("#timeline-chart", error.message);
  }
}

function renderTimeline(items, months) {
  const container = document.querySelector("#timeline-chart");
  container.replaceChildren();
  const visibleItems = items.slice(-Math.min(months, 12));
  const maximum = Math.max(1, ...visibleItems.map((item) => item.count));
  visibleItems.forEach((item) => {
    const column = document.createElement("div");
    column.className = "month-column";
    const value = document.createElement("span");
    value.className = "month-value";
    value.textContent = String(item.count);
    const track = document.createElement("div");
    track.className = "month-track";
    const bar = document.createElement("div");
    bar.className = "month-bar";
    bar.style.height = item.count ? `${Math.max(7, (item.count / maximum) * 100)}%` : "3px";
    bar.setAttribute("aria-label", `${item.month}: ${item.count} applications`);
    track.append(bar);
    const date = new Date(`${item.month}-01T00:00:00`);
    const label = document.createElement("span");
    label.className = "month-label";
    label.textContent = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
    column.append(value, track, label);
    container.append(column);
  });
}

function refreshData() {
  loadApplications();
  loadSummary();
  loadTimeline();
}

function openCreateDialog() {
  editApplicationId = null;
  applicationForm.reset();
  document.querySelector("#dialog-title").textContent = "Add application";
  document.querySelector("#save-application").textContent = "Save application";
  dialog.showModal();
  document.querySelector("#company").focus();
}

function openEditDialog(application) {
  editApplicationId = application.id;
  document.querySelector("#dialog-title").textContent = "Edit application";
  document.querySelector("#save-application").textContent = "Save changes";
  document.querySelector("#company").value = application.company;
  document.querySelector("#role").value = application.role;
  document.querySelector("#status").value = application.status;
  document.querySelector("#notes").value = application.notes ?? "";
  dialog.showModal();
  document.querySelector("#company").focus();
}

async function deleteApplication(application) {
  if (!window.confirm(`Delete the ${application.company} application? This cannot be undone.`)) return;
  try {
    const query = new URLSearchParams({ user_id: String(currentUserId()) });
    await request(`/applications/${application.id}?${query}`, { method: "DELETE" });
    showToast("Application deleted.");
    if (currentPage > 1 && rowsElement.children.length === 1) currentPage -= 1;
    refreshData();
  } catch (error) {
    showToast(error.message, true);
  }
}

document.querySelector("#new-application").addEventListener("click", openCreateDialog);
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => dialog.close());
applicationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#save-application");
  button.disabled = true;
  const payload = {
    company: document.querySelector("#company").value.trim(),
    role: document.querySelector("#role").value.trim(),
    status: document.querySelector("#status").value,
    notes: document.querySelector("#notes").value.trim() || null,
  };
  try {
    const userId = currentUserId();
    if (editApplicationId === null) {
      payload.user_id = userId;
      await request("/applications", { method: "POST", body: JSON.stringify(payload) });
      showToast("Application added.");
      currentPage = 1;
    } else {
      const query = new URLSearchParams({ user_id: String(userId) });
      await request(`/applications/${editApplicationId}?${query}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      showToast("Application updated.");
    }
    dialog.close();
    refreshData();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#filters").addEventListener("input", () => {
  window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => { currentPage = 1; loadApplications(); }, 250);
});
document.querySelector("#filters").addEventListener("change", () => {
  window.clearTimeout(filterTimer);
  currentPage = 1;
  loadApplications();
});
document.querySelector("#filters").addEventListener("reset", () => {
  window.setTimeout(() => { currentPage = 1; loadApplications(); }, 0);
});
document.querySelector("#previous-page").addEventListener("click", () => {
  if (currentPage > 1) { currentPage -= 1; loadApplications(); }
});
document.querySelector("#next-page").addEventListener("click", () => {
  if (currentPage < totalPages) { currentPage += 1; loadApplications(); }
});
document.querySelector("#analytics-months").addEventListener("change", loadTimeline);
userIdInput.addEventListener("change", () => {
  localStorage.setItem("careerlog-user-id", userIdInput.value);
  currentPage = 1;
  refreshData();
});
function showView(view) {
  const showAnalytics = view === "analytics";
  document.querySelector("#applications-view").hidden = showAnalytics;
  document.querySelector("#analytics-view").hidden = !showAnalytics;
  document.querySelector("#breadcrumb-current").textContent = showAnalytics ? "Analytics" : "Applications";
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  if (showAnalytics) { loadSummary(); loadTimeline(); }
}

function currentView() {
  return window.location.pathname === "/analytics" || window.location.hash === "#analytics"
    ? "analytics"
    : "applications";
}

window.addEventListener("hashchange", () => showView(currentView()));
showView(currentView());

refreshData();
