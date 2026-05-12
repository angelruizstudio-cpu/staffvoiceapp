const STORAGE_KEY = "staffVoiceReports";

const form = document.querySelector("#voiceForm");
const privacyButtons = document.querySelectorAll("[data-privacy]");
const privacyPill = document.querySelector("#privacyPill");
const assurance = document.querySelector("#assurance");
const reviewText = document.querySelector("#reviewText");
const contactFields = document.querySelector("#contactFields");
const contactInput = document.querySelector("[name='contact']");
const reportingFor = document.querySelector("#reportingFor");
const permissionField = document.querySelector("#permissionField");
const permissionSelect = document.querySelector("[name='permission']");
const reportList = document.querySelector("#reportList");
const filterButtons = document.querySelectorAll("[data-filter]");
const clearReports = document.querySelector("#clearReports");
const toast = document.querySelector("#toast");

let privacyMode = "anonymous";
let activeFilter = "all";

function getReports() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
}

function saveReports(reports) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function setPrivacyMode(mode) {
  privacyMode = mode;
  privacyButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.privacy === mode);
  });

  const allowsFollowUp = mode === "followup";
  contactFields.classList.toggle("hidden", !allowsFollowUp);
  contactInput.required = allowsFollowUp;
  privacyPill.textContent = allowsFollowUp ? "Follow-up allowed" : "Anonymous";
  assurance.textContent = allowsFollowUp
    ? "HR can contact you because you chose to provide contact information."
    : "Your report remains anonymous because no contact information will be collected.";
  reviewText.textContent = allowsFollowUp
    ? "HR receives your contact information for follow-up. Staff Council only receives a de-identified summary if you authorize sharing."
    : "No contact information will be requested. HR receives the report, and Staff Council only receives it if you authorize sharing.";

  if (!allowsFollowUp) {
    contactInput.value = "";
  }
}

privacyButtons.forEach((button) => {
  button.addEventListener("click", () => setPrivacyMode(button.dataset.privacy));
});

reportingFor.addEventListener("change", () => {
  const reportingOther = reportingFor.value === "other";
  permissionField.classList.toggle("hidden", !reportingOther);
  permissionSelect.required = reportingOther;
  if (!reportingOther) {
    permissionSelect.value = "";
  }
});

function reportSummary(report) {
  const text = report.description.trim();
  return text.length > 190 ? `${text.slice(0, 190)}...` : text;
}

function tagClass(value) {
  if (value === "Urgent") return "tag alert";
  if (value === "Needs attention soon") return "tag warn";
  return "tag";
}

function renderReports() {
  const reports = getReports();
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
      </div>
      <p><strong>Reporting:</strong> ${report.reportingFor === "other" ? `For someone else (${report.permission || "permission not stated"})` : "For self"}</p>
      ${report.contact ? `<p><strong>Contact:</strong> ${report.contact}</p>` : ""}
      <div class="report-actions">
        <button type="button" data-status="new" data-id="${report.id}">New</button>
        <button type="button" data-status="reviewing" data-id="${report.id}">Reviewing</button>
        <button type="button" data-status="closed" data-id="${report.id}">Closed</button>
      </div>
    </article>
  `).join("");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const report = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "new",
    privacyMode,
    reportType: formData.get("reportType"),
    reportingFor: formData.get("reportingFor"),
    permission: formData.get("permission"),
    description: formData.get("description"),
    area: formData.get("area"),
    urgency: formData.get("urgency"),
    shareCouncil: formData.get("shareCouncil"),
    contact: privacyMode === "followup" ? formData.get("contact") : "",
  };

  const reports = [report, ...getReports()];
  saveReports(reports);
  form.reset();
  setPrivacyMode("anonymous");
  permissionField.classList.add("hidden");
  permissionSelect.required = false;
  renderReports();
  showToast("Report submitted in this demo workspace.");
});

reportList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-status]");
  if (!button) return;

  const reports = getReports().map((report) => (
    report.id === button.dataset.id
      ? { ...report, status: button.dataset.status }
      : report
  ));
  saveReports(reports);
  renderReports();
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderReports();
  });
});

clearReports.addEventListener("click", () => {
  saveReports([]);
  renderReports();
  showToast("Demo reports cleared.");
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

setPrivacyMode("anonymous");
renderReports();
