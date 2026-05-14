const {
  getReportByTrackingToken,
  listCaseComments,
  toPublicComment,
  toPublicTrackingStatus
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

module.exports = async function (context) {
  try {
    const token = String(context.bindingData.token || "").trim();
    if (token.length < 24) {
      context.res = json(404, { error: "Tracking status not found." });
      return;
    }

    const report = await getReportByTrackingToken(token).catch((error) => {
      if (error.statusCode === 404) return null;
      throw error;
    });

    if (!report) {
      context.res = json(404, { error: "Tracking status not found." });
      return;
    }

    const comments = await listCaseComments(report.id, { publicOnly: true });
    context.res = json(200, {
      report: toPublicTrackingStatus(report),
      comments: comments.map(toPublicComment)
    });
  } catch (error) {
    context.log.error(error);
    context.res = json(500, {
      error: "Staff Voice tracking is not ready."
    });
  }
};
