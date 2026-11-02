/**
 * Edge Function: cases
 *
 * CRUD operations for the case_fir table.
 * Also provides assign-officer and close-case via stored procedures.
 *
 * ROUTES:
 *   GET    / or /cases                   → List FIRs (?status, ?station_id, ?officer_id, ?search, ?page, ?limit)
 *   GET    /:fir_number or /cases/:fir   → Get single FIR with officer and station info
 *   POST   / or /cases                   → Create FIR
 *   PUT    /:fir_number or /cases/:fir   → Update FIR
 *   DELETE /:fir_number or /cases/:fir   → Delete FIR
 *   POST   /:fir_number/assign-officer   → Assign officer (calls sp_assign_officer_to_case)
 *   POST   /:fir_number/close            → Close case (calls sp_close_case)
 */

import { getConnection } from "../_shared/db.ts";
import { verifyAuth }    from "../_shared/auth.ts";
import {
  jsonResponse, corsResponse, handleError, NotFoundError,
} from "../_shared/errors.ts";
import {
  parseRoute, parseBody, parsePagination,
  requireFields, validatePositiveInt, validateDate,
  validateFirNumber, validateStatus, validateMaxLength,
} from "../_shared/validation.ts";

// ============================================================
// Main Handler
// ============================================================
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return corsResponse();

  let conn: any = null;
  try {
    await verifyAuth(req);
    conn = await getConnection();

    const { segments, params } = parseRoute(req, "cases");
    const method = req.method;

    // Normalize route segments:
    // Allows both `/cases` and `/cases/cases`, or `/FIR-xxx` and `/cases/FIR-xxx`
    const segs = [...segments];
    if (segs.length > 0 && segs[0] === "cases") {
      segs.shift();
    }

    // GET / — list FIRs with filters
    if (segs.length === 0 && method === "GET") {
      return await listCases(conn, params);
    }

    // POST / — create FIR
    if (segs.length === 0 && method === "POST") {
      return await createCase(conn, req);
    }

    // Routes with fir_number in path: /:fir_number
    if (segs.length >= 1) {
      const firNumber = segs[0];

      // POST /:fir_number/assign-officer
      if (segs.length === 2 && segs[1] === "assign-officer" && method === "POST") {
        return await assignOfficer(conn, firNumber, req);
      }

      // POST /:fir_number/close
      if (segs.length === 2 && segs[1] === "close" && method === "POST") {
        return await closeCase(conn, firNumber);
      }

      // GET /:fir_number
      if (segs.length === 1 && method === "GET") {
        return await getCase(conn, firNumber);
      }

      // PUT /:fir_number
      if (segs.length === 1 && method === "PUT") {
        return await updateCase(conn, firNumber, req);
      }

      // DELETE /:fir_number
      if (segs.length === 1 && method === "DELETE") {
        return await deleteCase(conn, firNumber);
      }
    }

    return jsonResponse({ success: false, message: "Route not found." }, 404);

  } catch (error) {
    return handleError(error);
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error("Error closing connection:", (e as Error).message);
      }
    }
  }
});

// ============================================================
// Handlers
// ============================================================

/**
 * GET / — List FIRs with optional filters and pagination.
 * Query params: status, station_id, officer_id, search, page, limit.
 */
async function listCases(conn: any, params: URLSearchParams): Promise<Response> {
  const { limit, offset } = parsePagination(params);

  // Build dynamic WHERE clause based on query params
  const conditions: string[] = [];
  const values: any[] = [];

  const status    = params.get("status");
  const stationId = params.get("station_id");
  const officerId = params.get("officer_id");
  const search    = params.get("search");

  if (status) {
    conditions.push("cf.status = ?");
    values.push(status);
  }
  if (stationId) {
    conditions.push("cf.station_id = ?");
    values.push(parseInt(stationId, 10));
  }
  if (officerId) {
    conditions.push("cf.officer_id = ?");
    values.push(parseInt(officerId, 10));
  }
  if (search) {
    conditions.push(
      "(cf.fir_number LIKE ? OR cf.case_type LIKE ? OR cf.location LIKE ? OR cf.description LIKE ?)"
    );
    const term = `%${search}%`;
    values.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0
    ? "WHERE " + conditions.join(" AND ")
    : "";

  // Count total matching records (for pagination metadata)
  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM case_fir cf ${whereClause}`,
    values
  );
  const total = Number((countRows as any[])[0]?.total || 0);

  // Fetch the page of results using conn.query for reliable parameterized pagination
  const [rows] = await conn.query(
    `SELECT cf.fir_number, cf.case_type, cf.registration_date, cf.location,
            cf.description, cf.status, cf.officer_id, cf.station_id,
            o.name AS officer_name, ps.station_name
     FROM case_fir cf
       INNER JOIN officer o        ON cf.officer_id = o.officer_id
       INNER JOIN police_station ps ON cf.station_id = ps.station_id
     ${whereClause}
     ORDER BY cf.registration_date DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return jsonResponse({
    success: true,
    message: "Cases retrieved successfully.",
    data: rows,
    pagination: { total, limit, offset, page: Math.floor(offset / limit) + 1 },
  });
}

/** GET /:fir_number — Get a single FIR with officer and station info */
async function getCase(conn: any, firNumber: string): Promise<Response> {
  const [rows] = await conn.execute(
    `SELECT cf.fir_number, cf.case_type, cf.registration_date, cf.location,
            cf.description, cf.status, cf.officer_id, cf.station_id,
            o.name AS officer_name, o.designation AS officer_designation,
            ps.station_name, ps.location AS station_location
     FROM case_fir cf
       INNER JOIN officer o        ON cf.officer_id = o.officer_id
       INNER JOIN police_station ps ON cf.station_id = ps.station_id
     WHERE cf.fir_number = ?`,
    [firNumber]
  );

  if ((rows as any[]).length === 0) {
    throw new NotFoundError("FIR not found.");
  }

  return jsonResponse({
    success: true,
    message: "Case retrieved successfully.",
    data: (rows as any[])[0],
  });
}

/** POST / — Create a new FIR */
async function createCase(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, [
    "fir_number", "case_type", "registration_date",
    "location", "officer_id", "station_id",
  ]);

  const firNumber        = validateFirNumber(body.fir_number);
  const caseType         = validateMaxLength(body.case_type,  "case_type",  100);
  const registrationDate = validateDate(body.registration_date, "registration_date");
  const location         = validateMaxLength(body.location,   "location",   255);
  const description      = body.description ? String(body.description) : null;
  const status           = body.status ? validateStatus(body.status) : "Pending";
  const officerId        = validatePositiveInt(body.officer_id,  "officer_id");
  const stationId        = validatePositiveInt(body.station_id,  "station_id");

  await conn.execute(
    `INSERT INTO case_fir
       (fir_number, case_type, registration_date, location, description, status, officer_id, station_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [firNumber, caseType, registrationDate, location, description, status, officerId, stationId]
  );

  return jsonResponse({
    success: true,
    message: "FIR created successfully.",
    data: { fir_number: firNumber },
  }, 201);
}

/** PUT /:fir_number — Update an existing FIR */
async function updateCase(conn: any, firNumber: string, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, [
    "case_type", "registration_date", "location", "officer_id", "station_id",
  ]);

  const caseType         = validateMaxLength(body.case_type,  "case_type",  100);
  const registrationDate = validateDate(body.registration_date, "registration_date");
  const location         = validateMaxLength(body.location,   "location",   255);
  const description      = body.description !== undefined ? (body.description ? String(body.description) : null) : null;
  const status           = body.status ? validateStatus(body.status) : undefined;
  const officerId        = validatePositiveInt(body.officer_id,  "officer_id");
  const stationId        = validatePositiveInt(body.station_id,  "station_id");

  let sql = `UPDATE case_fir SET case_type = ?, registration_date = ?, location = ?,
             description = ?, officer_id = ?, station_id = ?`;
  const values: any[] = [caseType, registrationDate, location, description, officerId, stationId];

  if (status) {
    sql += ", status = ?";
    values.push(status);
  }

  sql += " WHERE fir_number = ?";
  values.push(firNumber);

  const [result] = await conn.execute(sql, values);

  if ((result as any).affectedRows === 0) {
    throw new NotFoundError("FIR not found.");
  }

  return jsonResponse({ success: true, message: "FIR updated successfully." });
}

/** DELETE /:fir_number — Delete a FIR (RESTRICT blocks if children exist) */
async function deleteCase(conn: any, firNumber: string): Promise<Response> {
  const [result] = await conn.execute(
    "DELETE FROM case_fir WHERE fir_number = ?",
    [firNumber]
  );

  if ((result as any).affectedRows === 0) {
    throw new NotFoundError("FIR not found.");
  }

  return jsonResponse({ success: true, message: "FIR deleted successfully." });
}

/**
 * POST /:fir_number/assign-officer — Assign an officer to a FIR.
 * Calls the stored procedure sp_assign_officer_to_case.
 * Uses conn.query to properly handle MySQL stored procedure call protocol.
 */
async function assignOfficer(conn: any, firNumber: string, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["officer_id"]);
  const officerId = validatePositiveInt(body.officer_id, "officer_id");

  // Call stored procedure via conn.query (handles CALL result packets reliably in mysql2)
  await conn.query("CALL sp_assign_officer_to_case(?, ?)", [firNumber, officerId]);

  return jsonResponse({
    success: true,
    message: "Officer assigned to case successfully.",
  });
}

/**
 * POST /:fir_number/close — Close a FIR.
 * Calls the stored procedure sp_close_case.
 * Uses conn.query to properly handle MySQL stored procedure call protocol.
 */
async function closeCase(conn: any, firNumber: string): Promise<Response> {
  // Call stored procedure via conn.query (handles CALL result packets reliably in mysql2)
  await conn.query("CALL sp_close_case(?)", [firNumber]);

  return jsonResponse({
    success: true,
    message: "Case closed successfully.",
  });
}
