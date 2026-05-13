const { getUserAccess } = require("../shared/auth");
const {
  createCaseComment,
  getTableClient,
  listCaseComments,
  sanitizeComment,
  toAdminComment
} = require("../shared/storage");

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
    const access = await getUserAccess(req);
    if (!access.allowed) {
      context.res = json(access.status || 403, { error: "Staff Voice access required." });
      return;
    }

    const reportId = String(context.bindingData.reportId || "").trim();
    if (!reportId) {
      context.res = json(400, { error: "Report id is required." });
      return;
    }

    const reportClient = getTableClient();
    const report = await reportClient.getEntity("reports", reportId).catch((error) => {
      if (error.statusCode === 404) return null;
      throw error;
    });

    if (!report) {
      context.res = json(404, { error: "Case not found." });
      return;
    }

    if (req.method === "GET") {
      const comments = await listCaseComments(reportId);
      context.res = json(200, { comments: comments.map(toAdminComment) });
      return;
    }

    if (req.method === "POST") {
      const comment = sanitizeComment(req.body || {}, access.user, reportId);
      if (!comment.comment) {
        context.res = json(400, { error: "Comment text is required." });
        return;
      }

      const created = await createCaseComment(comment);

      if (created.visibility === "public") {
        report.publicMessage = created.comment;
        report.publicStatusUpdatedAt = created.createdAt;
        report.updatedAt = created.createdAt;
        await reportClient.updateEntity(report, "Merge");
      }

      context.res = json(201, { comment: toAdminComment(created) });
      return;
    }

    context.res = json(405, { error: "Method not allowed." });
  } catch (error) {
    context.log.error(error);
    context.res = json(500, {
      error: "Staff Voice comments API is not ready.",
      detail: error.message
    });
  }
};
