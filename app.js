const form = document.querySelector("#voiceForm");
const privacyPill = document.querySelector("#privacyPill");
const thanksSection = document.querySelector("#thanks");
const newReportButton = document.querySelector("#newReportButton");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const hrFollowUp = formData.get("hrFollowUp");
  const report = {
    privacyMode: hrFollowUp === "Yes" ? "followup" : "anonymous",
    hrFollowUp,
    reportType: formData.get("reportType"),
    reportingFor: formData.get("reportingFor"),
    permission: formData.get("permission"),
    description: formData.get("description"),
    area: formData.get("area"),
    urgency: "Routine",
    shareCouncil: formData.get("shareCouncil"),
    contact: formData.get("contact") || "",
  };

  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Unable to submit report.");
    }

    form.reset();
    privacyPill.textContent = "Anonymous";
    thanksSection.classList.remove("hidden");
    thanksSection.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("Report submitted. Thank you for sharing your voice.");
  } catch (error) {
    showToast(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit confidential report";
  }
});

newReportButton.addEventListener("click", () => {
  thanksSection.classList.add("hidden");
  document.querySelector("#report")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
