const form = document.querySelector("#voiceForm");
const privacyPill = document.querySelector("#privacyPill");
const thanksSection = document.querySelector("#thanks");
const newReportButton = document.querySelector("#newReportButton");
const followUpModal = document.querySelector("#followUpModal");
const closeFollowUpModal = document.querySelector("#closeFollowUpModal");
const skipFollowUpContact = document.querySelector("#skipFollowUpContact");
const saveFollowUpContact = document.querySelector("#saveFollowUpContact");
const contactInput = document.querySelector("#contactInput");
const contactMethodInput = document.querySelector("#contactMethodInput");
const contactBestTimeInput = document.querySelector("#contactBestTimeInput");
const followUpNotesInput = document.querySelector("#followUpNotesInput");
const followUpMethod = document.querySelector("#followUpMethod");
const followUpContact = document.querySelector("#followUpContact");
const followUpBestTime = document.querySelector("#followUpBestTime");
const followUpNotes = document.querySelector("#followUpNotes");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function openFollowUpModal() {
  followUpMethod.value = contactMethodInput.value;
  followUpContact.value = contactInput.value;
  followUpBestTime.value = contactBestTimeInput.value;
  followUpNotes.value = followUpNotesInput.value;
  followUpModal.classList.remove("hidden");
  followUpMethod.focus();
}

function closeModal() {
  followUpModal.classList.add("hidden");
}

form.addEventListener("change", (event) => {
  if (event.target.name === "hrFollowUp") {
    privacyPill.textContent = event.target.value === "Yes" ? "Follow-up requested" : "Anonymous";
    if (event.target.value === "Yes") {
      openFollowUpModal();
    } else {
      contactInput.value = "";
      contactMethodInput.value = "";
      contactBestTimeInput.value = "";
      followUpNotesInput.value = "";
    }
  }
});

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
    contactMethod: formData.get("contactMethod") || "",
    contactBestTime: formData.get("contactBestTime") || "",
    followUpNotes: formData.get("followUpNotes") || "",
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

closeFollowUpModal.addEventListener("click", closeModal);
skipFollowUpContact.addEventListener("click", closeModal);
saveFollowUpContact.addEventListener("click", () => {
  contactMethodInput.value = followUpMethod.value;
  contactInput.value = followUpContact.value;
  contactBestTimeInput.value = followUpBestTime.value;
  followUpNotesInput.value = followUpNotes.value;
  closeModal();
  showToast("Follow-up contact saved.");
});

followUpModal.addEventListener("click", (event) => {
  if (event.target === followUpModal) closeModal();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !followUpModal.classList.contains("hidden")) closeModal();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
