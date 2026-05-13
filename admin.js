const reportList = document.querySelector("#reportList");
const filterButtons = document.querySelectorAll("[data-filter]");
const refreshReports = document.querySelector("#refreshReports");
const userForm = document.querySelector("#userForm");
const userList = document.querySelector("#userList");
const currentUserPill = document.querySelector("#currentUserPill");
const logoutButton = document.querySelector("#logoutButton");
const toast = document.querySelector("#toast");

let reports = [];
let users = [];
let currentUser = null;
let activeFilter = "all";

const publicStatusLabels = {
  received: "Received",
  in_review: "In review",
  follow_up: "Follow-up in progress",
  closed: "Closed"
};

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function caseNumber(report) {
  return String(report.id || "").slice(0, 8).toUpperCase();
}

function reportSummary(report) {
  const text = String(report.description || "").trim();
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function visibleReports() {
  if (activeFilter === "all") return reports;
  if (activeFilter === "followup") {
    return reports.filter((report) => report.hrFollowUp === "Yes" && report.status !== "closed");
  }
  return reports.filter((report) => report.status === activeFilter);
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
        <h3>${escapeHtml(user.name || user.email)}</h3>
        <p>${escapeHtml(user.email)}</p>
      </div>
      <div class="report-meta">
        <span class="tag">${escapeHtml(user.role)}</span>
        <span class="tag ${user.active ? "" : "warn"}">${user.active ? "Active" : "Inactive"}</span>
      </div>
      ${isOwner ? `
        <div class="report-actions">
          <button type="button" data-user-role="hr" data-email="${escapeAttr(user.email)}">Make HR</button>
          <button type="button" data-user-role="owner" data-email="${escapeAttr(user.email)}">Make owner</button>
          <button type="button" data-user-active="${user.active ? "false" : "true"}" data-email="${escapeAttr(user.email)}">
            ${user.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function renderReports() {
  const items = visibleReports();
  if (!items.length) {
    reportList.innerHTML = `<div class="empty-state">No ${activeFilter === "all" ? "" : activeFilter} cases yet.</div>`;
    return;
  }

  reportList.innerHTML = `
    <div class="case-table-panel">
      <table class="case-table">
        <thead>
          <tr>
            <th></th>
            <th>Case</th>
            <th>Subject</th>
            <th>Status</th>
            <th>Sub-status</th>
            <th>Category</th>
            <th>Priority</th>
            <th>Date/Time Opened</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((report, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>
                <a class="table-link" href="/case.html?id=${encodeURIComponent(report.id)}" target="_blank" rel="noopener">
                  ${escapeHtml(caseNumber(report))}
                </a>
              </td>
              <td>
                <a class="table-link subject-link" href="/case.html?id=${encodeURIComponent(report.id)}" target="_blank" rel="noopener">
                  ${escapeHtml(reportSummary(report))}
                </a>
              </td>
              <td>${escapeHtml(report.status)}</td>
              <td>${escapeHtml(report.hrFollowUp === "Yes" ? (publicStatusLabels[report.publicStatus] || "Received") : "No follow-up")}</td>
              <td>${escapeHtml(report.reportType)}</td>
              <td>${escapeHtml(report.hrFollowUp === "Yes" ? "Follow-up" : "Routine")}</td>
              <td>${escapeHtml(formatDate(report.createdAt))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function loadReports() {
  reportList.innerHTML = `<div class="empty-state">Loading cases...</div>`;
  const response = await fetch("/api/reports");
  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to load cases.");
  }

  const body = await response.json();
  reports = body.reports || [];
  renderReports();
}

async function loadUsers() {
  const response = await fetch("/api/users");
  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to load authorized users.");
  }

  const body = await response.json();
  currentUser = body.currentUser;
  users = body.users || [];
  renderUsers();
}

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

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
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
        role: formData.get("role"),
        password: formData.get("password")
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
