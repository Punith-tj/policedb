/**
 * Edge Function: reports
 *
 * Read-only reporting endpoints powered by views and aggregate queries.
 * No INSERT/UPDATE/DELETE — only SELECT.
 *
 * ROUTES:
 *   GET /dashboard-stats             → Aggregate stats for the dashboard
 *   GET /pending-cases               → All pending FIRs (vw_pending_cases)
 *   GET /solved-cases                → All solved FIRs (vw_solved_cases)
 *   GET /officer-workload            → Case load per officer (vw_officer_case_load)
 *   GET /station-summary             → Case summary per station (vw_station_case_summary)
 *   GET /fir-details/:fir_number     → Full FIR details (vw_fir_details)
 *   GET /criminal-history/:id        → Criminal record (vw_criminal_full_record + arrests)
 */

import { getConnection } from "../_shared/db.ts";
import { verifyAuth }    from "../_shared/auth.ts";
import {
  jsonResponse, corsResponse, handleError, NotFoundError,
} from "../_shared/errors.ts";
import {
  parseRoute, validatePositiveInt,
} from "../_shared/validation.ts";

// ============================================================
// Main Handler
// ============================================================
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  let conn;
  try {
    await verifyAuth(req);

    // Reports are read-only — reject non-GET methods
    if (req.method !== "GET") {
      return jsonResponse({ success: false, message: "Reports are read-only. Use GET." }, 405);
    }

    conn = await getConnection();
    const { segments } = parseRoute(req, "reports");

    // GET /dashboard-stats
    if (segments[0] === "dashboard-stats" && segments.length === 1) {
      return await getDashboardStats(conn);
    }

    // GET /pending-cases
    if (segments[0] === "pending-cases" && segments.length === 1) {
      return await getPendingCases(conn);
    }

    // GET /solved-cases
    if (segments[0] === "solved-cases" && segments.length === 1) {
      return await getSolvedCases(conn);
    }

    // GET /officer-workload
    if (segments[0] === "officer-workload" && segments.length === 1) {
      return await getOfficerWorkload(conn);
    }

    // GET /station-summary
    if (segments[0] === "station-summary" && segments.length === 1) {
      return await getStationSummary(conn);
    }

    // GET /fir-details/:fir_number
    if (segments[0] === "fir-details" && segments.length === 2) {
      return await getFirDetails(conn, segments[1]);
    }

    // GET /criminal-history/:id
    if (segments[0] === "criminal-history" && segments.length === 2) {
      const id = validatePositiveInt(segments[1], "criminal_id");
      return await getCriminalHistory(conn, id);
    }

    return jsonResponse({ success: false, message: "Report route not found." }, 404);

  } catch (error) {
    return handleError(error);
  } finally {
    if (conn) await conn.end();
  }
});

// ============================================================
// Report Handlers
// ============================================================

/**
 * GET /dashboard-stats — Aggregate statistics for the frontend dashboard.
 * Runs multiple queries on the SAME connection and assembles the result.
 *
 * Returns:
 *   totalFirs, pendingFirs, solvedFirs, closedFirs, investigationFirs,
 *   totalOfficers, totalCriminals,
 *   casesPerStation (array), casesByStatus (array)
 */
async function getDashboardStats(conn: any): Promise<Response> {
  // 1. FIR counts by status (single query using conditional aggregation)
  const [statusRows] = await conn.execute(`
    SELECT
      COUNT(*)                                                      AS totalFirs,
      SUM(CASE WHEN status = 'Pending'             THEN 1 ELSE 0 END) AS pendingFirs,
      SUM(CASE WHEN status = 'Under Investigation' THEN 1 ELSE 0 END) AS investigationFirs,
      SUM(CASE WHEN status = 'Solved'              THEN 1 ELSE 0 END) AS solvedFirs,
      SUM(CASE WHEN status = 'Closed'              THEN 1 ELSE 0 END) AS closedFirs
    FROM case_fir
  `);

  // 2. Total officers
  const [officerRows] = await conn.execute(
    "SELECT COUNT(*) AS totalOfficers FROM officer"
  );

  // 3. Total criminals
  const [criminalRows] = await conn.execute(
    "SELECT COUNT(*) AS totalCriminals FROM criminal"
  );

  // 4. Cases per station (for bar chart)
  const [stationRows] = await conn.execute(`
    SELECT ps.station_name, COUNT(cf.fir_number) AS case_count
    FROM police_station ps
      LEFT JOIN case_fir cf ON ps.station_id = cf.station_id
    GROUP BY ps.station_id, ps.station_name
    ORDER BY ps.station_name
  `);

  // 5. Cases by status (for pie/doughnut chart)
  const [byStatusRows] = await conn.execute(`
    SELECT status, COUNT(*) AS count
    FROM case_fir
    GROUP BY status
    ORDER BY FIELD(status, 'Pending', 'Under Investigation', 'Solved', 'Closed')
  `);

  const stats = (statusRows as any[])[0];

  return jsonResponse({
    success: true,
    message: "Dashboard stats retrieved successfully.",
    data: {
      totalFirs:          stats.totalFirs,
      pendingFirs:        stats.pendingFirs,
      investigationFirs:  stats.investigationFirs,
      solvedFirs:         stats.solvedFirs,
      closedFirs:         stats.closedFirs,
      totalOfficers:      (officerRows as any[])[0].totalOfficers,
      totalCriminals:     (criminalRows as any[])[0].totalCriminals,
      casesPerStation:    stationRows,
      casesByStatus:      byStatusRows,
    },
  });
}

/** GET /pending-cases — Uses vw_pending_cases view */
async function getPendingCases(conn: any): Promise<Response> {
  const [rows] = await conn.execute("SELECT * FROM vw_pending_cases ORDER BY registration_date DESC");
  return jsonResponse({
    success: true, message: "Pending cases retrieved successfully.", data: rows,
  });
}

/** GET /solved-cases — Uses vw_solved_cases view */
async function getSolvedCases(conn: any): Promise<Response> {
  const [rows] = await conn.execute("SELECT * FROM vw_solved_cases ORDER BY registration_date DESC");
  return jsonResponse({
    success: true, message: "Solved cases retrieved successfully.", data: rows,
  });
}

/** GET /officer-workload — Uses vw_officer_case_load view */
async function getOfficerWorkload(conn: any): Promise<Response> {
  const [rows] = await conn.execute(
    "SELECT * FROM vw_officer_case_load ORDER BY officer_name, case_status"
  );
  return jsonResponse({
    success: true, message: "Officer workload retrieved successfully.", data: rows,
  });
}

/** GET /station-summary — Uses vw_station_case_summary view */
async function getStationSummary(conn: any): Promise<Response> {
  const [rows] = await conn.execute("SELECT * FROM vw_station_case_summary ORDER BY station_name");
  return jsonResponse({
    success: true, message: "Station summary retrieved successfully.", data: rows,
  });
}

/**
 * GET /fir-details/:fir_number — Full FIR details.
 * Uses vw_fir_details for the main FIR info, then queries child tables
 * SEPARATELY to avoid Cartesian product duplicates.
 */
async function getFirDetails(conn: any, firNumber: string): Promise<Response> {
  // 1. Main FIR info from the view (1 row)
  const [firRows] = await conn.execute(
    "SELECT * FROM vw_fir_details WHERE fir_number = ?",
    [firNumber]
  );
  if ((firRows as any[]).length === 0) {
    throw new NotFoundError("FIR not found.");
  }

  // 2. Linked criminals (via case_criminal junction table)
  const [criminals] = await conn.execute(
    `SELECT c.criminal_id, c.name, c.age, c.gender, c.address
     FROM case_criminal cc
       INNER JOIN criminal c ON cc.criminal_id = c.criminal_id
     WHERE cc.fir_number = ?`,
    [firNumber]
  );

  // 3. Victims
  const [victims] = await conn.execute(
    "SELECT victim_id, name, age, gender, contact_number FROM victim WHERE fir_number = ?",
    [firNumber]
  );

  // 4. Witnesses
  const [witnesses] = await conn.execute(
    "SELECT witness_id, name, age, contact_number FROM witness WHERE fir_number = ?",
    [firNumber]
  );

  // 5. Evidence
  const [evidence] = await conn.execute(
    "SELECT evidence_id, evidence_type, description, collection_date FROM evidence WHERE fir_number = ?",
    [firNumber]
  );

  // 6. Arrests
  const [arrests] = await conn.execute(
    `SELECT a.arrest_id, a.arrest_date, a.location,
            c.name AS criminal_name, o.name AS arresting_officer
     FROM arrest a
       INNER JOIN criminal c ON a.criminal_id = c.criminal_id
       INNER JOIN officer o  ON a.officer_id  = o.officer_id
     WHERE a.fir_number = ?`,
    [firNumber]
  );

  return jsonResponse({
    success: true,
    message: "FIR details retrieved successfully.",
    data: {
      fir:        (firRows as any[])[0],
      criminals,
      victims,
      witnesses,
      evidence,
      arrests,
    },
  });
}

/**
 * GET /criminal-history/:id — Full criminal record.
 * Queries criminal profile, linked FIRs, and arrests SEPARATELY.
 */
async function getCriminalHistory(conn: any, id: number): Promise<Response> {
  // 1. Criminal profile
  const [crimRows] = await conn.execute(
    "SELECT criminal_id, name, age, gender, address FROM criminal WHERE criminal_id = ?",
    [id]
  );
  if ((crimRows as any[]).length === 0) {
    throw new NotFoundError("Criminal not found.");
  }

  // 2. Linked FIRs (from the view, filtered by criminal_id)
  const [firRows] = await conn.execute(
    `SELECT fir_number, case_type, case_status, registration_date, incident_location
     FROM vw_criminal_full_record
     WHERE criminal_id = ? AND fir_number IS NOT NULL`,
    [id]
  );

  // 3. Arrest records
  const [arrestRows] = await conn.execute(
    `SELECT a.arrest_id, a.arrest_date, a.location AS arrest_location,
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

