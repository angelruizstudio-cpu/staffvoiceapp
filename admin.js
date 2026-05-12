const reportList = document.querySelector("#reportList");
const filterButtons = document.querySelectorAll("[data-filter]");
const refreshReports = document.querySelector("#refreshReports");
const toast = document.querySelector("#toast");

let reports = [];
let activeFilter = "all";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
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

loadReports().catch((error) => showToast(error.message));
