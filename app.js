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
const thanksSection = document.querySelector("#thanks");
const newReportButton = document.querySelector("#newReportButton");
const toast = document.querySelector("#toast");

let privacyMode = "anonymous";

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type='submit']");
  const formData = new FormData(form);
  const report = {
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
    setPrivacyMode("anonymous");
    permissionField.classList.add("hidden");
    permissionSelect.required = false;
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

setPrivacyMode("anonymous");
