const userForm = document.querySelector("#userForm");
const userList = document.querySelector("#userList");
const currentUserPill = document.querySelector("#currentUserPill");
const logoutButton = document.querySelector("#logoutButton");
const toast = document.querySelector("#toast");

let users = [];
let currentUser = null;

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

function renderUsers() {
  if (!currentUser) {
    userList.innerHTML = `<div class="empty-state">Loading users...</div>`;
    return;
  }

  currentUserPill.textContent = `${currentUser.role}: ${currentUser.email}`;
  const isOwner = currentUser.role === "owner";
  userForm.classList.toggle("hidden", !isOwner);

  if (!isOwner) {
    userList.innerHTML = `<div class="empty-state">Only owners can manage authorized users.</div>`;
    return;
  }

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
      <div class="report-actions">
        <button type="button" data-user-role="hr" data-email="${escapeAttr(user.email)}">Make HR</button>
        <button type="button" data-user-role="owner" data-email="${escapeAttr(user.email)}">Make owner</button>
        <button type="button" data-user-active="${user.active ? "false" : "true"}" data-email="${escapeAttr(user.email)}">
          ${user.active ? "Deactivate" : "Activate"}
        </button>
      </div>
    </article>
  `).join("");
}

async function loadUsers() {
  userList.innerHTML = `<div class="empty-state">Loading authorized users...</div>`;
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

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
});

loadUsers().catch((error) => showToast(error.message));
