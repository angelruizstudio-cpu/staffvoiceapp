const reportList = document.querySelector("#reportList");
const filterButtons = document.querySelectorAll("[data-filter]");
const refreshReports = document.querySelector("#refreshReports");
const userForm = document.querySelector("#userForm");
const userList = document.querySelector("#userList");
const currentUserPill = document.querySelector("#currentUserPill");
const toast = document.querySelector("#toast");

let reports = [];
let users = [];
let currentUser = null;
let activeFilter = "all";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function renderUsers() {
  if (!currentUser) {
    userList.innerHTML = `<div class="empty-state">Loading users...</div>`;
    return;
  }

  currentUserPill.textContent = `${currentUser.role}: ${currentUser.email}`;
  const isOwner = currentUser.role === "owner";
  userForm.classList.toggle("hidden", !isOwner);

  if (!users.length) {
    userList.innerHTML = `<div class="empty-state">No authorized users found.</div>`;
    return;
  }

  userList.innerHTML = users.map((user) => `
    <article class="user-card">
      <div>
        <h3>${user.name || user.email}</h3>
        <p>${user.email}</p>
      </div>
      <div class="report-meta">
        <span class="tag">${user.role}</span>
        <span class="tag ${user.active ? "" : "warn"}">${user.active ? "Active" : "Inactive"}</span>
      </div>
      ${isOwner ? `
        <div class="report-actions">
          <button type="button" data-user-role="hr" data-email="${user.email}">Make HR</button>
          <button type="button" data-user-role="owner" data-email="${user.email}">Make owner</button>
          <button type="button" data-user-active="${user.active ? "false" : "true"}" data-email="${user.email}">
            ${user.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function reportSummary(report) {
  const text = report.description.trim();
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

function tagClass(value) {
  if (value === "Urgent") return "tag alert";
  if (value === "Needs attention soon") return "tag warn";
  return "tag";
}

function renderReports() {
  const visibleReports = activeFilter === "all"
    ? reports
    : reports.filter((report) => report.status === activeFilter);

  if (!visibleReports.length) {
    reportList.innerHTML = `<div class="empty-state">No ${activeFilter === "all" ? "" : activeFilter} reports yet.</div>`;
    return;
  }

  reportList.innerHTML = visibleReports.map((report) => `
    <article class="report-card">
      <div class="report-top">
        <div>
          <h3>${report.reportType}</h3>
          <p>${reportSummary(report)}</p>
        </div>
        <span class="status">${report.status}</span>
      </div>
      <div class="report-meta">
        <span class="${tagClass(report.urgency)}">${report.urgency}</span>
        <span class="tag">${report.privacyMode === "followup" ? "Follow-up allowed" : "Anonymous"}</span>
        <span class="tag">Staff Council: ${report.shareCouncil}</span>
        <span class="tag">${report.area || "No area listed"}</span>
        <span class="tag">${new Date(report.createdAt).toLocaleDateString()}</span>
      </div>
      <p><strong>Reporting:</strong> ${report.reportingFor === "other" ? `For someone else (${report.permission || "permission not stated"})` : "For self"}</p>
      ${report.contact ? `<p><strong>Contact:</strong> ${report.contact}</p>` : ""}
      <label>
        HR notes
        <textarea rows="3" data-notes="${report.id}" placeholder="Internal HR notes">${report.hrNotes || ""}</textarea>
      </label>
      <div class="report-actions">
        <button type="button" data-status="new" data-id="${report.id}">New</button>
        <button type="button" data-status="reviewing" data-id="${report.id}">Reviewing</button>
        <button type="button" data-status="closed" data-id="${report.id}">Closed</button>
      </div>
    </article>
  `).join("");
}

async function loadReports() {
  reportList.innerHTML = `<div class="empty-state">Loading reports...</div>`;
  const response = await fetch("/api/reports");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to load reports.");
  }

  const body = await response.json();
  reports = body.reports || [];
  renderReports();
}

async function loadUsers() {
  const response = await fetch("/api/users");
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to load authorized users.");
  }

  const body = await response.json();
  currentUser = body.currentUser;
  users = body.users || [];
  renderUsers();
}

async function updateReport(id, status, hrNotes) {
  const response = await fetch(`/api/reports/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, hrNotes })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to update report.");
  }

  const body = await response.json();
  reports = reports.map((report) => report.id === id ? body.report : report);
  renderReports();
}

reportList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-status]");
  if (!button) return;

  const notes = document.querySelector(`[data-notes="${button.dataset.id}"]`)?.value || "";
  try {
    await updateReport(button.dataset.id, button.dataset.status, notes);
    showToast("Report updated.");
  } catch (error) {
    showToast(error.message);
  }
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderReports();
  });
});

refreshReports.addEventListener("click", () => {
  loadReports().catch((error) => showToast(error.message));
});

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(userForm);
  try {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        name: formData.get("name"),
        role: formData.get("role")
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Unable to save user.");
    }

    userForm.reset();
    await loadUsers();
    showToast("User saved.");
  } catch (error) {
    showToast(error.message);
  }
});

userList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-email]");
  if (!button) return;

  const payload = {};
  if (button.dataset.userRole) payload.role = button.dataset.userRole;
  if (button.dataset.userActive) payload.active = button.dataset.userActive === "true";

  try {
    const response = await fetch(`/api/users/${encodeURIComponent(button.dataset.email)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Unable to update user.");
    }

    await loadUsers();
    showToast("User updated.");
  } catch (error) {
    showToast(error.message);
  }
});

Promise.all([loadReports(), loadUsers()]).catch((error) => showToast(error.message));
