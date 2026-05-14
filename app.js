const form = document.querySelector("#voiceForm");
const privacyPill = document.querySelector("#privacyPill");
const thanksSection = document.querySelector("#thanks");
const newReportButton = document.querySelector("#newReportButton");
const trackingBox = document.querySelector("#trackingBox");
const trackingLink = document.querySelector("#trackingLink");
const copyTrackingLink = document.querySelector("#copyTrackingLink");
const followUpModal = document.querySelector("#followUpModal");
const closeFollowUpModal = document.querySelector("#closeFollowUpModal");
const cancelFollowUpContact = document.querySelector("#cancelFollowUpContact");
const saveFollowUpContact = document.querySelector("#saveFollowUpContact");
const contactInput = document.querySelector("#contactInput");
const contactMethodInput = document.querySelector("#contactMethodInput");
const contactBestTimeInput = document.querySelector("#contactBestTimeInput");
const followUpNotesInput = document.querySelector("#followUpNotesInput");
const safetyNotice = document.querySelector("#safetyNotice");
const followUpMethod = document.querySelector("#followUpMethod");
const followUpContact = document.querySelector("#followUpContact");
const followUpBestTime = document.querySelector("#followUpBestTime");
const followUpNotes = document.querySelector("#followUpNotes");
const toast = document.querySelector("#toast");
const safetyUrgencies = new Set([
  "Threat or safety concern",
  "Crime or illegal activity",
  "Immediate danger"
]);

function showToast(message) {
  if (!toast) return;
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

function setFollowUpChoice(value) {
  const radio = form.querySelector(`[name="hrFollowUp"][value="${value}"]`);
  if (radio) radio.checked = true;
  privacyPill.textContent = value === "Yes" ? "Follow-up requested" : "Anonymous";
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

  if (event.target.name === "urgency") {
    safetyNotice?.classList.toggle("hidden", !safetyUrgencies.has(event.target.value));
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
    urgency: formData.get("urgency"),
    reportingFor: formData.get("reportingFor"),
    permission: formData.get("permission"),
    description: formData.get("description"),
    area: formData.get("area"),
    shareCouncil: formData.get("shareCouncil"),
    contact: formData.get("contact") || "",
    contactMethod: formData.get("contactMethod") || "",
    contactBestTime: formData.get("contactBestTime") || "",
    followUpNotes: formData.get("followUpNotes") || "",
  };

  if (hrFollowUp === "Yes" && !String(report.contact).trim()) {
    openFollowUpModal();
    showToast("Please provide contact information so HR can follow up.");
    return;
  }

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

    const body = await response.json();
    form.reset();
    privacyPill.textContent = "Anonymous";
    safetyNotice?.classList.add("hidden");
    if (body.trackingUrl && trackingLink && trackingBox) {
      trackingLink.href = body.trackingUrl;
      trackingLink.textContent = body.trackingUrl;
      trackingBox.classList.remove("hidden");
      showToast("Report submitted. Copy and save your private status link.");
    } else if (trackingLink && trackingBox) {
      trackingLink.removeAttribute("href");
      trackingLink.textContent = "";
      trackingBox.classList.add("hidden");
      showToast("Report submitted. Thank you for sharing your voice.");
    }
    thanksSection.classList.remove("hidden");
    thanksSection.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    showToast(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit confidential report";
  }
});

newReportButton.addEventListener("click", () => {
  thanksSection.classList.add("hidden");
  trackingBox?.classList.add("hidden");
  safetyNotice?.classList.add("hidden");
  document.querySelector("#report")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

if (copyTrackingLink && trackingLink) {
  copyTrackingLink.addEventListener("click", async () => {
    if (!trackingLink.href) return;
    try {
      await navigator.clipboard.writeText(trackingLink.href);
      showToast("Status link copied. Please save it somewhere safe.");
    } catch {
      showToast("Copy the status link from the page.");
    }
  });
}

closeFollowUpModal.addEventListener("click", closeModal);
cancelFollowUpContact.addEventListener("click", () => {
  setFollowUpChoice("No");
  contactInput.value = "";
  contactMethodInput.value = "";
  contactBestTimeInput.value = "";
  followUpNotesInput.value = "";
  closeModal();
});
saveFollowUpContact.addEventListener("click", () => {
  if (!followUpContact.value.trim()) {
    showToast("Contact detail is required for HR follow-up.");
    followUpContact.focus();
    return;
  }
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
