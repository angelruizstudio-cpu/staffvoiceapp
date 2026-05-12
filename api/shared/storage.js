const { randomUUID } = require("crypto");
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const reportTableName = process.env.STAFFVOICE_TABLE_NAME || "StaffVoiceReports";
const userTableName = process.env.STAFFVOICE_USERS_TABLE_NAME || "StaffVoiceUsers";

function parseConnectionString(connectionString) {
  return Object.fromEntries(
    connectionString
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), part.slice(index + 1)];
      })
  );
}

function getTableClient(tableName = reportTableName) {
  const connectionString = process.env.STAFFVOICE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("Missing STAFFVOICE_STORAGE_CONNECTION_STRING application setting.");
  }

  const parsed = parseConnectionString(connectionString);
  if (parsed.AccountName && parsed.AccountKey) {
    const credential = new AzureNamedKeyCredential(parsed.AccountName, parsed.AccountKey);
    const endpoint = parsed.TableEndpoint || `https://${parsed.AccountName}.table.core.windows.net`;
    return new TableClient(endpoint, tableName, credential);
  }

  return TableClient.fromConnectionString(connectionString, tableName);
}

async function ensureTable(client) {
  try {
    await client.createTable();
  } catch (error) {
    if (error.statusCode !== 409) {
      throw error;
    }
  }
}

function sanitizeReport(input) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const privacyMode = input.privacyMode === "followup" ? "followup" : "anonymous";
  const shareCouncil = input.shareCouncil === "Yes" ? "Yes" : "No";

  return {
    partitionKey: "reports",
    rowKey: id,
    id,
    createdAt: now,
    updatedAt: now,
    status: "new",
    reportType: String(input.reportType || "").slice(0, 80),
    privacyMode,
    reportingFor: input.reportingFor === "other" ? "other" : "self",
    permission: String(input.permission || "").slice(0, 120),
    description: String(input.description || "").slice(0, 8000),
    area: String(input.area || "").slice(0, 180),
    urgency: String(input.urgency || "Routine").slice(0, 80),
    shareCouncil,
    contact: privacyMode === "followup" ? String(input.contact || "").slice(0, 240) : "",
    hrNotes: ""
  };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sanitizeUser(input) {
  const email = normalizeEmail(input.email);
  const now = new Date().toISOString();
  const role = input.role === "owner" ? "owner" : "hr";

  return {
    partitionKey: "users",
    rowKey: email,
    email,
    name: String(input.name || email).slice(0, 160),
    role,
    active: input.active !== false,
    createdAt: now,
    updatedAt: now
  };
}

function toPublicUser(entity) {
  return {
    email: entity.email,
    name: entity.name,
    role: entity.role,
    active: Boolean(entity.active),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  };
}

function toPublicReport(entity) {
  return {
    id: entity.id,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    status: entity.status,
    reportType: entity.reportType,
    privacyMode: entity.privacyMode,
    reportingFor: entity.reportingFor,
    permission: entity.permission,
    description: entity.description,
    area: entity.area,
    urgency: entity.urgency,
    shareCouncil: entity.shareCouncil,
    contact: entity.contact,
    hrNotes: entity.hrNotes || ""
  };
}

module.exports = {
  ensureTable,
  getTableClient,
  normalizeEmail,
  reportTableName,
  sanitizeReport,
  sanitizeUser,
  toPublicReport,
  toPublicUser,
  userTableName
};
