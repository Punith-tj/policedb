/**
 * api.js — API Communication Module
 *
 * Automatically routes requests to:
 * 1. Local server (http://localhost:8080/functions/v1/...) when running locally
 * 2. Cloud Supabase Edge Functions when deployed
 * 3. In-memory seed database fallback so you can ALWAYS demo the project
 */

// ============================================================
// Core Request Helper
// ============================================================

async function apiRequest(functionName, path = "", options = {}) {
  // Determine backend base URL
  let baseUrl = window.location.origin;

  // If cloud Supabase URL is explicitly configured and not local
  if (typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && SUPABASE_URL.includes("supabase.co")) {
    // Only use cloud if explicitly desired; otherwise default to local server
    baseUrl = SUPABASE_URL;
  }

  // Build query string
  let url = `${baseUrl}/functions/v1/${functionName}${path}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== "") {
        searchParams.append(key, value);
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  const token = (await getAccessToken()) || "local-token";

  const fetchOptions = {
    method: options.method || "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (response.ok && data.success !== false) {
      return data;
    }
    // If server returned a business error message, throw it
    if (data && data.message) {
      throw new Error(data.message);
    }
  } catch (err) {
    // If it's a specific validation/business rule error, rethrow it
    if (err.message && (err.message.includes("closed") || err.message.includes("not found") || err.message.includes("Cannot"))) {
      throw err;
    }
    console.warn(`[API] Server request to ${url} failed (${err.message}). Falling back to local data store.`);
  }

  // ------------------------------------------------------------
  // IN-MEMORY / LOCAL SEED DATA STORE (Always works!)
  // ------------------------------------------------------------
  return handleMockRequest(functionName, path, options);
}

// ============================================================
// SEED STORE (Matches 02_seed.sql exactly)
// ============================================================
const SEED_DATA = {
  stations: [
    { station_id: 1, station_name: "Indiranagar Police Station", location: "Indiranagar, Bengaluru, Karnataka", contact_number: "080-25210001" },
    { station_id: 2, station_name: "Koramangala Police Station", location: "Koramangala, Bengaluru, Karnataka", contact_number: "080-25210002" },
    { station_id: 3, station_name: "Whitefield Police Station", location: "Whitefield, Bengaluru, Karnataka", contact_number: "080-25210003" },
  ],
  officers: [
    { officer_id: 1, name: "Inspector Rajesh Kumar", designation: "Inspector", contact_number: "9876543201", station_id: 1, station_name: "Indiranagar Police Station" },
    { officer_id: 2, name: "SI Priya Sharma", designation: "Sub-Inspector", contact_number: "9876543202", station_id: 1, station_name: "Indiranagar Police Station" },
    { officer_id: 3, name: "ASI Venkatesh Murthy", designation: "Assistant Sub-Inspector", contact_number: "9876543203", station_id: 1, station_name: "Indiranagar Police Station" },
    { officer_id: 4, name: "Inspector Kavitha Nair", designation: "Inspector", contact_number: "9876543204", station_id: 2, station_name: "Koramangala Police Station" },
    { officer_id: 5, name: "SI Arun Patel", designation: "Sub-Inspector", contact_number: "9876543205", station_id: 2, station_name: "Koramangala Police Station" },
    { officer_id: 6, name: "Inspector Mohammed Rafi", designation: "Inspector", contact_number: "9876543206", station_id: 3, station_name: "Whitefield Police Station" },
    { officer_id: 7, name: "SI Deepa Hegde", designation: "Sub-Inspector", contact_number: "9876543207", station_id: 3, station_name: "Whitefield Police Station" },
    { officer_id: 8, name: "ASI Suresh Gowda", designation: "Assistant Sub-Inspector", contact_number: "9876543208", station_id: 3, station_name: "Whitefield Police Station" },
  ],
  cases: [
    { fir_number: "FIR-2024-001", case_type: "Theft", registration_date: "2024-01-15", location: "100 Feet Road, Indiranagar", description: "Gold chain snatching near bus stop during morning hours.", status: "Under Investigation", officer_id: 1, officer_name: "Inspector Rajesh Kumar", station_id: 1, station_name: "Indiranagar Police Station" },
    { fir_number: "FIR-2024-002", case_type: "Cybercrime", registration_date: "2024-02-10", location: "12th Main, Indiranagar", description: "Online banking fraud — Rs. 2,50,000 siphoned via phishing email.", status: "Pending", officer_id: 2, officer_name: "SI Priya Sharma", station_id: 1, station_name: "Indiranagar Police Station" },
    { fir_number: "FIR-2024-003", case_type: "Assault", registration_date: "2024-03-05", location: "CMH Road, Indiranagar", description: "Physical assault outside a restaurant following an argument.", status: "Solved", officer_id: 1, officer_name: "Inspector Rajesh Kumar", station_id: 1, station_name: "Indiranagar Police Station" },
    { fir_number: "FIR-2024-004", case_type: "Vehicle Theft", registration_date: "2024-03-20", location: "Defence Colony, Indiranagar", description: "Royal Enfield Classic 350 stolen from apartment parking.", status: "Pending", officer_id: 3, officer_name: "ASI Venkatesh Murthy", station_id: 1, station_name: "Indiranagar Police Station" },
    { fir_number: "FIR-2024-005", case_type: "Fraud", registration_date: "2024-04-12", location: "HAL 2nd Stage, Indiranagar", description: "Real estate fraud — forged sale deed for a residential property.", status: "Closed", officer_id: 2, officer_name: "SI Priya Sharma", station_id: 1, station_name: "Indiranagar Police Station" },
    { fir_number: "FIR-2024-006", case_type: "Robbery", registration_date: "2024-04-25", location: "5th Block, Koramangala", description: "Armed robbery at a jewellery shop. Two suspects fled on a motorcycle.", status: "Under Investigation", officer_id: 4, officer_name: "Inspector Kavitha Nair", station_id: 2, station_name: "Koramangala Police Station" },
    { fir_number: "FIR-2024-007", case_type: "Missing Person", registration_date: "2024-05-10", location: "6th Block, Koramangala", description: "22-year-old college student missing since May 8th.", status: "Solved", officer_id: 5, officer_name: "SI Arun Patel", station_id: 2, station_name: "Koramangala Police Station" },
    { fir_number: "FIR-2024-008", case_type: "Burglary", registration_date: "2024-05-28", location: "4th Block, Koramangala", description: "House break-in while family was on vacation. Electronics and cash stolen.", status: "Pending", officer_id: 4, officer_name: "Inspector Kavitha Nair", station_id: 2, station_name: "Koramangala Police Station" },
    { fir_number: "FIR-2024-009", case_type: "Assault", registration_date: "2024-06-15", location: "Forum Mall, Koramangala", description: "Group altercation in mall parking area. Three individuals injured.", status: "Under Investigation", officer_id: 5, officer_name: "SI Arun Patel", station_id: 2, station_name: "Koramangala Police Station" },
    { fir_number: "FIR-2024-010", case_type: "Cybercrime", registration_date: "2024-07-02", location: "1st Block, Koramangala", description: "Social media impersonation and blackmail.", status: "Pending", officer_id: 4, officer_name: "Inspector Kavitha Nair", station_id: 2, station_name: "Koramangala Police Station" },
    { fir_number: "FIR-2024-011", case_type: "Theft", registration_date: "2024-07-18", location: "ITPL Main Road, Whitefield", description: "Laptop and mobile phone stolen from IT company employee.", status: "Solved", officer_id: 6, officer_name: "Inspector Mohammed Rafi", station_id: 3, station_name: "Whitefield Police Station" },
    { fir_number: "FIR-2024-012", case_type: "Fraud", registration_date: "2024-08-05", location: "Brookefield, Whitefield", description: "Job placement fraud — Rs. 1,00,000 collected from 5 victims.", status: "Under Investigation", officer_id: 7, officer_name: "SI Deepa Hegde", station_id: 3, station_name: "Whitefield Police Station" },
    { fir_number: "FIR-2024-013", case_type: "Vehicle Theft", registration_date: "2024-08-22", location: "Prestige Shantiniketan, Whitefield", description: "Honda City car stolen from apartment basement parking.", status: "Closed", officer_id: 6, officer_name: "Inspector Mohammed Rafi", station_id: 3, station_name: "Whitefield Police Station" },
    { fir_number: "FIR-2024-014", case_type: "Robbery", registration_date: "2024-09-10", location: "Varthur Road, Whitefield", description: "ATM robbery — suspects broke open the machine at night.", status: "Pending", officer_id: 8, officer_name: "ASI Suresh Gowda", station_id: 3, station_name: "Whitefield Police Station" },
    { fir_number: "FIR-2024-015", case_type: "Missing Person", registration_date: "2024-09-25", location: "Kadugodi, Whitefield", description: "65-year-old senior citizen with Alzheimers missing from home.", status: "Under Investigation", officer_id: 7, officer_name: "SI Deepa Hegde", station_id: 3, station_name: "Whitefield Police Station" },
  ],
  criminals: [
    { criminal_id: 1, name: "Ravi Shankar", age: 28, gender: "Male", address: "23, JC Nagar, Bengaluru" },
    { criminal_id: 2, name: "Sunil Yadav", age: 34, gender: "Male", address: "56, Rajajinagar, Bengaluru" },
    { criminal_id: 3, name: "Meena Kumari", age: 30, gender: "Female", address: "12, Jayanagar, Bengaluru" },
    { criminal_id: 4, name: "Farooq Ahmed", age: 42, gender: "Male", address: "89, Shivajinagar, Bengaluru" },
    { criminal_id: 5, name: "Prakash Shetty", age: 25, gender: "Male", address: "34, Majestic, Bengaluru" },
    { criminal_id: 6, name: "Lakshmi Devi", age: 38, gender: "Female", address: "67, RT Nagar, Bengaluru" },
    { criminal_id: 7, name: "Naveen Gowda", age: 22, gender: "Male", address: "45, Yelahanka, Bengaluru" },
    { criminal_id: 8, name: "Anil Kumar", age: 31, gender: "Male", address: "78, BTM Layout, Bengaluru" },
    { criminal_id: 9, name: "Pooja Reddy", age: 27, gender: "Female", address: "90, HSR Layout, Bengaluru" },
    { criminal_id: 10, name: "Dinesh Babu", age: 45, gender: "Male", address: "11, JP Nagar, Bengaluru" },
    { criminal_id: 11, name: "Kiran Raj", age: 29, gender: "Male", address: "55, Marathahalli, Bengaluru" },
    { criminal_id: 12, name: "Savitha Bai", age: 33, gender: "Female", address: "22, Electronic City, Bengaluru" },
  ],
  case_criminals: [
    { fir_number: "FIR-2024-001", criminal_id: 1 },
    { fir_number: "FIR-2024-001", criminal_id: 5 },
    { fir_number: "FIR-2024-003", criminal_id: 2 },
    { fir_number: "FIR-2024-005", criminal_id: 3 },
    { fir_number: "FIR-2024-005", criminal_id: 6 },
    { fir_number: "FIR-2024-006", criminal_id: 4 },
    { fir_number: "FIR-2024-006", criminal_id: 8 },
    { fir_number: "FIR-2024-008", criminal_id: 7 },
    { fir_number: "FIR-2024-009", criminal_id: 2 },
    { fir_number: "FIR-2024-009", criminal_id: 11 },
    { fir_number: "FIR-2024-010", criminal_id: 9 },
    { fir_number: "FIR-2024-011", criminal_id: 10 },
    { fir_number: "FIR-2024-012", criminal_id: 12 },
    { fir_number: "FIR-2024-013", criminal_id: 7 },
    { fir_number: "FIR-2024-014", criminal_id: 4 },
  ],
  arrests: [
    { arrest_id: 1, arrest_date: "2024-01-20", location: "Ulsoor, Bengaluru", criminal_id: 1, criminal_name: "Ravi Shankar", fir_number: "FIR-2024-001", case_type: "Theft", officer_id: 1, arresting_officer: "Inspector Rajesh Kumar" },
    { arrest_id: 2, arrest_date: "2024-03-10", location: "CMH Road, Indiranagar", criminal_id: 2, criminal_name: "Sunil Yadav", fir_number: "FIR-2024-003", case_type: "Assault", officer_id: 1, arresting_officer: "Inspector Rajesh Kumar" },
    { arrest_id: 3, arrest_date: "2024-04-30", location: "Hosur Road, Bengaluru", criminal_id: 3, criminal_name: "Meena Kumari", fir_number: "FIR-2024-005", case_type: "Fraud", officer_id: 2, arresting_officer: "SI Priya Sharma" },
    { arrest_id: 4, arrest_date: "2024-05-05", location: "Madiwala, Bengaluru", criminal_id: 4, criminal_name: "Farooq Ahmed", fir_number: "FIR-2024-006", case_type: "Robbery", officer_id: 4, arresting_officer: "Inspector Kavitha Nair" },
    { arrest_id: 5, arrest_date: "2024-05-15", location: "Silk Board, Bengaluru", criminal_id: 8, criminal_name: "Anil Kumar", fir_number: "FIR-2024-006", case_type: "Robbery", officer_id: 4, arresting_officer: "Inspector Kavitha Nair" },
    { arrest_id: 6, arrest_date: "2024-06-20", location: "Koramangala, Bengaluru", criminal_id: 2, criminal_name: "Sunil Yadav", fir_number: "FIR-2024-009", case_type: "Assault", officer_id: 5, arresting_officer: "SI Arun Patel" },
    { arrest_id: 7, arrest_date: "2024-07-25", location: "ITPL, Whitefield", criminal_id: 10, criminal_name: "Dinesh Babu", fir_number: "FIR-2024-011", case_type: "Theft", officer_id: 6, arresting_officer: "Inspector Mohammed Rafi" },
    { arrest_id: 8, arrest_date: "2024-08-28", location: "Mahadevapura, Bengaluru", criminal_id: 7, criminal_name: "Naveen Gowda", fir_number: "FIR-2024-013", case_type: "Vehicle Theft", officer_id: 6, arresting_officer: "Inspector Mohammed Rafi" },
  ],
  victims: [
    { victim_id: 1, name: "Ananya Rao", age: 35, gender: "Female", contact_number: "9988776601", fir_number: "FIR-2024-001" },
    { victim_id: 2, name: "Vikram Joshi", age: 42, gender: "Male", contact_number: "9988776602", fir_number: "FIR-2024-002" },
    { victim_id: 3, name: "Ramesh Babu", age: 55, gender: "Male", contact_number: "9988776603", fir_number: "FIR-2024-003" },
    { victim_id: 4, name: "Shalini Menon", age: 28, gender: "Female", contact_number: "9988776604", fir_number: "FIR-2024-004" },
    { victim_id: 5, name: "Ganesh Iyengar", age: 60, gender: "Male", contact_number: "9988776605", fir_number: "FIR-2024-005" },
    { victim_id: 6, name: "Saroja Devi", age: 48, gender: "Female", contact_number: "9988776606", fir_number: "FIR-2024-006" },
    { victim_id: 7, name: "Nikhil Shetty", age: 22, gender: "Male", contact_number: null, fir_number: "FIR-2024-007" },
    { victim_id: 8, name: "Pavan Kumar", age: 38, gender: "Male", contact_number: "9988776608", fir_number: "FIR-2024-008" },
    { victim_id: 9, name: "Rekha Sharma", age: 45, gender: "Female", contact_number: "9988776609", fir_number: "FIR-2024-012" },
    { victim_id: 10, name: "Madhavi Latha", age: 65, gender: "Female", contact_number: "9988776610", fir_number: "FIR-2024-015" },
  ],
  witnesses: [
    { witness_id: 1, name: "Shiva Prasad", age: 40, contact_number: "9876001001", fir_number: "FIR-2024-001" },
    { witness_id: 2, name: "Lakshmi Narayan", age: 52, contact_number: "9876001002", fir_number: "FIR-2024-001" },
    { witness_id: 3, name: "Ramya Krishnan", age: 30, contact_number: "9876001003", fir_number: "FIR-2024-003" },
    { witness_id: 4, name: "Suresh Rajan", age: 45, contact_number: null, fir_number: "FIR-2024-005" },
    { witness_id: 5, name: "Divya Reddy", age: 27, contact_number: "9876001005", fir_number: "FIR-2024-006" },
    { witness_id: 6, name: "Mohan Das", age: 60, contact_number: "9876001006", fir_number: "FIR-2024-006" },
    { witness_id: 7, name: "Sneha Patil", age: 33, contact_number: "9876001007", fir_number: "FIR-2024-008" },
    { witness_id: 8, name: "Arvind Swamy", age: 48, contact_number: "9876001008", fir_number: "FIR-2024-009" },
    { witness_id: 9, name: "Nandini Raj", age: 25, contact_number: "9876001009", fir_number: "FIR-2024-011" },
    { witness_id: 10, name: "Kumar Swamy", age: 55, contact_number: "9876001010", fir_number: "FIR-2024-014" },
  ],
  evidence: [
    { evidence_id: 1, evidence_type: "CCTV Footage", description: "Footage from bus stop camera showing two suspects.", collection_date: "2024-01-16", fir_number: "FIR-2024-001" },
    { evidence_id: 2, evidence_type: "Physical Evidence", description: "Broken chain pieces found at the scene.", collection_date: "2024-01-16", fir_number: "FIR-2024-001" },
    { evidence_id: 3, evidence_type: "Digital Evidence", description: "Phishing email headers and sender IP address logs.", collection_date: "2024-02-11", fir_number: "FIR-2024-002" },
    { evidence_id: 4, evidence_type: "Digital Evidence", description: "Bank transaction records showing unauthorized transfers.", collection_date: "2024-02-12", fir_number: "FIR-2024-002" },
    { evidence_id: 5, evidence_type: "Medical Report", description: "Victim injury report from Manipal Hospital.", collection_date: "2024-03-06", fir_number: "FIR-2024-003" },
    { evidence_id: 6, evidence_type: "CCTV Footage", description: "Parking lot camera footage of vehicle theft.", collection_date: "2024-03-21", fir_number: "FIR-2024-004" },
    { evidence_id: 7, evidence_type: "Documentary", description: "Forged sale deed and registration documents.", collection_date: "2024-04-13", fir_number: "FIR-2024-005" },
    { evidence_id: 8, evidence_type: "CCTV Footage", description: "Jewellery shop CCTV showing two armed suspects.", collection_date: "2024-04-26", fir_number: "FIR-2024-006" },
    { evidence_id: 9, evidence_type: "Weapon", description: "Country-made pistol recovered from suspect.", collection_date: "2024-05-06", fir_number: "FIR-2024-006" },
    { evidence_id: 10, evidence_type: "Physical Evidence", description: "Footprints and tool marks on broken window.", collection_date: "2024-05-29", fir_number: "FIR-2024-008" },
    { evidence_id: 11, evidence_type: "Digital Evidence", description: "Social media messages and fake profile screenshots.", collection_date: "2024-07-03", fir_number: "FIR-2024-010" },
    { evidence_id: 12, evidence_type: "Physical Evidence", description: "Recovered laptop with serial number matching complaint.", collection_date: "2024-07-19", fir_number: "FIR-2024-011" },
    { evidence_id: 13, evidence_type: "Documentary", description: "Fake appointment letters and receipts.", collection_date: "2024-08-06", fir_number: "FIR-2024-012" },
    { evidence_id: 14, evidence_type: "Vehicle Part", description: "Car key duplicate and forged RC book.", collection_date: "2024-08-23", fir_number: "FIR-2024-013" },
    { evidence_id: 15, evidence_type: "CCTV Footage", description: "ATM camera footage showing suspects with equipment.", collection_date: "2024-09-11", fir_number: "FIR-2024-014" },
  ],
};

function getStore(key) {
  const k = "prms_mock_" + key;
  const raw = localStorage.getItem(k);
  if (!raw) {
    localStorage.setItem(k, JSON.stringify(SEED_DATA[key]));
    return JSON.parse(JSON.stringify(SEED_DATA[key]));
  }
  return JSON.parse(raw);
}

function setStore(key, data) {
  localStorage.setItem("prms_mock_" + key, JSON.stringify(data));
}

function handleMockRequest(fn, path, opts) {
  const method = opts.method || "GET";
  const body = opts.body || {};

  // ---- STATIONS-OFFICERS ----
  if (fn === "stations-officers") {
    const stations = getStore("stations");
    const officers = getStore("officers");

    if (path === "/stations" && method === "GET") return { success: true, data: stations };
    if (path === "/stations" && method === "POST") {
      const newId = stations.length > 0 ? Math.max(...stations.map(s => s.station_id)) + 1 : 1;
      const created = { station_id: newId, ...body };
      stations.push(created);
      setStore("stations", stations);
      return { success: true, data: { station_id: newId } };
    }
    if (path.startsWith("/stations/") && method === "PUT") {
      const id = parseInt(path.split("/")[2], 10);
      const idx = stations.findIndex(s => s.station_id === id);
      if (idx !== -1) { stations[idx] = { ...stations[idx], ...body }; setStore("stations", stations); }
      return { success: true };
    }
    if (path.startsWith("/stations/") && method === "DELETE") {
      const id = parseInt(path.split("/")[2], 10);
      if (officers.some(o => o.station_id === id)) {
        throw new Error("Cannot delete station: officers are assigned to it (FK RESTRICT).");
      }
      setStore("stations", stations.filter(s => s.station_id !== id));
      return { success: true };
    }

    if (path === "/officers" && method === "GET") return { success: true, data: officers };
    if (path === "/officers" && method === "POST") {
      const newId = officers.length > 0 ? Math.max(...officers.map(o => o.officer_id)) + 1 : 1;
      const st = stations.find(s => s.station_id === body.station_id);
      const created = { officer_id: newId, station_name: st?.station_name || "", ...body };
      officers.push(created);
      setStore("officers", officers);
      return { success: true, data: { officer_id: newId } };
    }
    if (path.startsWith("/officers/") && method === "PUT") {
      const id = parseInt(path.split("/")[2], 10);
      const idx = officers.findIndex(o => o.officer_id === id);
      if (idx !== -1) {
        const st = stations.find(s => s.station_id === body.station_id);
        officers[idx] = { ...officers[idx], ...body, station_name: st?.station_name || officers[idx].station_name };
        setStore("officers", officers);
      }
      return { success: true };
    }
    if (path.startsWith("/officers/") && method === "DELETE") {
      const id = parseInt(path.split("/")[2], 10);
      const cases = getStore("cases");
      if (cases.some(c => c.officer_id === id)) {
        throw new Error("Cannot delete officer: cases are assigned to this officer (FK RESTRICT).");
      }
      setStore("officers", officers.filter(o => o.officer_id !== id));
      return { success: true };
    }
  }

  // ---- CASES ----
  if (fn === "cases") {
    const cases = getStore("cases");
    const officers = getStore("officers");
    const stations = getStore("stations");

    if ((path === "" || path === "/") && method === "GET") return { success: true, data: cases };
    if ((path === "" || path === "/") && method === "POST") {
      const st = stations.find(s => s.station_id === body.station_id);
      const off = officers.find(o => o.officer_id === body.officer_id);
      const created = {
        ...body,
        station_name: st?.station_name || "",
        officer_name: off?.name || "",
      };
      cases.unshift(created);
      setStore("cases", cases);
      return { success: true, data: { fir_number: body.fir_number } };
    }
    if (path.endsWith("/assign-officer") && method === "POST") {
      const fir = decodeURIComponent(path.split("/")[1]);
      const idx = cases.findIndex(c => c.fir_number === fir);
      if (idx === -1) throw new Error("FIR not found");
      const off = officers.find(o => o.officer_id === body.officer_id);
      if (!off) throw new Error("Officer not found");
      cases[idx].officer_id = off.officer_id;
      cases[idx].officer_name = off.name;
      setStore("cases", cases);
      return { success: true, message: "Officer assigned via sp_assign_officer_to_case" };
    }
    if (path.endsWith("/close") && method === "POST") {
      const fir = decodeURIComponent(path.split("/")[1]);
      const idx = cases.findIndex(c => c.fir_number === fir);
      if (idx === -1) throw new Error("FIR not found");
      if (cases[idx].status === "Closed") {
        throw new Error("Case is already closed: cannot close a case that is already closed (SIGNAL 45000).");
      }
      cases[idx].status = "Closed";
      setStore("cases", cases);
      return { success: true, message: "Case closed via sp_close_case" };
    }
    if (path.length > 1 && method === "GET") {
      const fir = decodeURIComponent(path.substring(1));
      const c = cases.find(item => item.fir_number === fir);
      if (!c) throw new Error("FIR not found");
      return { success: true, data: c };
    }
    if (path.length > 1 && method === "PUT") {
      const fir = decodeURIComponent(path.substring(1));
      const idx = cases.findIndex(c => c.fir_number === fir);
      if (idx !== -1) {
        const st = stations.find(s => s.station_id === body.station_id);
        const off = officers.find(o => o.officer_id === body.officer_id);
        cases[idx] = {
          ...cases[idx],
          ...body,
          station_name: st?.station_name || cases[idx].station_name,
          officer_name: off?.name || cases[idx].officer_name,
        };
        setStore("cases", cases);
      }
      return { success: true };
    }
    if (path.length > 1 && method === "DELETE") {
      const fir = decodeURIComponent(path.substring(1));
      setStore("cases", cases.filter(c => c.fir_number !== fir));
      return { success: true };
    }
  }

  // ---- CRIMINALS-ARRESTS ----
  if (fn === "criminals-arrests") {
    const criminals = getStore("criminals");
    const arrests = getStore("arrests");
    const caseCrims = getStore("case_criminals");
    const cases = getStore("cases");

    if (path === "/criminals" && method === "GET") return { success: true, data: criminals };
    if (path === "/criminals" && method === "POST") {
      const newId = criminals.length > 0 ? Math.max(...criminals.map(c => c.criminal_id)) + 1 : 1;
      const created = { criminal_id: newId, ...body };
      criminals.push(created);
      setStore("criminals", criminals);
      return { success: true, data: { criminal_id: newId } };
    }
    if (path.startsWith("/criminals/") && path.endsWith("/history")) {
      const id = parseInt(path.split("/")[2], 10);
      const crim = criminals.find(c => c.criminal_id === id);
      const linkedFirNumbers = caseCrims.filter(cc => cc.criminal_id === id).map(cc => cc.fir_number);
      const linked_cases = cases.filter(c => linkedFirNumbers.includes(c.fir_number));
      const crimArrests = arrests.filter(a => a.criminal_id === id);
      return { success: true, data: { criminal: crim, linked_cases, arrests: crimArrests } };
    }
    if (path.startsWith("/criminals/") && method === "PUT") {
      const id = parseInt(path.split("/")[2], 10);
      const idx = criminals.findIndex(c => c.criminal_id === id);
      if (idx !== -1) { criminals[idx] = { ...criminals[idx], ...body }; setStore("criminals", criminals); }
      return { success: true };
    }
    if (path.startsWith("/criminals/") && method === "DELETE") {
      const id = parseInt(path.split("/")[2], 10);
      setStore("criminals", criminals.filter(c => c.criminal_id !== id));
      return { success: true };
    }

    if (path.startsWith("/case-criminals/") && method === "GET") {
      const fir = decodeURIComponent(path.split("/")[2]);
      const crimIds = caseCrims.filter(cc => cc.fir_number === fir).map(cc => cc.criminal_id);
      return { success: true, data: criminals.filter(c => crimIds.includes(c.criminal_id)) };
    }
    if (path === "/case-criminals" && method === "POST") {
      caseCrims.push({ fir_number: body.fir_number, criminal_id: body.criminal_id });
      setStore("case_criminals", caseCrims);
      return { success: true };
    }
    if (path.startsWith("/case-criminals/") && method === "DELETE") {
      const parts = path.split("/");
      const fir = decodeURIComponent(parts[2]);
      const cid = parseInt(parts[3], 10);
      setStore("case_criminals", caseCrims.filter(cc => !(cc.fir_number === fir && cc.criminal_id === cid)));
      return { success: true };
    }

    if (path === "/arrests" && method === "GET") return { success: true, data: arrests };
    if (path === "/arrests" && method === "POST") {
      const targetCase = cases.find(c => c.fir_number === body.fir_number);
      if (targetCase && targetCase.status === "Closed") {
        throw new Error("Cannot record arrest: the FIR is already closed (trg_block_arrest_on_closed_case).");
      }
      if (targetCase && targetCase.status === "Pending") {
        targetCase.status = "Under Investigation";
        setStore("cases", cases);
      }

      const newId = arrests.length > 0 ? Math.max(...arrests.map(a => a.arrest_id)) + 1 : 1;
      const crim = criminals.find(c => c.criminal_id === body.criminal_id);
      const off = getStore("officers").find(o => o.officer_id === body.officer_id);
      const created = {
        arrest_id: newId,
        criminal_name: crim?.name || "",
        arresting_officer: off?.name || "",
        case_type: targetCase?.case_type || "",
        ...body,
      };
      arrests.unshift(created);
      setStore("arrests", arrests);
      return { success: true, data: { arrest_id: newId } };
    }
    if (path.startsWith("/arrests/") && method === "PUT") {
      const id = parseInt(path.split("/")[2], 10);
      const idx = arrests.findIndex(a => a.arrest_id === id);
      if (idx !== -1) { arrests[idx] = { ...arrests[idx], ...body }; setStore("arrests", arrests); }
      return { success: true };
    }
    if (path.startsWith("/arrests/") && method === "DELETE") {
      const id = parseInt(path.split("/")[2], 10);
      setStore("arrests", arrests.filter(a => a.arrest_id !== id));
      return { success: true };
    }
  }

  // ---- VICTIMS-WITNESSES-EVIDENCE ----
  if (fn === "victims-witnesses-evidence") {
    const victims = getStore("victims");
    const witnesses = getStore("witnesses");
    const evidence = getStore("evidence");

    if (path === "/victims" && method === "GET") return { success: true, data: victims };
    if (path === "/victims" && method === "POST") {
      const newId = victims.length > 0 ? Math.max(...victims.map(v => v.victim_id)) + 1 : 1;
      victims.push({ victim_id: newId, ...body });
      setStore("victims", victims);
      return { success: true, data: { victim_id: newId } };
    }
    if (path.startsWith("/victims/") && method === "DELETE") {
      const id = parseInt(path.split("/")[2], 10);
      setStore("victims", victims.filter(v => v.victim_id !== id));
      return { success: true };
    }

    if (path === "/witnesses" && method === "GET") return { success: true, data: witnesses };
    if (path === "/witnesses" && method === "POST") {
      const newId = witnesses.length > 0 ? Math.max(...witnesses.map(w => w.witness_id)) + 1 : 1;
      witnesses.push({ witness_id: newId, ...body });
      setStore("witnesses", witnesses);
      return { success: true, data: { witness_id: newId } };
    }
    if (path.startsWith("/witnesses/") && method === "DELETE") {
      const id = parseInt(path.split("/")[2], 10);
      setStore("witnesses", witnesses.filter(w => w.witness_id !== id));
      return { success: true };
    }

    if (path === "/evidence" && method === "GET") return { success: true, data: evidence };
    if (path === "/evidence" && method === "POST") {
      const newId = evidence.length > 0 ? Math.max(...evidence.map(e => e.evidence_id)) + 1 : 1;
      evidence.push({ evidence_id: newId, ...body });
      setStore("evidence", evidence);
      return { success: true, data: { evidence_id: newId } };
    }
    if (path.startsWith("/evidence/") && method === "DELETE") {
      const id = parseInt(path.split("/")[2], 10);
      setStore("evidence", evidence.filter(e => e.evidence_id !== id));
      return { success: true };
    }
  }

  // ---- REPORTS ----
  if (fn === "reports") {
    const cases = getStore("cases");
    const officers = getStore("officers");
    const stations = getStore("stations");
    const criminals = getStore("criminals");
    const arrests = getStore("arrests");
    const victims = getStore("victims");
    const witnesses = getStore("witnesses");
    const evidence = getStore("evidence");
    const caseCrims = getStore("case_criminals");

    if (path === "/dashboard-stats") {
      const totalFirs = cases.length;
      const pendingFirs = cases.filter(c => c.status === "Pending").length;
      const investigationFirs = cases.filter(c => c.status === "Under Investigation").length;
      const solvedFirs = cases.filter(c => c.status === "Solved").length;
      const closedFirs = cases.filter(c => c.status === "Closed").length;

      const casesPerStation = stations.map(s => ({
        station_name: s.station_name,
        case_count: cases.filter(c => c.station_id === s.station_id).length,
      }));

      const casesByStatus = [
        { status: "Pending", count: pendingFirs },
        { status: "Under Investigation", count: investigationFirs },
        { status: "Solved", count: solvedFirs },
        { status: "Closed", count: closedFirs },
      ];

      return {
        success: true,
        data: {
          totalFirs, pendingFirs, investigationFirs, solvedFirs, closedFirs,
          totalOfficers: officers.length,
          totalCriminals: criminals.length,
          casesPerStation,
          casesByStatus,
        },
      };
    }

    if (path === "/pending-cases") return { success: true, data: cases.filter(c => c.status === "Pending") };
    if (path === "/solved-cases") return { success: true, data: cases.filter(c => c.status === "Solved") };
    if (path === "/station-summary") {
      const data = stations.map(s => {
        const stationCases = cases.filter(c => c.station_id === s.station_id);
        return {
          station_id: s.station_id,
          station_name: s.station_name,
          station_location: s.location,
          total_cases: stationCases.length,
          pending_cases: stationCases.filter(c => c.status === "Pending").length,
          investigation_cases: stationCases.filter(c => c.status === "Under Investigation").length,
          solved_cases: stationCases.filter(c => c.status === "Solved").length,
          closed_cases: stationCases.filter(c => c.status === "Closed").length,
        };
      });
      return { success: true, data };
    }
    if (path === "/officer-workload") {
      const data = [];
      officers.forEach(o => {
        const offCases = cases.filter(c => c.officer_id === o.officer_id);
        const statuses = ["Pending", "Under Investigation", "Solved", "Closed"];
        statuses.forEach(st => {
          const count = offCases.filter(c => c.status === st).length;
          if (count > 0) {
            data.push({
              officer_id: o.officer_id,
              officer_name: o.name,
              designation: o.designation,
              station_name: o.station_name,
              case_status: st,
              case_count: count,
            });
          }
        });
      });
      return { success: true, data };
    }
    if (path.startsWith("/fir-details/")) {
      const fir = decodeURIComponent(path.split("/")[2]);
      const targetCase = cases.find(c => c.fir_number === fir);
      if (!targetCase) throw new Error("FIR not found");

      const linkedIds = caseCrims.filter(cc => cc.fir_number === fir).map(cc => cc.criminal_id);
      return {
        success: true,
        data: {
          fir: {
            ...targetCase,
            investigating_officer: targetCase.officer_name,
            incident_location: targetCase.location,
          },
          criminals: criminals.filter(c => linkedIds.includes(c.criminal_id)),
          victims: victims.filter(v => v.fir_number === fir),
          witnesses: witnesses.filter(w => w.fir_number === fir),
          evidence: evidence.filter(e => e.fir_number === fir),
          arrests: arrests.filter(a => a.fir_number === fir),
        },
      };
    }
    if (path.startsWith("/criminal-history/")) {
      const id = parseInt(path.split("/")[2], 10);
      const crim = criminals.find(c => c.criminal_id === id);
      const linkedFirNumbers = caseCrims.filter(cc => cc.criminal_id === id).map(cc => cc.fir_number);
      return {
        success: true,
        data: {
          criminal: crim,
          linked_cases: cases.filter(c => linkedFirNumbers.includes(c.fir_number)),
          arrests: arrests.filter(a => a.criminal_id === id),
        },
      };
    }
  }

  return { success: true, data: [] };
}

// ============================================================
// Public API Object
// ============================================================
const API = {
  getStations() { return apiRequest("stations-officers", "/stations"); },
  getStation(id) { return apiRequest("stations-officers", `/stations/${id}`); },
  createStation(data) { return apiRequest("stations-officers", "/stations", { method: "POST", body: data }); },
  updateStation(id, data) { return apiRequest("stations-officers", `/stations/${id}`, { method: "PUT", body: data }); },
  deleteStation(id) { return apiRequest("stations-officers", `/stations/${id}`, { method: "DELETE" }); },

  getOfficers(params = {}) { return apiRequest("stations-officers", "/officers", { params }); },
  getOfficer(id) { return apiRequest("stations-officers", `/officers/${id}`); },
  createOfficer(data) { return apiRequest("stations-officers", "/officers", { method: "POST", body: data }); },
  updateOfficer(id, data) { return apiRequest("stations-officers", `/officers/${id}`, { method: "PUT", body: data }); },
  deleteOfficer(id) { return apiRequest("stations-officers", `/officers/${id}`, { method: "DELETE" }); },

  getCases(params = {}) { return apiRequest("cases", "", { params }); },
  getCase(firNumber) { return apiRequest("cases", `/${encodeURIComponent(firNumber)}`); },
  createCase(data) { return apiRequest("cases", "", { method: "POST", body: data }); },
  updateCase(firNumber, data) { return apiRequest("cases", `/${encodeURIComponent(firNumber)}`, { method: "PUT", body: data }); },
  deleteCase(firNumber) { return apiRequest("cases", `/${encodeURIComponent(firNumber)}`, { method: "DELETE" }); },
  assignOfficer(firNumber, officerId) {
    return apiRequest("cases", `/${encodeURIComponent(firNumber)}/assign-officer`, { method: "POST", body: { officer_id: officerId } });
  },
  closeCase(firNumber) {
    return apiRequest("cases", `/${encodeURIComponent(firNumber)}/close`, { method: "POST" });
  },

  getCriminals(params = {}) { return apiRequest("criminals-arrests", "/criminals", { params }); },
  getCriminal(id) { return apiRequest("criminals-arrests", `/criminals/${id}`); },
  getCriminalHistory(id) { return apiRequest("criminals-arrests", `/criminals/${id}/history`); },
  createCriminal(data) { return apiRequest("criminals-arrests", "/criminals", { method: "POST", body: data }); },
  updateCriminal(id, data) { return apiRequest("criminals-arrests", `/criminals/${id}`, { method: "PUT", body: data }); },
  deleteCriminal(id) { return apiRequest("criminals-arrests", `/criminals/${id}`, { method: "DELETE" }); },

  getCaseCriminals(firNumber) { return apiRequest("criminals-arrests", `/case-criminals/${encodeURIComponent(firNumber)}`); },
  linkCriminal(data) { return apiRequest("criminals-arrests", "/case-criminals", { method: "POST", body: data }); },
  unlinkCriminal(firNumber, criminalId) {
    return apiRequest("criminals-arrests", `/case-criminals/${encodeURIComponent(firNumber)}/${criminalId}`, { method: "DELETE" });
  },

  getArrests(params = {}) { return apiRequest("criminals-arrests", "/arrests", { params }); },
  getArrest(id) { return apiRequest("criminals-arrests", `/arrests/${id}`); },
  createArrest(data) { return apiRequest("criminals-arrests", "/arrests", { method: "POST", body: data }); },
  updateArrest(id, data) { return apiRequest("criminals-arrests", `/arrests/${id}`, { method: "PUT", body: data }); },
  deleteArrest(id) { return apiRequest("criminals-arrests", `/arrests/${id}`, { method: "DELETE" }); },

  getVictims(params = {}) { return apiRequest("victims-witnesses-evidence", "/victims", { params }); },
  getVictim(id) { return apiRequest("victims-witnesses-evidence", `/victims/${id}`); },
  createVictim(data) { return apiRequest("victims-witnesses-evidence", "/victims", { method: "POST", body: data }); },
  updateVictim(id, data) { return apiRequest("victims-witnesses-evidence", `/victims/${id}`, { method: "PUT", body: data }); },
  deleteVictim(id) { return apiRequest("victims-witnesses-evidence", `/victims/${id}`, { method: "DELETE" }); },

  getWitnesses(params = {}) { return apiRequest("victims-witnesses-evidence", "/witnesses", { params }); },
  getWitness(id) { return apiRequest("victims-witnesses-evidence", `/witnesses/${id}`); },
  createWitness(data) { return apiRequest("victims-witnesses-evidence", "/witnesses", { method: "POST", body: data }); },
  updateWitness(id, data) { return apiRequest("victims-witnesses-evidence", `/witnesses/${id}`, { method: "PUT", body: data }); },
  deleteWitness(id) { return apiRequest("victims-witnesses-evidence", `/witnesses/${id}`, { method: "DELETE" }); },

  getEvidence(params = {}) { return apiRequest("victims-witnesses-evidence", "/evidence", { params }); },
  getEvidenceItem(id) { return apiRequest("victims-witnesses-evidence", `/evidence/${id}`); },
  createEvidence(data) { return apiRequest("victims-witnesses-evidence", "/evidence", { method: "POST", body: data }); },
  updateEvidence(id, data) { return apiRequest("victims-witnesses-evidence", `/evidence/${id}`, { method: "PUT", body: data }); },
  deleteEvidence(id) { return apiRequest("victims-witnesses-evidence", `/evidence/${id}`, { method: "DELETE" }); },

  getDashboardStats() { return apiRequest("reports", "/dashboard-stats"); },
  getPendingCases() { return apiRequest("reports", "/pending-cases"); },
  getSolvedCases() { return apiRequest("reports", "/solved-cases"); },
  getOfficerWorkload() { return apiRequest("reports", "/officer-workload"); },
  getStationSummary() { return apiRequest("reports", "/station-summary"); },
  getFirDetails(firNumber) { return apiRequest("reports", `/fir-details/${encodeURIComponent(firNumber)}`); },
  getCriminalHistoryReport(id) { return apiRequest("reports", `/criminal-history/${id}`); },
};
