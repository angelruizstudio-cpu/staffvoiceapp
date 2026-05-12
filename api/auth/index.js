const {
  clearSessionCookie,
  createSessionCookie,
  getUserAccess,
  hasOwner,
  hashPassword,
  toPublicUser,
  verifyPassword
} = require("../shared/auth");
const {
  ensureTable,
  getTableClient,
  normalizeEmail,
  sanitizeUser,
  userTableName
} = require("../shared/storage");

function json(status, body, headers = {}) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

module.exports = async function (context, req) {
  try {
    const action = context.bindingData.action || "me";
    const client = getTableClient(userTableName);
    await ensureTable(client);

    if (req.method === "GET" && action === "me") {
      const access = await getUserAccess(req);
      context.res = access.allowed
        ? json(200, { user: toPublicUser(access.user) })
        : json(access.status || 401, { error: "Login required.", setupRequired: !(await hasOwner(client)) });
      return;
    }

    if (req.method === "POST" && action === "setup") {
      if (await hasOwner(client)) {
        context.res = json(409, { error: "Owner already exists." });
        return;
      }

      const setupCode = process.env.STAFFVOICE_SETUP_CODE;
      if (!setupCode || req.body?.setupCode !== setupCode) {
        context.res = json(403, { error: "Valid setup code required." });
        return;
      }

      const user = sanitizeUser({
        email: req.body?.email,
        name: req.body?.name || "Staff Voice owner",
        role: "owner",
        active: true
      });

      const password = String(req.body?.password || "");
      if (!user.email.includes("@") || password.length < 10) {
        context.res = json(400, { error: "Email and a password of at least 10 characters are required." });
        return;
      }

      Object.assign(user, hashPassword(password));
      await client.createEntity(user);
      context.res = json(201, { user: toPublicUser(user) }, { "set-cookie": createSessionCookie(user) });
      return;
    }

    if (req.method === "POST" && action === "login") {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      const user = await client.getEntity("users", email).catch((error) => {
        if (error.statusCode === 404) return null;
        throw error;
      });

      if (!user || !user.active || !verifyPassword(password, user.passwordSalt || user.salt, user.passwordHash)) {
        context.res = json(401, { error: "Invalid email or password." });
        return;
      }

      context.res = json(200, { user: toPublicUser(user) }, { "set-cookie": createSessionCookie(user) });
      return;
    }

    if (req.method === "POST" && action === "logout") {
      context.res = json(200, { ok: true }, { "set-cookie": clearSessionCookie() });
      return;
    }

    context.res = json(404, { error: "Auth route not found." });
  } catch (error) {
    context.log.error(error);
    context.res = json(500, {
      error: "Staff Voice auth is not ready.",
      detail: error.message
    });
  }
};
