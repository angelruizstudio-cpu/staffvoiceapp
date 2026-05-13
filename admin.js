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
let selectedReportId = null;
const commentsByReport = {};
const loadingComments = new Set();

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

function renderCaseRows(items) {
  return items.map((report, index) => `
    <tr class="${report.id === selectedReportId ? "selected" : ""}">
      <td>${index + 1}</td>
      <td>
        <button class="table-link" type="button" data-select-report="${escapeAttr(report.id)}">
          ${escapeHtml(caseNumber(report))}
        </button>
      </td>
      <td>
        <button class="table-link subject-link" type="button" data-select-report="${escapeAttr(report.id)}">
          ${escapeHtml(reportSummary(report))}
        </button>
      </td>
      <td>${escapeHtml(report.status)}</td>
      <td>${escapeHtml(report.hrFollowUp === "Yes" ? (publicStatusLabels[report.publicStatus] || "Received") : "No follow-up")}</td>
      <td>${escapeHtml(report.reportType)}</td>
      <td>${escapeHtml(report.hrFollowUp === "Yes" ? "Follow-up" : "Routine")}</td>
      <td>${escapeHtml(formatDate(report.createdAt))}</td>
    </tr>
  `).join("");
}

function renderComments(report) {
  if (loadingComments.has(report.id)) {
    return `<div class="empty-state">Loading comments...</div>`;
  }

  const comments = commentsByReport[report.id] || [];
  if (!comments.length) {
    return `<div class="empty-state">No case comments yet.</div>`;
  }

  return `
    <div class="comment-table">
      <div class="comment-row comment-heading">
        <div>Created by</div>
        <div>Comment</div>
      </div>
      ${comments.map((comment) => `
        <div class="comment-row ${comment.visibility === "public" ? "public-comment" : ""}">
          <div>
            <strong>${escapeHtml(comment.createdByName || "HR")}</strong>
            <span>${escapeHtml(formatDate(comment.createdAt))}</span>
            <span class="tag ${comment.visibility === "public" ? "warn" : ""}">${comment.visibility === "public" ? "Visible to employee" : "Internal"}</span>
          </div>
          <div>${escapeHtml(comment.comment).replace(/\n/g, "<br>")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderCaseDetail(report) {
  if (!report) {
    return `<aside class="case-detail-panel empty-state">Select a case to view details.</aside>`;
  }

  return `
    <aside class="case-detail-panel">
      <div class="case-detail-head">
        <div>
          <p class="eyebrow">Case ${escapeHtml(caseNumber(report))}</p>
          <h3>${escapeHtml(report.reportType)} report</h3>
          <p>${escapeHtml(reportSummary(report))}</p>
        </div>
        <span class="status">${escapeHtml(report.status)}</span>
      </div>

      <div class="case-fields">
        <label>
          Internal status
          <select data-case-status="${escapeAttr(report.id)}">
            ${["new", "reviewing", "closed"].map((status) => `
              <option value="${status}" ${report.status === status ? "selected" : ""}>${status}</option>
            `).join("")}
          </select>
        </label>
        ${report.hrFollowUp === "Yes" ? `
          <label>
            Public status
            <select data-case-public-status="${escapeAttr(report.id)}">
              ${Object.entries(publicStatusLabels).map(([value, label]) => `
                <option value="${value}" ${report.publicStatus === value ? "selected" : ""}>${label}</option>
              `).join("")}
            </select>
          </label>
        ` : ""}
      </div>

      <div class="case-summary-grid">
        <div><strong>Opened</strong><span>${escapeHtml(formatDate(report.createdAt))}</span></div>
        <div><strong>HR follow-up</strong><span>${escapeHtml(report.hrFollowUp || "No")}</span></div>
        <div><strong>Staff Council</strong><span>${escapeHtml(report.shareCouncil)}</span></div>
        <div><strong>Area/process</strong><span>${escapeHtml(report.area || "Not provided")}</span></div>
      </div>

      <section class="case-section">
        <h4>Submitted report</h4>
        <p><strong>Reporting:</strong> ${report.reportingFor === "other" ? `For someone else (${escapeHtml(report.permission || "permission not stated")})` : "For self"}</p>
        <p>${escapeHtml(report.description).replace(/\n/g, "<br>")}</p>
        ${report.contact ? `<p><strong>Contact:</strong> ${escapeHtml(report.contact)}</p>` : ""}
        ${report.contactMethod ? `<p><strong>Preferred method:</strong> ${escapeHtml(report.contactMethod)}</p>` : ""}
        ${report.contactBestTime ? `<p><strong>Best time:</strong> ${escapeHtml(report.contactBestTime)}</p>` : ""}
        ${report.followUpNotes ? `<p><strong>Follow-up notes:</strong> ${escapeHtml(report.followUpNotes)}</p>` : ""}
      </section>

      <section class="case-section">
        <label>
          HR internal notes
          <textarea rows="3" data-case-notes="${escapeAttr(report.id)}" placeholder="Internal HR notes">${escapeHtml(report.hrNotes || "")}</textarea>
        </label>
        <button class="secondary-button" type="button" data-case-save="${escapeAttr(report.id)}">Save case updates</button>
      </section>

      <section class="case-section">
        <div class="section-heading compact">
          <div>
            <p class="eyebrow">Case activity</p>
            <h4>Comments</h4>
          </div>
          <button class="secondary-button" type="button" data-refresh-comments="${escapeAttr(report.id)}">Refresh comments</button>
        </div>
        ${renderComments(report)}
        <form class="comment-form" data-comment-form="${escapeAttr(report.id)}">
          <label>
            Visibility
            <select name="visibility">
              <option value="internal">Internal HR note</option>
              ${report.hrFollowUp === "Yes" ? `<option value="public">Message to employee</option>` : ""}
            </select>
          </label>
          <label>
            Comment
            <textarea name="comment" rows="4" required placeholder="Add a case comment"></textarea>
          </label>
          <button class="submit-button modal-save" type="submit">Add comment</button>
        </form>
      </section>
    </aside>
  `;
}

function renderReports() {
  const items = visibleReports();
  if (!items.length) {
    selectedReportId = null;
    reportList.innerHTML = `<div class="empty-state">No ${activeFilter === "all" ? "" : activeFilter} cases yet.</div>`;
    return;
  }

  if (!items.some((report) => report.id === selectedReportId)) {
    selectedReportId = items[0].id;
  }

  const selectedReport = reports.find((report) => report.id === selectedReportId);
  reportList.innerHTML = `
    <div class="case-workspace">
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
          <tbody>${renderCaseRows(items)}</tbody>
        </table>
      </div>
      ${renderCaseDetail(selectedReport)}
    </div>
  `;

  if (selectedReport && commentsByReport[selectedReport.id] === undefined && !loadingComments.has(selectedReport.id)) {
    loadComments(selectedReport.id).catch((error) => showToast(error.message));
  }
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

async function loadComments(reportId) {
  loadingComments.add(reportId);
  renderReports();
  const response = await fetch(`/api/comments/${encodeURIComponent(reportId)}`);
  loadingComments.delete(reportId);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to load comments.");
  }

  const body = await response.json();
  commentsByReport[reportId] = body.comments || [];
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

async function updateReport(id, payload) {
  const response = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to update case.");
  }

  const body = await response.json();
  reports = reports.map((report) => report.id === id ? body.report : report);
  renderReports();
}

async function addComment(reportId, form) {
  const formData = new FormData(form);
  const response = await fetch(`/api/comments/${encodeURIComponent(reportId)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      visibility: formData.get("visibility"),
      comment: formData.get("comment")
    })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to add comment.");
  }

  const body = await response.json();
  commentsByReport[reportId] = [...(commentsByReport[reportId] || []), body.comment];
  if (body.comment?.visibility === "public") {
    reports = reports.map((report) => report.id === reportId
      ? {
          ...report,
          publicMessage: body.comment.comment,
          publicStatusUpdatedAt: body.comment.createdAt,
          updatedAt: body.comment.createdAt
        }
      : report);
  }
  form.reset();
  renderReports();
}

reportList.addEventListener("click", async (event) => {
  const selectButton = event.target.closest("[data-select-report]");
  if (selectButton) {
    selectedReportId = selectButton.dataset.selectReport;
    renderReports();
    return;
  }

  const refreshButton = event.target.closest("[data-refresh-comments]");
  if (refreshButton) {
    try {
      await loadComments(refreshButton.dataset.refreshComments);
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  const saveButton = event.target.closest("[data-case-save]");
  if (!saveButton) return;

  const id = saveButton.dataset.caseSave;
  const status = document.querySelector(`[data-case-status="${id}"]`)?.value;
  const publicStatus = document.querySelector(`[data-case-public-status="${id}"]`)?.value;
  const hrNotes = document.querySelector(`[data-case-notes="${id}"]`)?.value || "";

  try {
    await updateReport(id, { status, publicStatus, hrNotes });
    showToast("Case updated.");
  } catch (error) {
    showToast(error.message);
  }
});

reportList.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-comment-form]");
  if (!form) return;

  event.preventDefault();
  try {
    await addComment(form.dataset.commentForm, form);
    showToast("Comment added.");
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
