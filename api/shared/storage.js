const { createHash, randomBytes, randomUUID } = require("crypto");
const sql = require("mssql");

const reportTableName = process.env.STAFFVOICE_TABLE_NAME || "staffvoice_reports";
const userTableName = process.env.STAFFVOICE_USERS_TABLE_NAME || "staffvoice_users";
const commentTableName = process.env.STAFFVOICE_COMMENTS_TABLE_NAME || "staffvoice_case_comments";

let poolPromise;

function getConnectionString() {
  const value = process.env.AZURE_SQL_CONNECTION_STRING
    || process.env.STAFFVOICE_SQL_CONNECTION_STRING
    || process.env.SQLCONNSTR_STAFFVOICE;

  if (!value) {
    throw new Error("Missing AZURE_SQL_CONNECTION_STRING application setting.");
  }

  return value;
}

function quotedTableName(tableName) {
  const clean = String(tableName || "").trim();
  if (!/^[A-Za-z0-9_]+$/.test(clean)) {
    throw new Error(`Invalid table name: ${clean}`);
  }
  return `[dbo].[${clean}]`;
}

async function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getConnectionString()).connect();
  }
  return poolPromise;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function hashTrackingToken(token) {
  return createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function iso(value) {
  if (!value) return value;
  return value instanceof Date ? value.toISOString() : value;
}

function dateValue(value) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function mapDbError(error) {
  if (!error) return null;
  if (error.statusCode) return error;
  const mapped = new Error(error.message || "Database error.");
  mapped.code = error.code;
  mapped.number = error.number;
  return mapped;
}

function notFound(message = "Record not found.") {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
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
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
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
    publicStatusUpdatedAt: iso(row.public_status_updated_at),
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
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at)
  };
}

function addReportInputs(request, row) {
  request
    .input("id", sql.UniqueIdentifier, row.id)
    .input("created_at", sql.DateTimeOffset, dateValue(row.created_at))
    .input("updated_at", sql.DateTimeOffset, dateValue(row.updated_at))
    .input("status", sql.NVarChar(40), row.status)
    .input("report_type", sql.NVarChar(80), row.report_type)
    .input("privacy_mode", sql.NVarChar(20), row.privacy_mode)
    .input("reporting_for", sql.NVarChar(20), row.reporting_for)
    .input("permission", sql.NVarChar(120), row.permission)
    .input("description", sql.NVarChar(sql.MAX), row.description)
    .input("area", sql.NVarChar(180), row.area)
    .input("urgency", sql.NVarChar(80), row.urgency)
    .input("share_council", sql.NVarChar(3), row.share_council)
    .input("hr_follow_up", sql.NVarChar(3), row.hr_follow_up)
    .input("contact", sql.NVarChar(240), row.contact)
    .input("contact_method", sql.NVarChar(80), row.contact_method)
    .input("contact_best_time", sql.NVarChar(160), row.contact_best_time)
    .input("follow_up_notes", sql.NVarChar(1000), row.follow_up_notes)
    .input("tracking_token_hash", sql.NVarChar(64), row.tracking_token_hash)
    .input("public_status", sql.NVarChar(40), row.public_status)
    .input("public_message", sql.NVarChar(sql.MAX), row.public_message)
    .input("public_status_updated_at", sql.DateTimeOffset, dateValue(row.public_status_updated_at))
    .input("hr_notes", sql.NVarChar(sql.MAX), row.hr_notes);
  return request;
}

function addUserInputs(request, row) {
  request
    .input("email", sql.NVarChar(320), row.email)
    .input("name", sql.NVarChar(160), row.name)
    .input("role", sql.NVarChar(20), row.role)
    .input("active", sql.Bit, row.active)
    .input("password_salt", sql.NVarChar(120), row.password_salt)
    .input("password_hash", sql.NVarChar(120), row.password_hash)
    .input("created_at", sql.DateTimeOffset, dateValue(row.created_at))
    .input("updated_at", sql.DateTimeOffset, dateValue(row.updated_at));
  return request;
}

async function insertReport(tableName, row) {
  const pool = await getPool();
  await addReportInputs(pool.request(), row).query(`
    insert into ${quotedTableName(tableName)} (
      id, created_at, updated_at, status, report_type, privacy_mode, reporting_for,
      permission, description, area, urgency, share_council, hr_follow_up, contact,
      contact_method, contact_best_time, follow_up_notes, tracking_token_hash,
      public_status, public_message, public_status_updated_at, hr_notes
    ) values (
      @id, @created_at, @updated_at, @status, @report_type, @privacy_mode, @reporting_for,
      @permission, @description, @area, @urgency, @share_council, @hr_follow_up, @contact,
      @contact_method, @contact_best_time, @follow_up_notes, @tracking_token_hash,
      @public_status, @public_message, @public_status_updated_at, @hr_notes
    )
  `);
}

async function updateReport(tableName, row) {
  const pool = await getPool();
  const result = await addReportInputs(pool.request(), row).query(`
    update ${quotedTableName(tableName)}
    set created_at = @created_at,
        updated_at = @updated_at,
        status = @status,
        report_type = @report_type,
        privacy_mode = @privacy_mode,
        reporting_for = @reporting_for,
        permission = @permission,
        description = @description,
        area = @area,
        urgency = @urgency,
        share_council = @share_council,
        hr_follow_up = @hr_follow_up,
        contact = @contact,
        contact_method = @contact_method,
        contact_best_time = @contact_best_time,
        follow_up_notes = @follow_up_notes,
        tracking_token_hash = @tracking_token_hash,
        public_status = @public_status,
        public_message = @public_message,
        public_status_updated_at = @public_status_updated_at,
        hr_notes = @hr_notes
    where id = @id
  `);
  if (!result.rowsAffected[0]) throw notFound("Report not found.");
}

async function insertUser(tableName, row) {
  const pool = await getPool();
  await addUserInputs(pool.request(), row).query(`
    insert into ${quotedTableName(tableName)} (
      email, name, role, active, password_salt, password_hash, created_at, updated_at
    ) values (
      @email, @name, @role, @active, @password_salt, @password_hash, @created_at, @updated_at
    )
  `);
}

async function updateUser(tableName, row) {
  const pool = await getPool();
  const result = await addUserInputs(pool.request(), row).query(`
    update ${quotedTableName(tableName)}
    set name = @name,
        role = @role,
        active = @active,
        password_salt = @password_salt,
        password_hash = @password_hash,
        created_at = @created_at,
        updated_at = @updated_at
    where email = @email
  `);
  if (!result.rowsAffected[0]) throw notFound("User not found.");
}

function getTableClient(tableName = reportTableName) {
  const isUsers = tableName === userTableName;

  return {
    tableName,

    async createTable() {
      return undefined;
    },

    async createEntity(entity) {
      try {
        if (isUsers) {
          await insertUser(tableName, toUserRow(entity));
        } else {
          await insertReport(tableName, toReportRow(entity));
        }
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async getEntity(partitionKey, rowKey) {
      try {
        const pool = await getPool();
        const keyColumn = isUsers ? "email" : "id";
        const keyType = isUsers ? sql.NVarChar(320) : sql.UniqueIdentifier;
        const result = await pool.request()
          .input("key", keyType, rowKey)
          .query(`select * from ${quotedTableName(tableName)} where ${keyColumn} = @key`);

        if (!result.recordset.length) throw notFound(isUsers ? "User not found." : "Report not found.");
        return isUsers ? fromUserRow(result.recordset[0]) : fromReportRow(result.recordset[0]);
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async updateEntity(entity) {
      try {
        if (isUsers) {
          await updateUser(tableName, toUserRow(entity));
        } else {
          await updateReport(tableName, toReportRow(entity));
        }
      } catch (error) {
        throw mapDbError(error);
      }
    },

    async *listEntities() {
      try {
        const pool = await getPool();
        const orderBy = isUsers ? "email asc" : "created_at desc";
        const result = await pool.request().query(`select * from ${quotedTableName(tableName)} order by ${orderBy}`);
        for (const row of result.recordset || []) {
          yield isUsers ? fromUserRow(row) : fromReportRow(row);
        }
      } catch (error) {
        throw mapDbError(error);
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
  const urgency = String(input.urgency || "Routine feedback").slice(0, 80);
  const safetyTracking = ["Threat or safety concern", "Crime or illegal activity", "Immediate danger"].includes(urgency);
  const trackingToken = hrFollowUp === "Yes" || safetyTracking ? randomBytes(32).toString("base64url") : "";

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
    urgency,
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

function toCommentRow(entity) {
  return {
    id: entity.id,
    report_id: entity.reportId,
    created_at: entity.createdAt,
    created_by_email: normalizeEmail(entity.createdByEmail),
    created_by_name: entity.createdByName,
    visibility: entity.visibility,
    comment: entity.comment
  };
}

function fromCommentRow(row) {
  return {
    id: row.id,
    reportId: row.report_id,
    createdAt: iso(row.created_at),
    createdByEmail: row.created_by_email,
    createdByName: row.created_by_name,
    visibility: row.visibility,
    comment: row.comment
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

function sanitizeComment(input, user, reportId) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    reportId,
    createdAt: now,
    createdByEmail: normalizeEmail(user?.email),
    createdByName: String(user?.name || user?.email || "HR").slice(0, 160),
    visibility: input.visibility === "public" ? "public" : "internal",
    comment: String(input.comment || "").trim().slice(0, 4000)
  };
}

async function getReportByTrackingToken(token) {
  try {
    const tokenHash = hashTrackingToken(token);
    const pool = await getPool();
    const result = await pool.request()
      .input("tracking_token_hash", sql.NVarChar(64), tokenHash)
      .query(`select * from ${quotedTableName(reportTableName)} where tracking_token_hash = @tracking_token_hash`);

    if (!result.recordset.length) throw notFound("Tracking status not found.");
    return fromReportRow(result.recordset[0]);
  } catch (error) {
    throw mapDbError(error);
  }
}

async function createCaseComment(comment) {
  try {
    const row = toCommentRow(comment);
    const pool = await getPool();
    const result = await pool.request()
      .input("id", sql.UniqueIdentifier, row.id)
      .input("report_id", sql.UniqueIdentifier, row.report_id)
      .input("created_at", sql.DateTimeOffset, dateValue(row.created_at))
      .input("created_by_email", sql.NVarChar(320), row.created_by_email)
      .input("created_by_name", sql.NVarChar(160), row.created_by_name)
      .input("visibility", sql.NVarChar(20), row.visibility)
      .input("comment", sql.NVarChar(sql.MAX), row.comment)
      .query(`
        insert into ${quotedTableName(commentTableName)} (
          id, report_id, created_at, created_by_email, created_by_name, visibility, comment
        )
        output inserted.*
        values (
          @id, @report_id, @created_at, @created_by_email, @created_by_name, @visibility, @comment
        )
      `);

    return fromCommentRow(result.recordset[0]);
  } catch (error) {
    throw mapDbError(error);
  }
}

async function listCaseComments(reportId, { publicOnly = false } = {}) {
  try {
    const pool = await getPool();
    const visibilityFilter = publicOnly ? "and visibility = @visibility" : "";
    const request = pool.request().input("report_id", sql.UniqueIdentifier, reportId);
    if (publicOnly) request.input("visibility", sql.NVarChar(20), "public");
    const result = await request.query(`
      select * from ${quotedTableName(commentTableName)}
      where report_id = @report_id ${visibilityFilter}
      order by created_at asc
    `);

    return (result.recordset || []).map(fromCommentRow);
  } catch (error) {
    throw mapDbError(error);
  }
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

function toAdminComment(entity) {
  return {
    id: entity.id,
    reportId: entity.reportId,
    createdAt: entity.createdAt,
    createdByName: entity.createdByName,
    createdByEmail: entity.createdByEmail,
    visibility: entity.visibility,
    comment: entity.comment
  };
}

function toPublicComment(entity) {
  return {
    createdAt: entity.createdAt,
    createdByName: "HR",
    comment: entity.comment
  };
}

module.exports = {
  commentTableName,
  createCaseComment,
  ensureTable,
  getReportByTrackingToken,
  getTableClient,
  hashTrackingToken,
  listCaseComments,
  normalizeEmail,
  reportTableName,
  sanitizeComment,
  sanitizeReport,
  toAdminComment,
  toPublicComment,
  toPublicTrackingStatus,
  sanitizeUser,
  toPublicReport,
  toPublicUser,
  userTableName
};
