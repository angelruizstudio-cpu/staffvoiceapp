const loginForm = document.querySelector("#loginForm");
const setupForm = document.querySelector("#setupForm");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  try {
    await postJson("/api/auth/login", {
      email: data.get("email"),
      password: data.get("password")
    });
    window.location.href = "/admin";
  } catch (error) {
    showToast(error.message);
  }
});

setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(setupForm);
  try {
    await postJson("/api/auth/setup", {
      setupCode: data.get("setupCode"),
      email: data.get("email"),
      name: data.get("name"),
      password: data.get("password")
    });
    window.location.href = "/admin";
  } catch (error) {
    showToast(error.message);
  }
});
