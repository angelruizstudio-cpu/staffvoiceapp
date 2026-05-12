const { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } = require("crypto");
const {
  ensureTable,
  getTableClient,
  normalizeEmail,
  toPublicUser,
  userTableName
} = require("./storage");

const cookieName = "staffvoice_session";
const sessionHours = Number(process.env.STAFFVOICE_SESSION_HOURS || 8);

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  const secret = process.env.STAFFVOICE_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing STAFFVOICE_SESSION_SECRET application setting.");
  }
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function hashPassword(password, salt = randomBytes(16).toString("base64url")) {
  const hash = pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("base64url");
  return { salt, passwordHash: hash };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const actual = hashPassword(password, salt).passwordHash;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expectedHash);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function createSessionCookie(user) {
  const expiresAt = Date.now() + sessionHours * 60 * 60 * 1000;
  const payload = base64url(JSON.stringify({
    email: user.email,
    role: user.role,
    exp: expiresAt
  }));
  const signature = sign(payload);
  const maxAge = sessionHours * 60 * 60;
  return `${cookieName}=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function readSession(req) {
  const token = parseCookies(req)[cookieName];
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (sign(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.email || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

async function getUserAccess(req) {
  if (process.env.STAFFVOICE_ALLOW_LOCAL_ADMIN === "true") {
    return {
      allowed: true,
      user: { email: "local@example.test", name: "Local admin", role: "owner", active: true }
    };
  }

  const session = readSession(req);
  if (!session) {
    return { allowed: false, status: 401, user: null };
  }

  const client = getTableClient(userTableName);
  await ensureTable(client);

  try {
    const user = await client.getEntity("users", normalizeEmail(session.email));
    return {
      allowed: Boolean(user.active && ["owner", "hr"].includes(user.role)),
      status: user.active ? 200 : 403,
      user
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return { allowed: false, status: 403, user: null };
    }
    throw error;
  }
}

async function hasOwner(client) {
  for await (const entity of client.listEntities({ queryOptions: { filter: "PartitionKey eq 'users' and role eq 'owner'" } })) {
    if (entity.active) return true;
  }
  return false;
}

function requireOwner(access) {
  return access.allowed && access.user?.role === "owner";
}

module.exports = {
  clearSessionCookie,
  createSessionCookie,
  getUserAccess,
  hasOwner,
  hashPassword,
  requireOwner,
  toPublicUser,
  verifyPassword
};
