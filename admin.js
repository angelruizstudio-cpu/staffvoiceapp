const reportList = document.querySelector("#reportList");
const filterButtons = document.querySelectorAll("[data-filter]");
const refreshReports = document.querySelector("#refreshReports");
const logoutButton = document.querySelector("#logoutButton");
const toast = document.querySelector("#toast");

let reports = [];
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

function priorityLabel(report) {
  const urgency = String(report.urgency || "Routine feedback");
  if (["Threat or safety concern", "Crime or illegal activity", "Immediate danger"].includes(urgency)) {
    return "Safety";
  }
  if (urgency === "Harassment or discrimination concern") {
    return "Sensitive";
  }
  return report.hrFollowUp === "Yes" ? "Follow-up" : "Routine";
}

function hasPublicTracking(report) {
  return report.hrFollowUp === "Yes" || priorityLabel(report) === "Safety";
}

function visibleReports() {
  if (activeFilter === "all") return reports;
  if (activeFilter === "followup") {
    return reports.filter((report) => hasPublicTracking(report) && report.status !== "closed");
  }
  return reports.filter((report) => report.status === activeFilter);
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
              <td>${escapeHtml(hasPublicTracking(report) ? (publicStatusLabels[report.publicStatus] || "Received") : "No public tracking")}</td>
              <td>${escapeHtml(report.reportType)}</td>
              <td>${escapeHtml(priorityLabel(report))}</td>
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
  window.location.href = "/";
});

loadReports().catch((error) => showToast(error.message));
