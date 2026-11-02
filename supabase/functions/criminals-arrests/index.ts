/**
 * Edge Function: criminals-arrests
 *
 * CRUD for criminal, arrest, and case_criminal (junction table).
 *
 * ROUTES:
 *   -- Criminals --
 *   GET    /criminals                       → List criminals (?search, ?page, ?limit)
 *   GET    /criminals/:id                   → Get criminal by ID
 *   GET    /criminals/:id/history           → Criminal history (linked FIRs + arrests)
 *   POST   /criminals                       → Create criminal
 *   PUT    /criminals/:id                   → Update criminal
 *   DELETE /criminals/:id                   → Delete criminal
 *
 *   -- Case-Criminal Links (M:N junction) --
 *   GET    /case-criminals/:fir_number      → Get criminals linked to a FIR
 *   POST   /case-criminals                  → Link criminal to FIR
 *   DELETE /case-criminals/:fir/:crim_id    → Unlink criminal from FIR
 *
 *   -- Arrests --
 *   GET    /arrests                         → List arrests (?fir_number, ?criminal_id, ?page, ?limit)
 *   GET    /arrests/:id                     → Get arrest by ID
 *   POST   /arrests                         → Create arrest
 *   PUT    /arrests/:id                     → Update arrest
 *   DELETE /arrests/:id                     → Delete arrest
 */

import { getConnection } from "../_shared/db.ts";
import { verifyAuth }    from "../_shared/auth.ts";
import {
  jsonResponse, corsResponse, handleError, NotFoundError,
} from "../_shared/errors.ts";
import {
  parseRoute, parseBody, parsePagination,
  requireFields, validatePositiveInt, validateDate,
  validateFirNumber, validateMaxLength, validateGender,
} from "../_shared/validation.ts";

// ============================================================
// Main Handler
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  let conn;
  try {
    await verifyAuth(req);
    conn = await getConnection();

    const { segments, params } = parseRoute(req, "criminals-arrests");
    const method = req.method;

    // ---- /criminals routes ----
    if (segments[0] === "criminals") {
      if (segments.length === 1 && method === "GET")  return await listCriminals(conn, params);
      if (segments.length === 1 && method === "POST") return await createCriminal(conn, req);
      if (segments.length === 2 && method === "GET") {
        const id = validatePositiveInt(segments[1], "criminal_id");
        return await getCriminal(conn, id);
      }
      if (segments.length === 2 && method === "PUT") {
        const id = validatePositiveInt(segments[1], "criminal_id");
        return await updateCriminal(conn, id, req);
      }
      if (segments.length === 2 && method === "DELETE") {
        const id = validatePositiveInt(segments[1], "criminal_id");
        return await deleteCriminal(conn, id);
      }
      // GET /criminals/:id/history
      if (segments.length === 3 && segments[2] === "history" && method === "GET") {
        const id = validatePositiveInt(segments[1], "criminal_id");
        return await getCriminalHistory(conn, id);
      }
    }

    // ---- /case-criminals routes ----
    if (segments[0] === "case-criminals") {
      // GET /case-criminals/:fir_number — criminals linked to a FIR
      if (segments.length === 2 && method === "GET") {
        return await getCaseCriminals(conn, segments[1]);
      }
      // POST /case-criminals — link criminal to FIR
      if (segments.length === 1 && method === "POST") {
        return await linkCriminal(conn, req);
      }
      // DELETE /case-criminals/:fir_number/:criminal_id — unlink
      if (segments.length === 3 && method === "DELETE") {
        const crimId = validatePositiveInt(segments[2], "criminal_id");
        return await unlinkCriminal(conn, segments[1], crimId);
      }
    }

    // ---- /arrests routes ----
    if (segments[0] === "arrests") {
      if (segments.length === 1 && method === "GET")  return await listArrests(conn, params);
      if (segments.length === 1 && method === "POST") return await createArrest(conn, req);
      if (segments.length === 2 && method === "GET") {
        const id = validatePositiveInt(segments[1], "arrest_id");
        return await getArrest(conn, id);
      }
      if (segments.length === 2 && method === "PUT") {
        const id = validatePositiveInt(segments[1], "arrest_id");
        return await updateArrest(conn, id, req);
      }
      if (segments.length === 2 && method === "DELETE") {
        const id = validatePositiveInt(segments[1], "arrest_id");
        return await deleteArrest(conn, id);
      }
    }

    return jsonResponse({ success: false, message: "Route not found." }, 404);

  } catch (error) {
    return handleError(error);
  } finally {
    if (conn) await conn.end();
  }
});

// ============================================================
// CRIMINAL Handlers
// ============================================================

/** GET /criminals — List with optional search and pagination */
async function listCriminals(conn: any, params: URLSearchParams): Promise<Response> {
  const { limit, offset } = parsePagination(params);
  const search = params.get("search");

  let whereClause = "";
  const values: any[] = [];

  if (search) {
    whereClause = "WHERE c.name LIKE ? OR c.address LIKE ?";
    const term = `%${search}%`;
    values.push(term, term);
  }

  // Total count
  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM criminal c ${whereClause}`, values
  );
  const total = (countRows as any[])[0].total;

  // Fetch page
  const [rows] = await conn.execute(
    `SELECT c.criminal_id, c.name, c.age, c.gender, c.address
     FROM criminal c ${whereClause}
     ORDER BY c.criminal_id
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return jsonResponse({
    success: true,
    message: "Criminals retrieved successfully.",
    data: rows,
    pagination: { total, limit, offset, page: Math.floor(offset / limit) + 1 },
  });
}

/** GET /criminals/:id */
async function getCriminal(conn: any, id: number): Promise<Response> {
  const [rows] = await conn.execute(
    "SELECT criminal_id, name, age, gender, address FROM criminal WHERE criminal_id = ?",
    [id]
  );
  if ((rows as any[]).length === 0) throw new NotFoundError("Criminal not found.");

  return jsonResponse({
    success: true,
    message: "Criminal retrieved successfully.",
    data: (rows as any[])[0],
  });
}

/**
 * GET /criminals/:id/history — Full criminal record.
 * Returns the criminal profile, linked FIRs, and arrest records
 * as SEPARATE arrays (not joined flat) to avoid duplicate rows.
 */
async function getCriminalHistory(conn: any, id: number): Promise<Response> {
  // 1. Criminal profile
  const [crimRows] = await conn.execute(
    "SELECT criminal_id, name, age, gender, address FROM criminal WHERE criminal_id = ?",
    [id]
  );
  if ((crimRows as any[]).length === 0) throw new NotFoundError("Criminal not found.");

  // 2. Linked FIRs (via case_criminal junction)
  const [firRows] = await conn.execute(
    `SELECT cf.fir_number, cf.case_type, cf.registration_date,
            cf.location, cf.status, ps.station_name
     FROM case_criminal cc
       INNER JOIN case_fir cf      ON cc.fir_number = cf.fir_number
       INNER JOIN police_station ps ON cf.station_id = ps.station_id
     WHERE cc.criminal_id = ?
     ORDER BY cf.registration_date DESC`,
    [id]
  );

  // 3. Arrest records (separate query — not joined with FIRs)
  const [arrestRows] = await conn.execute(
    `SELECT a.arrest_id, a.arrest_date, a.location,
            a.fir_number, o.name AS arresting_officer
     FROM arrest a
       INNER JOIN officer o ON a.officer_id = o.officer_id
     WHERE a.criminal_id = ?
     ORDER BY a.arrest_date DESC`,
    [id]
  );

  return jsonResponse({
    success: true,
    message: "Criminal history retrieved successfully.",
    data: {
      criminal: (crimRows as any[])[0],
      linked_cases: firRows,
      arrests: arrestRows,
    },
  });
}

/** POST /criminals — Create a criminal */
async function createCriminal(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["name", "age", "gender", "address"]);

  const name    = validateMaxLength(body.name,    "name",    100);
  const age     = validatePositiveInt(body.age,   "age");
  const gender  = validateGender(body.gender);
  const address = validateMaxLength(body.address, "address", 255);

  const [result] = await conn.execute(
    "INSERT INTO criminal (name, age, gender, address) VALUES (?, ?, ?, ?)",
    [name, age, gender, address]
  );

  return jsonResponse({
    success: true,
    message: "Criminal record created successfully.",
    data: { criminal_id: (result as any).insertId },
  }, 201);
}

/** PUT /criminals/:id — Update criminal */
async function updateCriminal(conn: any, id: number, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["name", "age", "gender", "address"]);

  const name    = validateMaxLength(body.name,    "name",    100);
  const age     = validatePositiveInt(body.age,   "age");
  const gender  = validateGender(body.gender);
  const address = validateMaxLength(body.address, "address", 255);

  const [result] = await conn.execute(
    "UPDATE criminal SET name = ?, age = ?, gender = ?, address = ? WHERE criminal_id = ?",
    [name, age, gender, address, id]
  );
  if ((result as any).affectedRows === 0) throw new NotFoundError("Criminal not found.");

  return jsonResponse({ success: true, message: "Criminal record updated successfully." });
}

/** DELETE /criminals/:id — RESTRICT blocks if linked to cases/arrests */
async function deleteCriminal(conn: any, id: number): Promise<Response> {
  const [result] = await conn.execute(
    "DELETE FROM criminal WHERE criminal_id = ?", [id]
  );
  if ((result as any).affectedRows === 0) throw new NotFoundError("Criminal not found.");
  return jsonResponse({ success: true, message: "Criminal record deleted successfully." });
}

// ============================================================
// CASE-CRIMINAL (Junction Table) Handlers
// ============================================================

/** GET /case-criminals/:fir_number — List criminals linked to a FIR */
async function getCaseCriminals(conn: any, firNumber: string): Promise<Response> {
  const [rows] = await conn.execute(
    `SELECT c.criminal_id, c.name, c.age, c.gender, c.address
     FROM case_criminal cc
       INNER JOIN criminal c ON cc.criminal_id = c.criminal_id
     WHERE cc.fir_number = ?
     ORDER BY c.name`,
    [firNumber]
  );
  return jsonResponse({
    success: true,
    message: "Case criminals retrieved successfully.",
    data: rows,
  });
}

/** POST /case-criminals — Link a criminal to a FIR */
async function linkCriminal(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["fir_number", "criminal_id"]);

  const firNumber  = validateFirNumber(body.fir_number);
  const criminalId = validatePositiveInt(body.criminal_id, "criminal_id");

  await conn.execute(
    "INSERT INTO case_criminal (fir_number, criminal_id) VALUES (?, ?)",
    [firNumber, criminalId]
  );

  return jsonResponse({
    success: true,
    message: "Criminal linked to case successfully.",
  }, 201);
}

/** DELETE /case-criminals/:fir_number/:criminal_id — Unlink */
async function unlinkCriminal(conn: any, firNumber: string, criminalId: number): Promise<Response> {
  const [result] = await conn.execute(
    "DELETE FROM case_criminal WHERE fir_number = ? AND criminal_id = ?",
    [firNumber, criminalId]
  );
  if ((result as any).affectedRows === 0) {
    throw new NotFoundError("Case-criminal link not found.");
  }
  return jsonResponse({ success: true, message: "Criminal unlinked from case successfully." });
}

// ============================================================
// ARREST Handlers
// ============================================================

/** GET /arrests — List arrests with optional filters */
async function listArrests(conn: any, params: URLSearchParams): Promise<Response> {
  const { limit, offset } = parsePagination(params);
  const firNumber  = params.get("fir_number");
  const criminalId = params.get("criminal_id");

  const conditions: string[] = [];
  const values: any[] = [];

  if (firNumber)  { conditions.push("a.fir_number = ?");  values.push(firNumber); }
  if (criminalId) { conditions.push("a.criminal_id = ?"); values.push(parseInt(criminalId, 10)); }

  const where = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM arrest a ${where}`, values
  );
  const total = (countRows as any[])[0].total;

  const [rows] = await conn.execute(
    `SELECT a.arrest_id, a.arrest_date, a.location,
            a.criminal_id, c.name AS criminal_name,
            a.fir_number, cf.case_type,
            a.officer_id, o.name AS arresting_officer
     FROM arrest a
       INNER JOIN criminal c  ON a.criminal_id = c.criminal_id
       INNER JOIN case_fir cf ON a.fir_number  = cf.fir_number
       INNER JOIN officer o   ON a.officer_id  = o.officer_id
     ${where}
     ORDER BY a.arrest_date DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return jsonResponse({
    success: true,
    message: "Arrests retrieved successfully.",
    data: rows,
    pagination: { total, limit, offset, page: Math.floor(offset / limit) + 1 },
  });
}

/** GET /arrests/:id — Get a single arrest */
async function getArrest(conn: any, id: number): Promise<Response> {
  const [rows] = await conn.execute(
    `SELECT a.arrest_id, a.arrest_date, a.location,
            a.criminal_id, c.name AS criminal_name,
            a.fir_number, cf.case_type,
            a.officer_id, o.name AS arresting_officer
     FROM arrest a
       INNER JOIN criminal c  ON a.criminal_id = c.criminal_id
       INNER JOIN case_fir cf ON a.fir_number  = cf.fir_number
       INNER JOIN officer o   ON a.officer_id  = o.officer_id
     WHERE a.arrest_id = ?`,
    [id]
  );
  if ((rows as any[]).length === 0) throw new NotFoundError("Arrest record not found.");

  return jsonResponse({
    success: true,
    message: "Arrest retrieved successfully.",
    data: (rows as any[])[0],
  });
}

/**
 * POST /arrests — Create an arrest.
 * NOTE: The BEFORE INSERT trigger (trg_block_arrest_on_closed_case)
 *       will reject this if the FIR is Closed.
 *       The AFTER INSERT trigger (trg_update_case_status_after_arrest)
 *       will auto-change Pending → Under Investigation.
 */
async function createArrest(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["arrest_date", "location", "criminal_id", "fir_number", "officer_id"]);

  const arrestDate = validateDate(body.arrest_date, "arrest_date");
  const location   = validateMaxLength(body.location, "location", 255);
  const criminalId = validatePositiveInt(body.criminal_id, "criminal_id");
  const firNumber  = validateFirNumber(body.fir_number);
  const officerId  = validatePositiveInt(body.officer_id,  "officer_id");

  const [result] = await conn.execute(
    `INSERT INTO arrest (arrest_date, location, criminal_id, fir_number, officer_id)
     VALUES (?, ?, ?, ?, ?)`,
    [arrestDate, location, criminalId, firNumber, officerId]
  );

  return jsonResponse({
    success: true,
    message: "Arrest recorded successfully.",
    data: { arrest_id: (result as any).insertId },
  }, 201);
}

/** PUT /arrests/:id — Update an arrest */
async function updateArrest(conn: any, id: number, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["arrest_date", "location", "criminal_id", "fir_number", "officer_id"]);

  const arrestDate = validateDate(body.arrest_date, "arrest_date");
  const location   = validateMaxLength(body.location, "location", 255);
  const criminalId = validatePositiveInt(body.criminal_id, "criminal_id");
  const firNumber  = validateFirNumber(body.fir_number);
  const officerId  = validatePositiveInt(body.officer_id,  "officer_id");

  const [result] = await conn.execute(
    `UPDATE arrest SET arrest_date = ?, location = ?, criminal_id = ?, fir_number = ?, officer_id = ?
     WHERE arrest_id = ?`,
    [arrestDate, location, criminalId, firNumber, officerId, id]
  );
  if ((result as any).affectedRows === 0) throw new NotFoundError("Arrest record not found.");

  return jsonResponse({ success: true, message: "Arrest record updated successfully." });
}

/** DELETE /arrests/:id */
async function deleteArrest(conn: any, id: number): Promise<Response> {
  const [result] = await conn.execute("DELETE FROM arrest WHERE arrest_id = ?", [id]);
  if ((result as any).affectedRows === 0) throw new NotFoundError("Arrest record not found.");
  return jsonResponse({ success: true, message: "Arrest record deleted successfully." });
}

