/**
 * server.js — Police Record Management System (Local Server)
 *
 * Runs locally on your laptop. No Supabase or cloud required.
 * Connects directly to local MySQL at localhost:3306.
 * Serves both the REST API and the Frontend website on http://localhost:8080.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

let mysql;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  console.warn("Notice: mysql2 not found. Run 'npm install' to enable live MySQL queries.");
}

const PORT = process.env.PORT || 8080;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

// ============================================================
// 1. LOCAL MYSQL CONFIGURATION
// ============================================================
const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'Punith@2006', // Change to your local MySQL password if different
  database: 'police_records_db',
  decimalNumbers: true,
};

let pool = null;

async function initDb() {
  if (!mysql) return;
  try {
    pool = mysql.createPool({ ...DB_CONFIG, waitForConnections: true, connectionLimit: 10 });
    // Test connection
    const conn = await pool.getConnection();
    console.log(`[Database] ✓ Connected to local MySQL at ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
    conn.release();
  } catch (err) {
    console.warn(`[Database] ⚠️ Notice: Could not connect to local MySQL (${err.message})`);
    console.warn(`[Database] The server will still run! You can use the web app while starting MySQL.`);
    pool = null;
  }
}

initDb();

// ============================================================
// 2. STATIC FILE MIME TYPES
// ============================================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// ============================================================
// 3. HTTP SERVER & API ROUTER
// ============================================================
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // ----------------------------------------------------------
  // API ROUTING: /functions/v1/...
  // ----------------------------------------------------------
  if (pathname.startsWith('/functions/v1/')) {
    try {
      const result = await handleApi(req, pathname.replace('/functions/v1/', ''), url.searchParams);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      console.error(`[API Error] ${req.method} ${pathname}:`, err.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  // ----------------------------------------------------------
  // STATIC FRONTEND FILE SERVING
  // ----------------------------------------------------------
  let reqFile = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(FRONTEND_DIR, reqFile));

  if (!filePath.startsWith(FRONTEND_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${pathname}`);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

// ============================================================
// 4. API HANDLER (DIRECT RAW SQL TO LOCAL MYSQL)
// ============================================================
async function handleApi(req, subPath, params) {
  if (!pool) {
    throw new Error("Local MySQL database is not connected. Make sure MySQL is running on port 3306.");
  }

  const method = req.method;
  const body = ['POST', 'PUT'].includes(method) ? await parseBody(req) : {};
  const segs = subPath.split('/').filter(Boolean);

  const resource = segs[0];

  // ---- 1. STATIONS & OFFICERS ----
  if (resource === 'stations-officers') {
    const table = segs[1];
    const id = segs[2];

    if (table === 'stations') {
      if (method === 'GET' && !id) {
        const [rows] = await pool.query('SELECT * FROM police_station ORDER BY station_id');
        return { data: rows };
      }
      if (method === 'POST') {
        const [r] = await pool.query(
          'INSERT INTO police_station (station_name, location, contact_number) VALUES (?, ?, ?)',
          [body.station_name, body.location, body.contact_number]
        );
        return { data: { station_id: r.insertId } };
      }
      if (method === 'PUT' && id) {
        await pool.query(
          'UPDATE police_station SET station_name = ?, location = ?, contact_number = ? WHERE station_id = ?',
          [body.station_name, body.location, body.contact_number, id]
        );
        return { message: 'Updated' };
      }
      if (method === 'DELETE' && id) {
        await pool.query('DELETE FROM police_station WHERE station_id = ?', [id]);
        return { message: 'Deleted' };
      }
    }

    if (table === 'officers') {
      if (method === 'GET' && !id) {
        const [rows] = await pool.query(`
          SELECT o.*, ps.station_name 
          FROM officer o 
          JOIN police_station ps ON o.station_id = ps.station_id 
          ORDER BY o.officer_id
        `);
        return { data: rows };
      }
      if (method === 'POST') {
        const [r] = await pool.query(
          'INSERT INTO officer (name, designation, contact_number, station_id) VALUES (?, ?, ?, ?)',
          [body.name, body.designation, body.contact_number, body.station_id]
        );
        return { data: { officer_id: r.insertId } };
      }
      if (method === 'PUT' && id) {
        await pool.query(
          'UPDATE officer SET name = ?, designation = ?, contact_number = ?, station_id = ? WHERE officer_id = ?',
          [body.name, body.designation, body.contact_number, body.station_id, id]
        );
        return { message: 'Updated' };
      }
      if (method === 'DELETE' && id) {
        await pool.query('DELETE FROM officer WHERE officer_id = ?', [id]);
        return { message: 'Deleted' };
      }
    }
  }

  // ---- 2. CASES (FIRs) ----
  if (resource === 'cases') {
    let sub = segs.slice(1);
    if (sub[0] === 'cases') sub.shift();

    const fir = sub[0] ? decodeURIComponent(sub[0]) : null;
    const action = sub[1];

    if (method === 'GET' && !fir) {
      const [rows] = await pool.query(`
        SELECT cf.*, o.name AS officer_name, ps.station_name 
        FROM case_fir cf 
        JOIN officer o ON cf.officer_id = o.officer_id 
        JOIN police_station ps ON cf.station_id = ps.station_id 
        ORDER BY cf.registration_date DESC
      `);
      return { data: rows };
    }
    if (method === 'POST' && !fir) {
      await pool.query(
        'INSERT INTO case_fir (fir_number, case_type, registration_date, location, description, status, officer_id, station_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [body.fir_number, body.case_type, body.registration_date, body.location, body.description, body.status || 'Pending', body.officer_id, body.station_id]
      );
      return { data: { fir_number: body.fir_number } };
    }
    if (action === 'assign-officer' && method === 'POST') {
      await pool.query('CALL sp_assign_officer_to_case(?, ?)', [fir, body.officer_id]);
      return { message: 'Officer assigned via stored procedure sp_assign_officer_to_case' };
    }
    if (action === 'close' && method === 'POST') {
      await pool.query('CALL sp_close_case(?)', [fir]);
      return { message: 'Case closed via stored procedure sp_close_case' };
    }
    if (method === 'GET' && fir) {
      const [rows] = await pool.query(`
        SELECT cf.*, o.name AS officer_name, o.designation AS officer_designation, ps.station_name 
        FROM case_fir cf 
        JOIN officer o ON cf.officer_id = o.officer_id 
        JOIN police_station ps ON cf.station_id = ps.station_id 
        WHERE cf.fir_number = ?
      `, [fir]);
      return { data: rows[0] };
    }
    if (method === 'PUT' && fir) {
      await pool.query(
        'UPDATE case_fir SET case_type = ?, registration_date = ?, location = ?, description = ?, status = ?, officer_id = ?, station_id = ? WHERE fir_number = ?',
        [body.case_type, body.registration_date, body.location, body.description, body.status, body.officer_id, body.station_id, fir]
      );
      return { message: 'Updated' };
    }
    if (method === 'DELETE' && fir) {
      await pool.query('DELETE FROM case_fir WHERE fir_number = ?', [fir]);
      return { message: 'Deleted' };
    }
  }

  // ---- 3. CRIMINALS & ARRESTS ----
  if (resource === 'criminals-arrests') {
    const sub = segs[1];
    const id = segs[2];

    if (sub === 'criminals') {
      if (method === 'GET' && !id) {
        const [rows] = await pool.query('SELECT * FROM criminal ORDER BY criminal_id');
        return { data: rows };
      }
      if (method === 'POST') {
        const [r] = await pool.query(
          'INSERT INTO criminal (name, age, gender, address) VALUES (?, ?, ?, ?)',
          [body.name, body.age, body.gender, body.address]
        );
        return { data: { criminal_id: r.insertId } };
      }
      if (method === 'GET' && id && segs[3] === 'history') {
        const [crim] = await pool.query('SELECT * FROM criminal WHERE criminal_id = ?', [id]);
        const [cases] = await pool.query(
          'SELECT cf.*, ps.station_name FROM case_criminal cc JOIN case_fir cf ON cc.fir_number = cf.fir_number JOIN police_station ps ON cf.station_id = ps.station_id WHERE cc.criminal_id = ?',
          [id]
        );
        const [arrests] = await pool.query(
          'SELECT a.*, o.name AS arresting_officer FROM arrest a JOIN officer o ON a.officer_id = o.officer_id WHERE a.criminal_id = ?',
          [id]
        );
        return { data: { criminal: crim[0], linked_cases: cases, arrests } };
      }
      if (method === 'PUT' && id) {
        await pool.query(
          'UPDATE criminal SET name = ?, age = ?, gender = ?, address = ? WHERE criminal_id = ?',
          [body.name, body.age, body.gender, body.address, id]
        );
        return { message: 'Updated' };
      }
      if (method === 'DELETE' && id) {
        await pool.query('DELETE FROM criminal WHERE criminal_id = ?', [id]);
        return { message: 'Deleted' };
      }
    }

    if (sub === 'case-criminals') {
      const fir = decodeURIComponent(segs[2]);
      const cid = segs[3];
      if (method === 'GET') {
        const [rows] = await pool.query(
          'SELECT c.* FROM case_criminal cc JOIN criminal c ON cc.criminal_id = c.criminal_id WHERE cc.fir_number = ?',
          [fir]
        );
        return { data: rows };
      }
      if (method === 'POST') {
        await pool.query('INSERT INTO case_criminal (fir_number, criminal_id) VALUES (?, ?)', [body.fir_number, body.criminal_id]);
        return { message: 'Linked' };
      }
      if (method === 'DELETE') {
        await pool.query('DELETE FROM case_criminal WHERE fir_number = ? AND criminal_id = ?', [fir, cid]);
        return { message: 'Unlinked' };
      }
    }

    if (sub === 'arrests') {
      if (method === 'GET' && !id) {
        const [rows] = await pool.query(`
          SELECT a.*, c.name AS criminal_name, cf.case_type, o.name AS arresting_officer 
          FROM arrest a 
          JOIN criminal c ON a.criminal_id = c.criminal_id 
          JOIN case_fir cf ON a.fir_number = cf.fir_number 
          JOIN officer o ON a.officer_id = o.officer_id 
          ORDER BY a.arrest_date DESC
        `);
        return { data: rows };
      }
      if (method === 'POST') {
        const [r] = await pool.query(
          'INSERT INTO arrest (arrest_date, location, criminal_id, fir_number, officer_id) VALUES (?, ?, ?, ?, ?)',
          [body.arrest_date, body.location, body.criminal_id, body.fir_number, body.officer_id]
        );
        return { data: { arrest_id: r.insertId } };
      }
      if (method === 'PUT' && id) {
        await pool.query(
          'UPDATE arrest SET arrest_date = ?, location = ?, criminal_id = ?, fir_number = ?, officer_id = ? WHERE arrest_id = ?',
          [body.arrest_date, body.location, body.criminal_id, body.fir_number, body.officer_id, id]
        );
        return { message: 'Updated' };
      }
      if (method === 'DELETE' && id) {
        await pool.query('DELETE FROM arrest WHERE arrest_id = ?', [id]);
        return { message: 'Deleted' };
      }
    }
  }

  // ---- 4. VICTIMS, WITNESSES, EVIDENCE ----
  if (resource === 'victims-witnesses-evidence') {
    const sub = segs[1];
    const id = segs[2];

    if (sub === 'victims') {
      if (method === 'GET') {
        const [rows] = await pool.query('SELECT v.*, cf.case_type FROM victim v JOIN case_fir cf ON v.fir_number = cf.fir_number');
        return { data: rows };
      }
      if (method === 'POST') {
        const [r] = await pool.query(
          'INSERT INTO victim (name, age, gender, contact_number, fir_number) VALUES (?, ?, ?, ?, ?)',
          [body.name, body.age, body.gender, body.contact_number, body.fir_number]
        );
        return { data: { victim_id: r.insertId } };
      }
      if (method === 'DELETE') {
        await pool.query('DELETE FROM victim WHERE victim_id = ?', [id]);
        return { message: 'Deleted' };
      }
    }

    if (sub === 'witnesses') {
      if (method === 'GET') {
        const [rows] = await pool.query('SELECT w.*, cf.case_type FROM witness w JOIN case_fir cf ON w.fir_number = cf.fir_number');
        return { data: rows };
      }
      if (method === 'POST') {
        const [r] = await pool.query(
          'INSERT INTO witness (name, age, contact_number, fir_number) VALUES (?, ?, ?, ?)',
          [body.name, body.age, body.contact_number, body.fir_number]
        );
        return { data: { witness_id: r.insertId } };
      }
      if (method === 'DELETE') {
        await pool.query('DELETE FROM witness WHERE witness_id = ?', [id]);
        return { message: 'Deleted' };
      }
    }

    if (sub === 'evidence') {
      if (method === 'GET') {
        const [rows] = await pool.query('SELECT e.*, cf.case_type FROM evidence e JOIN case_fir cf ON e.fir_number = cf.fir_number');
        return { data: rows };
      }
      if (method === 'POST') {
        const [r] = await pool.query(
          'INSERT INTO evidence (evidence_type, description, collection_date, fir_number) VALUES (?, ?, ?, ?)',
          [body.evidence_type, body.description, body.collection_date, body.fir_number]
        );
        return { data: { evidence_id: r.insertId } };
      }
      if (method === 'DELETE') {
        await pool.query('DELETE FROM evidence WHERE evidence_id = ?', [id]);
        return { message: 'Deleted' };
      }
    }
  }

  // ---- 5. REPORTS (SQL VIEWS) ----
  if (resource === 'reports') {
    const sub = segs[1];

    if (sub === 'dashboard-stats') {
      const [[firs]] = await pool.query(`
        SELECT 
          COUNT(*) AS totalFirs, 
          SUM(status='Pending') AS pendingFirs, 
          SUM(status='Under Investigation') AS investigationFirs, 
          SUM(status='Solved') AS solvedFirs, 
          SUM(status='Closed') AS closedFirs 
        FROM case_fir
      `);
      const [[off]] = await pool.query('SELECT COUNT(*) AS totalOfficers FROM officer');
      const [[crim]] = await pool.query('SELECT COUNT(*) AS totalCriminals FROM criminal');
      const [stationCases] = await pool.query(`
        SELECT ps.station_name, COUNT(cf.fir_number) AS case_count 
        FROM police_station ps 
        LEFT JOIN case_fir cf ON ps.station_id = cf.station_id 
        GROUP BY ps.station_id, ps.station_name
      `);
      const [statusCases] = await pool.query('SELECT status, COUNT(*) AS count FROM case_fir GROUP BY status');

      return {
        data: {
          totalFirs: firs.totalFirs || 0,
          pendingFirs: firs.pendingFirs || 0,
          investigationFirs: firs.investigationFirs || 0,
          solvedFirs: firs.solvedFirs || 0,
          closedFirs: firs.closedFirs || 0,
          totalOfficers: off.totalOfficers || 0,
          totalCriminals: crim.totalCriminals || 0,
          casesPerStation: stationCases,
          casesByStatus: statusCases,
        }
      };
    }

    if (sub === 'station-summary') {
      const [rows] = await pool.query('SELECT * FROM vw_station_case_summary');
      return { data: rows };
    }

    if (sub === 'officer-workload') {
      const [rows] = await pool.query('SELECT * FROM vw_officer_case_load');
      return { data: rows };
    }

    if (sub === 'pending-cases') {
      const [rows] = await pool.query('SELECT * FROM vw_pending_cases');
      return { data: rows };
    }

    if (sub === 'solved-cases') {
      const [rows] = await pool.query('SELECT * FROM vw_solved_cases');
      return { data: rows };
    }

    if (sub === 'fir-details') {
      const fir = decodeURIComponent(segs[2]);
      const [firRows] = await pool.query('SELECT * FROM vw_fir_details WHERE fir_number = ?', [fir]);
      const [criminals] = await pool.query('SELECT c.* FROM case_criminal cc JOIN criminal c ON cc.criminal_id = c.criminal_id WHERE cc.fir_number = ?', [fir]);
      const [victims] = await pool.query('SELECT * FROM victim WHERE fir_number = ?', [fir]);
      const [witnesses] = await pool.query('SELECT * FROM witness WHERE fir_number = ?', [fir]);
      const [evidence] = await pool.query('SELECT * FROM evidence WHERE fir_number = ?', [fir]);
      const [arrests] = await pool.query(`
        SELECT a.*, c.name AS criminal_name, o.name AS arresting_officer 
        FROM arrest a 
        JOIN criminal c ON a.criminal_id = c.criminal_id 
        JOIN officer o ON a.officer_id = o.officer_id 
        WHERE a.fir_number = ?
      `, [fir]);

      return {
        data: {
          fir: firRows[0],
          criminals,
          victims,
          witnesses,
          evidence,
          arrests,
        }
      };
    }

    if (sub === 'criminal-history') {
      const id = segs[2];
      const [crim] = await pool.query('SELECT * FROM criminal WHERE criminal_id = ?', [id]);
      const [cases] = await pool.query('SELECT * FROM vw_criminal_full_record WHERE criminal_id = ? AND fir_number IS NOT NULL', [id]);
      const [arrests] = await pool.query('SELECT a.*, o.name AS arresting_officer FROM arrest a JOIN officer o ON a.officer_id = o.officer_id WHERE a.criminal_id = ?', [id]);
      return { data: { criminal: crim[0], linked_cases: cases, arrests } };
    }
  }

  return { data: [] };
}

function parseBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

// ============================================================
// 5. START SERVER
// ============================================================
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n======================================================');
  console.log(`🚔 POLICE DBMS SERVER RUNNING AT: http://localhost:${PORT}`);
  console.log(`Login URL: http://localhost:${PORT}/login.html`);
  console.log('======================================================\n');
});

