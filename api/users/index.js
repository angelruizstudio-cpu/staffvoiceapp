const {
  ensureTable,
  getTableClient,
  normalizeEmail,
  sanitizeUser,
  toPublicUser,
  userTableName
} = require("../shared/storage");
const { getUserAccess, requireOwner } = require("../shared/auth");

function json(status, body) {
  return {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  };
}

module.exports = async function (context, req) {
  try {
    const client = getTableClient(userTableName);
    await ensureTable(client);
    const access = await getUserAccess(req);

    if (!access.allowed) {
      context.res = json(403, {
        error: "Staff Voice access required.",
        signedInEmail: access.email || null
      });
      return;
    }

    if (req.method === "GET") {
      const users = [];
      for await (const entity of client.listEntities({ queryOptions: { filter: "PartitionKey eq 'users'" } })) {
        users.push(toPublicUser(entity));
      }

      users.sort((a, b) => a.email.localeCompare(b.email));
      context.res = json(200, { currentUser: toPublicUser(access.user), users });
      return;
    }

    if (!requireOwner(access)) {
      context.res = json(403, { error: "Owner access required to manage users." });
      return;
    }

    if (req.method === "POST") {
      const user = sanitizeUser(req.body || {});
      if (!user.email || !user.email.includes("@")) {
        context.res = json(400, { error: "A valid email is required." });
        return;
      }

      try {
        const existing = await client.getEntity("users", user.email);
        existing.name = user.name;
        existing.role = user.role;
        existing.active = user.active;
        existing.updatedAt = new Date().toISOString();
        await client.updateEntity(existing, "Merge");
        context.res = json(200, { user: toPublicUser(existing) });
      } catch (error) {
        if (error.statusCode !== 404) throw error;
        await client.createEntity(user);
        context.res = json(201, { user: toPublicUser(user) });
      }
      return;
    }

    if (req.method === "PATCH") {
      const email = normalizeEmail(decodeURIComponent(context.bindingData.email || ""));
      if (!email) {
        context.res = json(400, { error: "User email is required." });
        return;
      }

      const user = await client.getEntity("users", email);
      if (req.body?.active !== undefined) user.active = Boolean(req.body.active);
      if (req.body?.role === "owner" || req.body?.role === "hr") user.role = req.body.role;
      if (req.body?.name !== undefined) user.name = String(req.body.name || user.email).slice(0, 160);
      user.updatedAt = new Date().toISOString();
      await client.updateEntity(user, "Merge");
      context.res = json(200, { user: toPublicUser(user) });
      return;
    }

    context.res = json(405, { error: "Method not allowed." });
  } catch (error) {
    context.log.error(error);
    context.res = json(500, {
      error: "Staff Voice users API is not ready.",
      detail: error.message
    });
  }
};
