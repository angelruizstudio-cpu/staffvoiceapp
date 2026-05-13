const statusContent = document.querySelector("#statusContent");

const statusLabels = {
  received: "Received",
  in_review: "In review",
  follow_up: "Follow-up in progress",
  closed: "Closed"
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

async function loadStatus() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("t") || "";
  if (!token) {
    statusContent.innerHTML = `
      <div class="empty-state">
        This status link is missing its private tracking token.
      </div>
    `;
    return;
  }

  const response = await fetch(`/api/status/${encodeURIComponent(token)}`);
  if (!response.ok) {
    statusContent.innerHTML = `
      <div class="empty-state">
        We could not find a report for this private status link.
      </div>
    `;
    return;
  }

  const body = await response.json();
  const report = body.report;
  const label = statusLabels[report.publicStatus] || statusLabels.received;

  statusContent.innerHTML = `
    <div class="status-large">${escapeHtml(label)}</div>
    <p class="status-date">Last updated: ${escapeHtml(formatDate(report.publicStatusUpdatedAt))}</p>
    <div class="employee-message">
      <h2>Message from HR</h2>
      <p>${report.publicMessage ? escapeHtml(report.publicMessage) : "HR has received your report. Please check back later for any public updates."}</p>
    </div>
    <p class="small-print">This page only shows public follow-up information. HR internal notes are not visible here.</p>
  `;
}

loadStatus();
