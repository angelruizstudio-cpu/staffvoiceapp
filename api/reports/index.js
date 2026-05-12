const {
  ensureTable,
  getTableClient,
  sanitizeReport,
  toPublicReport
} = require("../shared/storage");

const validStatuses = new Set(["new", "reviewing", "closed"]);

function json(status, body) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

function getClientPrincipal(req) {
  const encoded = req.headers["x-ms-client-principal"];
  if (!encoded) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function isHr(req) {
  if (process.env.STAFFVOICE_ALLOW_LOCAL_ADMIN === "true") return true;
  const principal = getClientPrincipal(req);
  return principal?.userRoles?.includes("hr");
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

      await client.createEntity(report);
      context.res = json(201, {
        id: report.id,
        createdAt: report.createdAt,
        message: "Report received."
      });
      return;
    }

    if (!isHr(req)) {
      context.res = json(403, { error: "HR access required." });
      return;
    }

    if (req.method === "GET") {
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
