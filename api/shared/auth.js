const {
  ensureTable,
  getTableClient,
  normalizeEmail,
  userTableName
} = require("./storage");

function getClientPrincipal(req) {
  const encoded = req.headers["x-ms-client-principal"];
  if (!encoded) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function getPrincipalEmail(principal) {
  const claim = principal?.claims?.find((item) => (
    item.typ === "emails" ||
    item.typ === "preferred_username" ||
    item.typ === "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
  ));

  return normalizeEmail(claim?.val || principal?.userDetails || "");
}

async function ensureOwner(client) {
  const ownerEmail = normalizeEmail(process.env.STAFFVOICE_OWNER_EMAIL || "");
  if (!ownerEmail) return null;

  try {
    const owner = await client.getEntity("users", ownerEmail);
    if (owner.role !== "owner" || !owner.active) {
      owner.role = "owner";
      owner.active = true;
      owner.updatedAt = new Date().toISOString();
      await client.updateEntity(owner, "Merge");
    }
    return owner;
  } catch (error) {
    if (error.statusCode !== 404) throw error;
  }

  const now = new Date().toISOString();
  const owner = {
    partitionKey: "users",
    rowKey: ownerEmail,
    email: ownerEmail,
    name: "System owner",
    role: "owner",
    active: true,
    createdAt: now,
    updatedAt: now
  };
  await client.createEntity(owner);
  return owner;
}

async function getUserAccess(req) {
  const principal = getClientPrincipal(req);
  const email = getPrincipalEmail(principal);
  const client = getTableClient(userTableName);
  await ensureTable(client);
  await ensureOwner(client);

  if (process.env.STAFFVOICE_ALLOW_LOCAL_ADMIN === "true") {
    return {
      allowed: true,
      user: { email: "local@example.test", name: "Local admin", role: "owner", active: true },
      principal
    };
  }

  if (!email) {
    return { allowed: false, user: null, principal };
  }

  try {
    const user = await client.getEntity("users", email);
    return {
      allowed: Boolean(user.active && ["owner", "hr"].includes(user.role)),
      user,
      principal
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return { allowed: false, user: null, principal, email };
    }
    throw error;
  }
}

function requireOwner(access) {
  return access.allowed && access.user?.role === "owner";
}

module.exports = {
  getClientPrincipal,
  getPrincipalEmail,
  getUserAccess,
  requireOwner
};
