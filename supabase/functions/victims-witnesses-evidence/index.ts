/**
 * Edge Function: victims-witnesses-evidence
 *
 * CRUD operations for victim, witness, and evidence tables.
 * All three are linked to case_fir via fir_number (1:M).
 *
 * ROUTES:
 *   -- Victims --
 *   GET    /victims              → List victims (?fir_number filter, ?page, ?limit)
 *   GET    /victims/:id          → Get victim by ID
 *   POST   /victims              → Create victim
 *   PUT    /victims/:id          → Update victim
 *   DELETE /victims/:id          → Delete victim
 *
 *   -- Witnesses --
 *   GET    /witnesses            → List witnesses (?fir_number, ?page, ?limit)
 *   GET    /witnesses/:id        → Get witness by ID
 *   POST   /witnesses            → Create witness
 *   PUT    /witnesses/:id        → Update witness
 *   DELETE /witnesses/:id        → Delete witness
 *
 *   -- Evidence --
 *   GET    /evidence             → List evidence (?fir_number, ?page, ?limit)
 *   GET    /evidence/:id         → Get evidence by ID
 *   POST   /evidence             → Create evidence
 *   PUT    /evidence/:id         → Update evidence
 *   DELETE /evidence/:id         → Delete evidence
 */

import { getConnection } from "../_shared/db.ts";
import { verifyAuth }    from "../_shared/auth.ts";
import {
  jsonResponse, corsResponse, handleError, NotFoundError,
} from "../_shared/errors.ts";
import {
  parseRoute, parseBody, parsePagination,
  requireFields, validatePositiveInt, validateDate,
  validateFirNumber, validateMaxLength, validatePhone, validateGender,
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

    const { segments, params } = parseRoute(req, "victims-witnesses-evidence");
    const method = req.method;

    // ---- /victims routes ----
    if (segments[0] === "victims") {
      if (segments.length === 1 && method === "GET")  return await listVictims(conn, params);
      if (segments.length === 1 && method === "POST") return await createVictim(conn, req);
      if (segments.length === 2 && method === "GET") {
        return await getVictim(conn, validatePositiveInt(segments[1], "victim_id"));
      }
      if (segments.length === 2 && method === "PUT") {
        return await updateVictim(conn, validatePositiveInt(segments[1], "victim_id"), req);
      }
      if (segments.length === 2 && method === "DELETE") {
        return await deleteVictim(conn, validatePositiveInt(segments[1], "victim_id"));
      }
    }

    // ---- /witnesses routes ----
    if (segments[0] === "witnesses") {
      if (segments.length === 1 && method === "GET")  return await listWitnesses(conn, params);
      if (segments.length === 1 && method === "POST") return await createWitness(conn, req);
      if (segments.length === 2 && method === "GET") {
        return await getWitness(conn, validatePositiveInt(segments[1], "witness_id"));
      }
      if (segments.length === 2 && method === "PUT") {
        return await updateWitness(conn, validatePositiveInt(segments[1], "witness_id"), req);
      }
      if (segments.length === 2 && method === "DELETE") {
        return await deleteWitness(conn, validatePositiveInt(segments[1], "witness_id"));
      }
    }

    // ---- /evidence routes ----
    if (segments[0] === "evidence") {
      if (segments.length === 1 && method === "GET")  return await listEvidence(conn, params);
      if (segments.length === 1 && method === "POST") return await createEvidence(conn, req);
      if (segments.length === 2 && method === "GET") {
        return await getEvidence(conn, validatePositiveInt(segments[1], "evidence_id"));
      }
      if (segments.length === 2 && method === "PUT") {
        return await updateEvidence(conn, validatePositiveInt(segments[1], "evidence_id"), req);
      }
      if (segments.length === 2 && method === "DELETE") {
        return await deleteEvidence(conn, validatePositiveInt(segments[1], "evidence_id"));
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
// VICTIM Handlers
// ============================================================

async function listVictims(conn: any, params: URLSearchParams): Promise<Response> {
  const { limit, offset } = parsePagination(params);
  const firNumber = params.get("fir_number");

  let where = "";
  const values: any[] = [];
  if (firNumber) { where = "WHERE v.fir_number = ?"; values.push(firNumber); }

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM victim v ${where}`, values
  );
  const total = (countRows as any[])[0].total;

  const [rows] = await conn.execute(
    `SELECT v.victim_id, v.name, v.age, v.gender, v.contact_number,
            v.fir_number, cf.case_type
     FROM victim v
       INNER JOIN case_fir cf ON v.fir_number = cf.fir_number
     ${where}
     ORDER BY v.victim_id
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return jsonResponse({
    success: true, message: "Victims retrieved successfully.",
    data: rows, pagination: { total, limit, offset, page: Math.floor(offset / limit) + 1 },
  });
}

async function getVictim(conn: any, id: number): Promise<Response> {
  const [rows] = await conn.execute(
    `SELECT v.victim_id, v.name, v.age, v.gender, v.contact_number,
            v.fir_number, cf.case_type
     FROM victim v
       INNER JOIN case_fir cf ON v.fir_number = cf.fir_number
     WHERE v.victim_id = ?`,
    [id]
  );
  if ((rows as any[]).length === 0) throw new NotFoundError("Victim not found.");
  return jsonResponse({
    success: true, message: "Victim retrieved successfully.", data: (rows as any[])[0],
  });
}

async function createVictim(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["name", "age", "gender", "fir_number"]);

  const name    = validateMaxLength(body.name, "name", 100);
  const age     = validatePositiveInt(body.age, "age");
  const gender  = validateGender(body.gender);
  const contact = body.contact_number ? validatePhone(body.contact_number, "contact_number") : null;
  const fir     = validateFirNumber(body.fir_number);

  const [result] = await conn.execute(
    "INSERT INTO victim (name, age, gender, contact_number, fir_number) VALUES (?, ?, ?, ?, ?)",
    [name, age, gender, contact, fir]
  );

  return jsonResponse({
    success: true, message: "Victim record created successfully.",
    data: { victim_id: (result as any).insertId },
  }, 201);
}

async function updateVictim(conn: any, id: number, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["name", "age", "gender", "fir_number"]);

  const name    = validateMaxLength(body.name, "name", 100);
  const age     = validatePositiveInt(body.age, "age");
  const gender  = validateGender(body.gender);
  const contact = body.contact_number ? validatePhone(body.contact_number, "contact_number") : null;
  const fir     = validateFirNumber(body.fir_number);

  const [result] = await conn.execute(
    "UPDATE victim SET name = ?, age = ?, gender = ?, contact_number = ?, fir_number = ? WHERE victim_id = ?",
    [name, age, gender, contact, fir, id]
  );
  if ((result as any).affectedRows === 0) throw new NotFoundError("Victim not found.");
  return jsonResponse({ success: true, message: "Victim record updated successfully." });
}

async function deleteVictim(conn: any, id: number): Promise<Response> {
  const [result] = await conn.execute("DELETE FROM victim WHERE victim_id = ?", [id]);
  if ((result as any).affectedRows === 0) throw new NotFoundError("Victim not found.");
  return jsonResponse({ success: true, message: "Victim record deleted successfully." });
}

// ============================================================
// WITNESS Handlers
// ============================================================

async function listWitnesses(conn: any, params: URLSearchParams): Promise<Response> {
  const { limit, offset } = parsePagination(params);
  const firNumber = params.get("fir_number");

  let where = "";
  const values: any[] = [];
  if (firNumber) { where = "WHERE w.fir_number = ?"; values.push(firNumber); }

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM witness w ${where}`, values
  );
  const total = (countRows as any[])[0].total;

  const [rows] = await conn.execute(
    `SELECT w.witness_id, w.name, w.age, w.contact_number,
            w.fir_number, cf.case_type
     FROM witness w
       INNER JOIN case_fir cf ON w.fir_number = cf.fir_number
     ${where}
     ORDER BY w.witness_id
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return jsonResponse({
    success: true, message: "Witnesses retrieved successfully.",
    data: rows, pagination: { total, limit, offset, page: Math.floor(offset / limit) + 1 },
  });
}

async function getWitness(conn: any, id: number): Promise<Response> {
  const [rows] = await conn.execute(
    `SELECT w.witness_id, w.name, w.age, w.contact_number,
            w.fir_number, cf.case_type
     FROM witness w
       INNER JOIN case_fir cf ON w.fir_number = cf.fir_number
     WHERE w.witness_id = ?`,
    [id]
  );
  if ((rows as any[]).length === 0) throw new NotFoundError("Witness not found.");
  return jsonResponse({
    success: true, message: "Witness retrieved successfully.", data: (rows as any[])[0],
  });
}

async function createWitness(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["name", "age", "fir_number"]);

  const name    = validateMaxLength(body.name, "name", 100);
  const age     = validatePositiveInt(body.age, "age");
  const contact = body.contact_number ? validatePhone(body.contact_number, "contact_number") : null;
  const fir     = validateFirNumber(body.fir_number);

  const [result] = await conn.execute(
    "INSERT INTO witness (name, age, contact_number, fir_number) VALUES (?, ?, ?, ?)",
    [name, age, contact, fir]
  );

  return jsonResponse({
    success: true, message: "Witness record created successfully.",
    data: { witness_id: (result as any).insertId },
  }, 201);
}

async function updateWitness(conn: any, id: number, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["name", "age", "fir_number"]);

  const name    = validateMaxLength(body.name, "name", 100);
  const age     = validatePositiveInt(body.age, "age");
  const contact = body.contact_number ? validatePhone(body.contact_number, "contact_number") : null;
  const fir     = validateFirNumber(body.fir_number);

  const [result] = await conn.execute(
    "UPDATE witness SET name = ?, age = ?, contact_number = ?, fir_number = ? WHERE witness_id = ?",
    [name, age, contact, fir, id]
  );
  if ((result as any).affectedRows === 0) throw new NotFoundError("Witness not found.");
  return jsonResponse({ success: true, message: "Witness record updated successfully." });
}

async function deleteWitness(conn: any, id: number): Promise<Response> {
  const [result] = await conn.execute("DELETE FROM witness WHERE witness_id = ?", [id]);
  if ((result as any).affectedRows === 0) throw new NotFoundError("Witness not found.");
  return jsonResponse({ success: true, message: "Witness record deleted successfully." });
}

// ============================================================
// EVIDENCE Handlers
// ============================================================

async function listEvidence(conn: any, params: URLSearchParams): Promise<Response> {
  const { limit, offset } = parsePagination(params);
  const firNumber = params.get("fir_number");

  let where = "";
  const values: any[] = [];
  if (firNumber) { where = "WHERE e.fir_number = ?"; values.push(firNumber); }

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total FROM evidence e ${where}`, values
  );
  const total = (countRows as any[])[0].total;

  const [rows] = await conn.execute(
    `SELECT e.evidence_id, e.evidence_type, e.description, e.collection_date,
            e.fir_number, cf.case_type
     FROM evidence e
       INNER JOIN case_fir cf ON e.fir_number = cf.fir_number
     ${where}
     ORDER BY e.collection_date DESC
     LIMIT ? OFFSET ?`,
    [...values, limit, offset]
  );

  return jsonResponse({
    success: true, message: "Evidence retrieved successfully.",
    data: rows, pagination: { total, limit, offset, page: Math.floor(offset / limit) + 1 },
  });
}

async function getEvidence(conn: any, id: number): Promise<Response> {
  const [rows] = await conn.execute(
    `SELECT e.evidence_id, e.evidence_type, e.description, e.collection_date,
            e.fir_number, cf.case_type
     FROM evidence e
       INNER JOIN case_fir cf ON e.fir_number = cf.fir_number
     WHERE e.evidence_id = ?`,
    [id]
  );
  if ((rows as any[]).length === 0) throw new NotFoundError("Evidence not found.");
  return jsonResponse({
    success: true, message: "Evidence retrieved successfully.", data: (rows as any[])[0],
  });
}

async function createEvidence(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["evidence_type", "collection_date", "fir_number"]);

  const evidenceType  = validateMaxLength(body.evidence_type, "evidence_type", 100);
  const description   = body.description ? String(body.description) : null;
  const collectionDate = validateDate(body.collection_date, "collection_date");
  const fir           = validateFirNumber(body.fir_number);

  const [result] = await conn.execute(
    "INSERT INTO evidence (evidence_type, description, collection_date, fir_number) VALUES (?, ?, ?, ?)",
    [evidenceType, description, collectionDate, fir]
  );

  return jsonResponse({
    success: true, message: "Evidence record created successfully.",
    data: { evidence_id: (result as any).insertId },
  }, 201);
}

async function updateEvidence(conn: any, id: number, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["evidence_type", "collection_date", "fir_number"]);

  const evidenceType  = validateMaxLength(body.evidence_type, "evidence_type", 100);
  const description   = body.description !== undefined ? String(body.description) : null;
  const collectionDate = validateDate(body.collection_date, "collection_date");
  const fir           = validateFirNumber(body.fir_number);

  const [result] = await conn.execute(
    "UPDATE evidence SET evidence_type = ?, description = ?, collection_date = ?, fir_number = ? WHERE evidence_id = ?",
    [evidenceType, description, collectionDate, fir, id]
  );
  if ((result as any).affectedRows === 0) throw new NotFoundError("Evidence not found.");
  return jsonResponse({ success: true, message: "Evidence record updated successfully." });
}

async function deleteEvidence(conn: any, id: number): Promise<Response> {
  const [result] = await conn.execute("DELETE FROM evidence WHERE evidence_id = ?", [id]);
  if ((result as any).affectedRows === 0) throw new NotFoundError("Evidence not found.");
  return jsonResponse({ success: true, message: "Evidence record deleted successfully." });
}

