const caseTitle = document.querySelector("#caseTitle");
const caseDetail = document.querySelector("#caseDetail");
const logoutButton = document.querySelector("#logoutButton");
const toast = document.querySelector("#toast");

let report = null;
let comments = [];

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

function caseNumber(value) {
  return String(value || "").slice(0, 8).toUpperCase();
}

function reportSummary(value) {
  const text = String(value || "").trim();
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

function priorityLabel(value) {
  const urgency = String(value || "Routine feedback");
  if (["Threat or safety concern", "Crime or illegal activity", "Immediate danger"].includes(urgency)) {
    return "Safety review";
  }
  if (urgency === "Harassment or discrimination concern") {
    return "Sensitive review";
  }
  return "Routine";
}

function hasPublicTracking(report) {
  return report.hrFollowUp === "Yes" || priorityLabel(report.urgency) === "Safety review";
}

function renderComments() {
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

function renderCase() {
  if (!report) {
    caseDetail.innerHTML = `<div class="empty-state">Case not found.</div>`;
    return;
  }

  caseTitle.textContent = `Case ${caseNumber(report.id)}`;
  caseDetail.innerHTML = `
    <div class="case-detail-panel case-detail-full">
      <div class="case-detail-head">
        <div>
          <p class="eyebrow">Case ${escapeHtml(caseNumber(report.id))}</p>
          <h3>${escapeHtml(report.reportType)} report</h3>
          <p>${escapeHtml(reportSummary(report.description))}</p>
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
        ${hasPublicTracking(report) ? `
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
        <div><strong>Safety/urgency</strong><span>${escapeHtml(report.urgency || "Routine feedback")}</span></div>
        <div><strong>Priority</strong><span>${escapeHtml(priorityLabel(report.urgency))}</span></div>
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
        <button class="secondary-button" type="button" id="saveCase">Save case updates</button>
      </section>

      <section class="case-section">
        <div class="section-heading compact">
          <div>
            <p class="eyebrow">Case activity</p>
            <h4>Comments</h4>
          </div>
          <button class="secondary-button" type="button" id="refreshComments">Refresh comments</button>
        </div>
        ${renderComments()}
        <form class="comment-form" id="commentForm">
          <label>
            Visibility
            <select name="visibility">
              <option value="internal">Internal HR note</option>
              ${hasPublicTracking(report) ? `<option value="public">Message to employee</option>` : ""}
            </select>
          </label>
          <label>
            Comment
            <textarea name="comment" rows="4" required placeholder="Add a case comment"></textarea>
          </label>
          <button class="submit-button modal-save" type="submit">Add comment</button>
        </form>
      </section>
    </div>
  `;
}

async function loadReport() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    caseDetail.innerHTML = `<div class="empty-state">Missing case id.</div>`;
    return;
  }

  const response = await fetch(`/api/reports/${encodeURIComponent(id)}`);
  if (response.status === 401) {
    window.location.href = "/login.html";
    return;
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to load case.");
  }

  const body = await response.json();
  report = body.report;
  await loadComments();
  renderCase();
}

async function loadComments() {
  if (!report?.id) return;
  const response = await fetch(`/api/comments/${encodeURIComponent(report.id)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to load comments.");
  }
  const body = await response.json();
  comments = body.comments || [];
}

async function saveCase() {
  const id = report.id;
  const status = document.querySelector(`[data-case-status="${id}"]`)?.value;
  const publicStatus = document.querySelector(`[data-case-public-status="${id}"]`)?.value;
  const hrNotes = document.querySelector(`[data-case-notes="${id}"]`)?.value || "";

  const response = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status, publicStatus, hrNotes })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Unable to update case.");
  }

  const body = await response.json();
  report = body.report;
  renderCase();
}

async function addComment(form) {
  const formData = new FormData(form);
  const response = await fetch(`/api/comments/${encodeURIComponent(report.id)}`, {
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
  comments = [...comments, body.comment];
  if (body.comment?.visibility === "public") {
    report = {
      ...report,
      publicMessage: body.comment.comment,
      publicStatusUpdatedAt: body.comment.createdAt,
      updatedAt: body.comment.createdAt
    };
  }
  form.reset();
  renderCase();
}

caseDetail.addEventListener("click", async (event) => {
  if (event.target.closest("#saveCase")) {
    try {
      await saveCase();
      showToast("Case updated.");
    } catch (error) {
      showToast(error.message);
    }
  }

  if (event.target.closest("#refreshComments")) {
    try {
      await loadComments();
      renderCase();
      showToast("Comments refreshed.");
    } catch (error) {
      showToast(error.message);
    }
  }
});

caseDetail.addEventListener("submit", async (event) => {
  const form = event.target.closest("#commentForm");
  if (!form) return;
  event.preventDefault();
  try {
    await addComment(form);
    showToast("Comment added.");
  } catch (error) {
    showToast(error.message);
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
});

loadReport().catch((error) => showToast(error.message));
