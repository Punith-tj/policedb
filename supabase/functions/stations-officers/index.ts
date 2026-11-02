/**
 * Edge Function: stations-officers
 *
 * CRUD operations for police_station and officer tables.
 *
 * ROUTES:
 *   GET    /stations                → List all stations
 *   GET    /stations/:id            → Get station by ID
 *   POST   /stations                → Create station
 *   PUT    /stations/:id            → Update station
 *   DELETE /stations/:id            → Delete station
 *   GET    /officers                → List officers (?station_id=N for filtering)
 *   GET    /officers/:id            → Get officer by ID
 *   POST   /officers                → Create officer
 *   PUT    /officers/:id            → Update officer
 *   DELETE /officers/:id            → Delete officer
 */

import { getConnection } from "../_shared/db.ts";
import { verifyAuth }    from "../_shared/auth.ts";
import {
  jsonResponse, corsResponse, handleError, NotFoundError,
} from "../_shared/errors.ts";
import {
  parseRoute, parseBody, parsePagination,
  requireFields, validatePositiveInt, validatePhone, validateMaxLength,
} from "../_shared/validation.ts";

// ============================================================
// Main Handler — Deno.serve entry point
// ============================================================
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") return corsResponse();

  let conn;
  try {
    // Verify JWT on every request
    await verifyAuth(req);

    // Open ONE MySQL connection for this request
    conn = await getConnection();

    // Parse the URL path
    const { segments, params } = parseRoute(req, "stations-officers");
    const method = req.method;

    // ---- /stations routes ----
    if (segments[0] === "stations") {
      // GET /stations — list all
      if (segments.length === 1 && method === "GET") {
        return await listStations(conn);
      }
      // POST /stations — create
      if (segments.length === 1 && method === "POST") {
        return await createStation(conn, req);
      }
      // GET /stations/:id — get by ID
      if (segments.length === 2 && method === "GET") {
        const id = validatePositiveInt(segments[1], "station_id");
        return await getStation(conn, id);
      }
      // PUT /stations/:id — update
      if (segments.length === 2 && method === "PUT") {
        const id = validatePositiveInt(segments[1], "station_id");
        return await updateStation(conn, id, req);
      }
      // DELETE /stations/:id — delete
      if (segments.length === 2 && method === "DELETE") {
        const id = validatePositiveInt(segments[1], "station_id");
        return await deleteStation(conn, id);
      }
    }

    // ---- /officers routes ----
    if (segments[0] === "officers") {
      // GET /officers — list (optional ?station_id filter)
      if (segments.length === 1 && method === "GET") {
        return await listOfficers(conn, params);
      }
      // POST /officers — create
      if (segments.length === 1 && method === "POST") {
        return await createOfficer(conn, req);
      }
      // GET /officers/:id — get by ID
      if (segments.length === 2 && method === "GET") {
        const id = validatePositiveInt(segments[1], "officer_id");
        return await getOfficer(conn, id);
      }
      // PUT /officers/:id — update
      if (segments.length === 2 && method === "PUT") {
        const id = validatePositiveInt(segments[1], "officer_id");
        return await updateOfficer(conn, id, req);
      }
      // DELETE /officers/:id — delete
      if (segments.length === 2 && method === "DELETE") {
        const id = validatePositiveInt(segments[1], "officer_id");
        return await deleteOfficer(conn, id);
      }
    }

    // No matching route
    return jsonResponse({ success: false, message: "Route not found." }, 404);

  } catch (error) {
    return handleError(error);
  } finally {
    // ALWAYS close connection, even if an error occurred
    if (conn) await conn.end();
  }
});

// ============================================================
// STATION Handlers
// ============================================================

/** GET /stations — List all police stations */
async function listStations(conn: any): Promise<Response> {
  const [rows] = await conn.execute(
    "SELECT station_id, station_name, location, contact_number FROM police_station ORDER BY station_id"
  );
  return jsonResponse({
    success: true,
    message: "Stations retrieved successfully.",
    data: rows,
  });
}

/** GET /stations/:id — Get a single station by ID */
async function getStation(conn: any, id: number): Promise<Response> {
  const [rows] = await conn.execute(
    "SELECT station_id, station_name, location, contact_number FROM police_station WHERE station_id = ?",
    [id]
  );
  if ((rows as any[]).length === 0) {
    throw new NotFoundError("Station not found.");
  }
  return jsonResponse({
    success: true,
    message: "Station retrieved successfully.",
    data: (rows as any[])[0],
  });
}

/** POST /stations — Create a new station */
async function createStation(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["station_name", "location", "contact_number"]);

  const stationName   = validateMaxLength(body.station_name,  "station_name",   100);
  const location      = validateMaxLength(body.location,      "location",       255);
  const contactNumber = validatePhone(body.contact_number, "contact_number");

  const [result] = await conn.execute(
    "INSERT INTO police_station (station_name, location, contact_number) VALUES (?, ?, ?)",
    [stationName, location, contactNumber]
  );

  return jsonResponse({
    success: true,
    message: "Station created successfully.",
    data: { station_id: (result as any).insertId },
  }, 201);
}

/** PUT /stations/:id — Update a station */
async function updateStation(conn: any, id: number, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["station_name", "location", "contact_number"]);

  const stationName   = validateMaxLength(body.station_name,  "station_name",   100);
  const location      = validateMaxLength(body.location,      "location",       255);
  const contactNumber = validatePhone(body.contact_number, "contact_number");

  const [result] = await conn.execute(
    "UPDATE police_station SET station_name = ?, location = ?, contact_number = ? WHERE station_id = ?",
    [stationName, location, contactNumber, id]
  );

  if ((result as any).affectedRows === 0) {
    throw new NotFoundError("Station not found.");
  }

  return jsonResponse({
    success: true,
    message: "Station updated successfully.",
  });
}

/** DELETE /stations/:id — Delete a station (RESTRICT will block if children exist) */
async function deleteStation(conn: any, id: number): Promise<Response> {
  // FK RESTRICT on officer and case_fir will prevent deletion
  // if the station has officers or FIRs. The error handler
  // converts errno 1451 to a readable message.
  const [result] = await conn.execute(
    "DELETE FROM police_station WHERE station_id = ?",
    [id]
  );

  if ((result as any).affectedRows === 0) {
    throw new NotFoundError("Station not found.");
  }

  return jsonResponse({
    success: true,
    message: "Station deleted successfully.",
  });
}

// ============================================================
// OFFICER Handlers
// ============================================================

/** GET /officers — List officers, optionally filtered by station_id */
async function listOfficers(conn: any, params: URLSearchParams): Promise<Response> {
  const stationId = params.get("station_id");

  let sql = `
    SELECT o.officer_id, o.name, o.designation, o.contact_number,
           o.station_id, ps.station_name
    FROM officer o
      INNER JOIN police_station ps ON o.station_id = ps.station_id
  `;
  const values: any[] = [];

  if (stationId) {
    sql += " WHERE o.station_id = ?";
    values.push(parseInt(stationId, 10));
  }

  sql += " ORDER BY o.officer_id";

  const [rows] = await conn.execute(sql, values);
  return jsonResponse({
    success: true,
    message: "Officers retrieved successfully.",
    data: rows,
  });
}

/** GET /officers/:id — Get a single officer with station info */
async function getOfficer(conn: any, id: number): Promise<Response> {
  const [rows] = await conn.execute(
    `SELECT o.officer_id, o.name, o.designation, o.contact_number,
            o.station_id, ps.station_name
     FROM officer o
       INNER JOIN police_station ps ON o.station_id = ps.station_id
     WHERE o.officer_id = ?`,
    [id]
  );

  if ((rows as any[]).length === 0) {
    throw new NotFoundError("Officer not found.");
  }

  return jsonResponse({
    success: true,
    message: "Officer retrieved successfully.",
    data: (rows as any[])[0],
  });
}

/** POST /officers — Create a new officer */
async function createOfficer(conn: any, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["name", "designation", "contact_number", "station_id"]);

  const name          = validateMaxLength(body.name,          "name",          100);
  const designation   = validateMaxLength(body.designation,   "designation",    75);
  const contactNumber = validatePhone(body.contact_number, "contact_number");
  const stationId     = validatePositiveInt(body.station_id,  "station_id");

  const [result] = await conn.execute(
    "INSERT INTO officer (name, designation, contact_number, station_id) VALUES (?, ?, ?, ?)",
    [name, designation, contactNumber, stationId]
  );

  return jsonResponse({
    success: true,
    message: "Officer created successfully.",
    data: { officer_id: (result as any).insertId },
  }, 201);
}

/** PUT /officers/:id — Update an officer */
async function updateOfficer(conn: any, id: number, req: Request): Promise<Response> {
  const body = await parseBody(req);
  requireFields(body, ["name", "designation", "contact_number", "station_id"]);

  const name          = validateMaxLength(body.name,          "name",          100);
  const designation   = validateMaxLength(body.designation,   "designation",    75);
  const contactNumber = validatePhone(body.contact_number, "contact_number");
  const stationId     = validatePositiveInt(body.station_id,  "station_id");

  const [result] = await conn.execute(
    "UPDATE officer SET name = ?, designation = ?, contact_number = ?, station_id = ? WHERE officer_id = ?",
    [name, designation, contactNumber, stationId, id]
  );

  if ((result as any).affectedRows === 0) {
    throw new NotFoundError("Officer not found.");
  }

  return jsonResponse({
    success: true,
    message: "Officer updated successfully.",
  });
}

/** DELETE /officers/:id — Delete an officer (RESTRICT blocks if FIRs/arrests exist) */
async function deleteOfficer(conn: any, id: number): Promise<Response> {
  const [result] = await conn.execute(
    "DELETE FROM officer WHERE officer_id = ?",
    [id]
  );

  if ((result as any).affectedRows === 0) {
    throw new NotFoundError("Officer not found.");
  }

  return jsonResponse({
    success: true,
    message: "Officer deleted successfully.",
  });
}

