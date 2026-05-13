const { createHash, randomBytes, randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const reportTableName = process.env.STAFFVOICE_TABLE_NAME || "staffvoice_reports";
const userTableName = process.env.STAFFVOICE_USERS_TABLE_NAME || "staffvoice_users";

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.STAFFVOICE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.STAFFVOICE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY application setting.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashTrackingToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function toReportRow(entity) {
  return {
    id: entity.id,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
    status: entity.status,
    report_type: entity.reportType,
    privacy_mode: entity.privacyMode,
    reporting_for: entity.reportingFor,
    permission: entity.permission,
    description: entity.description,
    area: entity.area,
    urgency: entity.urgency,
    share_council: entity.shareCouncil,
    hr_follow_up: entity.hrFollowUp,
    contact: entity.contact,
    contact_method: entity.contactMethod,
    contact_best_time: entity.contactBestTime,
    follow_up_notes: entity.followUpNotes,
    tracking_token_hash: entity.trackingTokenHash,
    public_status: entity.publicStatus,
    public_message: entity.publicMessage,
    public_status_updated_at: entity.publicStatusUpdatedAt,
    hr_notes: entity.hrNotes || ""
  };
}

function fromReportRow(row) {
  return {
    partitionKey: "reports",
    rowKey: row.id,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    reportType: row.report_type,
    privacyMode: row.privacy_mode,
    reportingFor: row.reporting_for,
    permission: row.permission,
    description: row.description,
    area: row.area,
    urgency: row.urgency,
    shareCouncil: row.share_council,
    hrFollowUp: row.hr_follow_up,
    contact: row.contact,
    contactMethod: row.contact_method,
    contactBestTime: row.contact_best_time,
    followUpNotes: row.follow_up_notes,
    trackingTokenHash: row.tracking_token_hash,
    publicStatus: row.public_status || "received",
    publicMessage: row.public_message || "",
    publicStatusUpdatedAt: row.public_status_updated_at,
    hrNotes: row.hr_notes || ""
  };
}

function toUserRow(entity) {
  return {
    email: normalizeEmail(entity.email),
    name: entity.name,
    role: entity.role,
    active: Boolean(entity.active),
    password_salt: entity.passwordSalt || entity.salt,
    password_hash: entity.passwordHash,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt
  };
}

function fromUserRow(row) {
  return {
    partitionKey: "users",
    rowKey: row.email,
    email: row.email,
    name: row.name,
    role: row.role,
    active: Boolean(row.active),
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDbError(error) {
  if (!error) return null;
  const mapped = new Error(error.message || "Database error.");
  mapped.code = error.code;
  mapped.details = error.details;
  mapped.hint = error.hint;
  if (error.code === "PGRST116") mapped.statusCode = 404;
  return mapped;
}

function getTableClient(tableName = reportTableName) {
  const supabase = getSupabase();
  const isUsers = tableName === userTableName;

  return {
    tableName,

    async createTable() {
      return undefined;
    },

    async createEntity(entity) {
      const row = isUsers ? toUserRow(entity) : toReportRow(entity);
      const { error } = await supabase.from(tableName).insert(row);
      if (error) throw mapDbError(error);
    },

    async getEntity(partitionKey, rowKey) {
      const query = supabase
        .from(tableName)
        .select("*")
        .eq(isUsers ? "email" : "id", rowKey)
        .single();

      const { data, error } = await query;
      if (error) throw mapDbError(error);
      return isUsers ? fromUserRow(data) : fromReportRow(data);
    },

    async updateEntity(entity) {
      const row = isUsers ? toUserRow(entity) : toReportRow(entity);
      const keyColumn = isUsers ? "email" : "id";
      const keyValue = isUsers ? row.email : row.id;
      Object.keys(row).forEach((key) => {
        if (row[key] === undefined) delete row[key];
      });
      const { error } = await supabase.from(tableName).update(row).eq(keyColumn, keyValue);
      if (error) throw mapDbError(error);
    },

    async *listEntities() {
      let query = supabase.from(tableName).select("*");
      query = isUsers ? query.order("email", { ascending: true }) : query.order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw mapDbError(error);
      for (const row of data || []) {
        yield isUsers ? fromUserRow(row) : fromReportRow(row);
      }
    }
  };
}

async function ensureTable(client) {
  await client.createTable();
}

function sanitizeReport(input) {
  const now = new Date().toISOString();
  const id = randomUUID();
  const privacyMode = input.privacyMode === "followup" ? "followup" : "anonymous";
  const shareCouncil = input.shareCouncil === "Yes" ? "Yes" : "No";
  const hrFollowUp = input.hrFollowUp === "Yes" ? "Yes" : "No";
  const trackingToken = hrFollowUp === "Yes" ? randomBytes(32).toString("base64url") : "";

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
    hrFollowUp,
    contact: String(input.contact || "").slice(0, 240),
    contactMethod: String(input.contactMethod || "").slice(0, 80),
    contactBestTime: String(input.contactBestTime || "").slice(0, 160),
    followUpNotes: String(input.followUpNotes || "").slice(0, 1000),
    trackingToken,
    trackingTokenHash: trackingToken ? hashTrackingToken(trackingToken) : null,
    publicStatus: "received",
    publicMessage: "",
    publicStatusUpdatedAt: now,
    hrNotes: ""
  };
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
    hrFollowUp: entity.hrFollowUp,
    contact: entity.contact,
    contactMethod: entity.contactMethod,
    contactBestTime: entity.contactBestTime,
    followUpNotes: entity.followUpNotes,
    publicStatus: entity.publicStatus || "received",
    publicMessage: entity.publicMessage || "",
    publicStatusUpdatedAt: entity.publicStatusUpdatedAt,
    hrNotes: entity.hrNotes || ""
  };
}

async function getReportByTrackingToken(token) {
  const tokenHash = hashTrackingToken(token);
  const { data, error } = await getSupabase()
    .from(reportTableName)
    .select("*")
    .eq("tracking_token_hash", tokenHash)
    .single();

  if (error) throw mapDbError(error);
  return fromReportRow(data);
}

function toPublicTrackingStatus(entity) {
  return {
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
    publicStatus: entity.publicStatus || "received",
    publicMessage: entity.publicMessage || "",
    publicStatusUpdatedAt: entity.publicStatusUpdatedAt || entity.updatedAt,
    hrFollowUp: entity.hrFollowUp
  };
}

module.exports = {
  ensureTable,
  getReportByTrackingToken,
  getTableClient,
  hashTrackingToken,
  normalizeEmail,
  reportTableName,
  sanitizeReport,
  toPublicTrackingStatus,
  sanitizeUser,
  toPublicReport,
  toPublicUser,
  userTableName
};
