const https = require("https");
const { buildTextPdf } = require("./pdf");

function parseEmails(value) {
  return String(value || "")
    .split(/[,\s;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Chicago"
    });
  } catch {
    return value;
  }
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = https.request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        ...headers
      }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const responseBody = Buffer.concat(chunks).toString("utf8");
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(responseBody ? JSON.parse(responseBody) : {});
          return;
        }
        reject(new Error(`Resend email failed (${response.statusCode}): ${responseBody.slice(0, 500)}`));
      });
    });

    request.on("error", reject);
    request.setTimeout(8000, () => request.destroy(new Error("Resend email timed out.")));
    request.write(payload);
    request.end();
  });
}

function reportSections(report) {
  return [
    { label: "Report ID", value: report.id },
    { label: "Submitted", value: formatDate(report.createdAt) },
    { label: "What would you like to share", value: report.reportType },
    { label: "Submitting for", value: report.reportingFor === "other" ? "On behalf of another employee" : "Self" },
    { label: "Permission", value: report.permission },
    { label: "Feedback or concern", value: report.description },
    { label: "Specific area or process", value: report.area },
    { label: "Share with Staff Council", value: report.shareCouncil },
    { label: "HR follow-up requested", value: report.hrFollowUp },
    { label: "Contact information", value: report.hrFollowUp === "Yes" ? report.contact : "Not requested" },
    { label: "Preferred contact method", value: report.contactMethod },
    { label: "Best time to contact", value: report.contactBestTime },
    { label: "Follow-up notes from submitter", value: report.followUpNotes }
  ];
}

function buildReportPdf(report) {
  return buildTextPdf("Staff Voice Report", reportSections(report));
}

function buildEmailHtml(report, adminUrl) {
  const submitted = formatDate(report.createdAt);
  return `
    <div style="font-family: Arial, sans-serif; color: #102a3a; line-height: 1.5;">
      <h2>New Staff Voice report received</h2>
      <p>A new Staff Voice report was submitted on ${escapeHtml(submitted)}.</p>
      <ul>
        <li><strong>Type:</strong> ${escapeHtml(report.reportType)}</li>
        <li><strong>HR follow-up:</strong> ${escapeHtml(report.hrFollowUp)}</li>
        <li><strong>Staff Council sharing:</strong> ${escapeHtml(report.shareCouncil)}</li>
        <li><strong>Area/process:</strong> ${escapeHtml(report.area || "Not provided")}</li>
      </ul>
      <p>The submitted report details are attached as a PDF.</p>
      <p><a href="${escapeHtml(adminUrl)}">Open Staff Voice admin</a></p>
    </div>
  `;
}

function buildEmailText(report, adminUrl) {
  return [
    "New Staff Voice report received",
    "",
    `Submitted: ${formatDate(report.createdAt)}`,
    `Type: ${report.reportType}`,
    `HR follow-up: ${report.hrFollowUp}`,
    `Staff Council sharing: ${report.shareCouncil}`,
    `Area/process: ${report.area || "Not provided"}`,
    "",
    "The submitted report details are attached as a PDF.",
    `Admin: ${adminUrl}`
  ].join("\n");
}

async function sendReportNotification(report, req) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.STAFFVOICE_FROM_EMAIL;
  const to = parseEmails(process.env.STAFFVOICE_NOTIFICATION_EMAILS);

  if (!apiKey || !from || !to.length) {
    return { skipped: true };
  }

  const forwardedProto = req?.headers?.["x-forwarded-proto"] || "https";
  const host = req?.headers?.host || "staffvoice.kingdomtechgroup.org";
  const adminUrl = process.env.STAFFVOICE_ADMIN_URL || `${forwardedProto}://${host}/admin`;
  const pdf = buildReportPdf(report);

  return postJson("https://api.resend.com/emails", {
    from,
    to,
    subject: "New Staff Voice report received",
    html: buildEmailHtml(report, adminUrl),
    text: buildEmailText(report, adminUrl),
    attachments: [
      {
        filename: `staffvoice-report-${String(report.id).slice(0, 8)}.pdf`,
        content: pdf.toString("base64")
      }
    ]
  }, {
    authorization: `Bearer ${apiKey}`,
    "idempotency-key": `staffvoice-report-${report.id}`
  });
}

module.exports = {
  sendReportNotification
};
