const {
  ensureTable,
  getTableClient,
  sanitizeReport,
  toPublicReport
} = require("../shared/storage");
const { getUserAccess } = require("../shared/auth");
const { sendReportNotification } = require("../shared/notifications");
const { getPublicOrigin } = require("../shared/urls");

const validStatuses = new Set(["new", "reviewing", "closed"]);
const validPublicStatuses = new Set(["received", "in_review", "follow_up", "closed"]);

function json(status, body) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

module.exports = async function (context, req) {
  try {
    const client = getTableClient();
    await ensureTable(client);

    if (req.method === "POST") {
      const report = sanitizeReport(req.body || {});
      if (!report.reportType || !report.description || !report.shareCouncil) {
        context.res = json(400, { error: "Missing required report fields." });
        return;
      }
      if (report.hrFollowUp === "Yes" && !report.contact) {
        context.res = json(400, { error: "Contact information is required when HR follow-up is requested." });
        return;
      }

      await client.createEntity(report);
      await sendReportNotification(report, req).catch((error) => {
        context.log.error("Report notification email failed", error);
      });
      const trackingUrl = report.trackingToken
        ? `${getPublicOrigin(req)}/status.html?t=${encodeURIComponent(report.trackingToken)}`
        : "";
      context.res = json(201, {
        id: report.id,
        createdAt: report.createdAt,
        trackingUrl,
        message: "Report received."
      });
      return;
    }

    const access = await getUserAccess(req);
    if (!access.allowed) {
      context.res = json(access.status || 403, { error: "Staff Voice access required." });
      return;
    }

    if (req.method === "GET") {
      const id = context.bindingData.id;
      if (id) {
        const entity = await client.getEntity("reports", id).catch((error) => {
          if (error.statusCode === 404) return null;
          throw error;
        });

        if (!entity) {
          context.res = json(404, { error: "Report not found." });
          return;
        }

        context.res = json(200, { report: toPublicReport(entity) });
        return;
      }

      const reports = [];
      for await (const entity of client.listEntities({ queryOptions: { filter: "PartitionKey eq 'reports'" } })) {
        reports.push(toPublicReport(entity));
      }

      reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      context.res = json(200, { reports });
      return;
    }

    if (req.method === "PATCH") {
      const id = context.bindingData.id;
      if (!id) {
        context.res = json(400, { error: "Report id is required." });
        return;
      }

      const nextStatus = req.body?.status;
      if (!validStatuses.has(nextStatus)) {
        context.res = json(400, { error: "Invalid status." });
        return;
      }

      const entity = await client.getEntity("reports", id);
      entity.status = nextStatus;
      entity.hrNotes = String(req.body?.hrNotes || entity.hrNotes || "").slice(0, 4000);
      let publicStatusChanged = false;
      if (req.body?.publicStatus !== undefined) {
        if (!validPublicStatuses.has(req.body.publicStatus)) {
          context.res = json(400, { error: "Invalid public status." });
          return;
        }
        publicStatusChanged = entity.publicStatus !== req.body.publicStatus;
        entity.publicStatus = req.body.publicStatus;
      }
      if (req.body?.publicMessage !== undefined) {
        const publicMessage = String(req.body.publicMessage || "").slice(0, 2000);
        publicStatusChanged = publicStatusChanged || entity.publicMessage !== publicMessage;
        entity.publicMessage = publicMessage;
      }
      if (publicStatusChanged) {
        entity.publicStatusUpdatedAt = new Date().toISOString();
      }
      entity.updatedAt = new Date().toISOString();
      await client.updateEntity(entity, "Merge");
      context.res = json(200, { report: toPublicReport(entity) });
      return;
    }

    context.res = json(405, { error: "Method not allowed." });
  } catch (error) {
    context.log.error(error);
    context.res = json(500, {
      error: "Staff Voice API is not ready.",
      detail: error.message
    });
  }
};
