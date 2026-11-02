/**
 * reports.js
 * ----------
 * Interacts with the backend reports Edge Function and database views:
 * - vw_station_case_summary
 * - vw_officer_case_load
 * - vw_pending_cases
 * - vw_solved_cases
 * - vw_criminal_full_record
 * Supports Print and CSV export with RFC-4180 escaping.
 */

let stationSummaryData = [];
let officerWorkloadData = [];
let currentCasesData = [];

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("reports", "Reports & Analytics");
    await Promise.all([
        loadStationSummary(),
        loadOfficerWorkload(),
        loadCasesView("pending"),
        loadCriminalsList()
    ]);
});

async function loadStationSummary() {
    showLoading("stationSummaryTableBody", 8);
    try {
        const res = await API.getStationSummary();
        stationSummaryData = res.data || [];
        renderStationSummary(stationSummaryData);
    } catch (err) {
        showError("stationSummaryTableBody", err.message || "Failed to load station summary.", 8);
    }
}

function renderStationSummary(data) {
    const tbody = document.getElementById("stationSummaryTableBody");
    if (!data || data.length === 0) {
        showEmpty("stationSummaryTableBody", "No station data available.", 8);
        return;
    }
    tbody.innerHTML = data.map(s => `
        <tr>
            <td><strong>#${s.station_id}</strong></td>
            <td><strong>${escapeHTML(s.station_name)}</strong></td>
            <td>${escapeHTML(s.station_location || s.location || "—")}</td>
            <td><strong>${s.total_cases}</strong></td>
            <td><span class="badge badge-warning">${s.pending_cases}</span></td>
            <td><span class="badge badge-info">${s.investigation_cases}</span></td>
            <td><span class="badge badge-success">${s.solved_cases}</span></td>
            <td><span class="badge badge-secondary">${s.closed_cases}</span></td>
        </tr>
    `).join("");
}

function exportStationSummary() {
    exportToCSV(stationSummaryData, "station_case_summary.csv", [
        { key: "station_id", label: "Station ID" },
        { key: "station_name", label: "Station Name" },
        { key: "station_location", label: "Location" },
        { key: "total_cases", label: "Total Cases" },
        { key: "pending_cases", label: "Pending" },
        { key: "investigation_cases", label: "Under Investigation" },
        { key: "solved_cases", label: "Solved" },
        { key: "closed_cases", label: "Closed" },
    ]);
}

async function loadOfficerWorkload() {
    showLoading("officerWorkloadTableBody", 6);
    try {
        const res = await API.getOfficerWorkload();
        officerWorkloadData = res.data || [];
        renderOfficerWorkload(officerWorkloadData);
    } catch (err) {
        showError("officerWorkloadTableBody", err.message || "Failed to load officer workload.", 6);
    }
}

function renderOfficerWorkload(data) {
    const tbody = document.getElementById("officerWorkloadTableBody");
    if (!data || data.length === 0) {
        showEmpty("officerWorkloadTableBody", "No officer workload records found.", 6);
        return;
    }
    tbody.innerHTML = data.map(o => `
        <tr>
            <td>#${o.officer_id}</td>
            <td><strong>${escapeHTML(o.officer_name || o.name)}</strong></td>
            <td>${escapeHTML(o.designation)}</td>
            <td>${escapeHTML(o.station_name)}</td>
            <td>${o.case_status ? statusBadge(o.case_status) : "<em>No Assigned Status</em>"}</td>
            <td><strong>${o.case_count || 0}</strong></td>
        </tr>
    `).join("");
}

function exportOfficerWorkload() {
    exportToCSV(officerWorkloadData, "officer_workload.csv", [
        { key: "officer_id", label: "Officer ID" },
        { key: "officer_name", label: "Officer Name" },
        { key: "designation", label: "Designation" },
        { key: "station_name", label: "Station" },
        { key: "case_status", label: "Case Status" },
        { key: "case_count", label: "Case Count" },
    ]);
}

async function toggleCaseView() {
    const type = document.getElementById("caseViewToggle").value;
    await loadCasesView(type);
}

async function loadCasesView(type) {
    showLoading("casesViewTableBody", 7);
    try {
        const res = type === "solved" ? await API.getSolvedCases() : await API.getPendingCases();
        currentCasesData = res.data || [];
        renderCasesView(currentCasesData);
    } catch (err) {
        showError("casesViewTableBody", err.message || "Failed to load cases.", 7);
    }
}

function renderCasesView(data) {
    const tbody = document.getElementById("casesViewTableBody");
    if (!data || data.length === 0) {
        showEmpty("casesViewTableBody", "No cases found in this category.", 7);
        return;
    }
    tbody.innerHTML = data.map(c => `
        <tr>
            <td><a href="case-details.html?fir=${encodeURIComponent(c.fir_number)}"><strong>${escapeHTML(c.fir_number)}</strong></a></td>
            <td>${escapeHTML(c.case_type)}</td>
            <td>${formatDate(c.registration_date)}</td>
            <td>${escapeHTML(c.incident_location || c.location || "—")}</td>
            <td>${escapeHTML(c.investigating_officer || c.officer_name || "—")}</td>
            <td>${escapeHTML(c.officer_designation || "—")}</td>
            <td>${escapeHTML(c.station_name || "—")}</td>
        </tr>
    `).join("");
}

function exportCasesView() {
    const type = document.getElementById("caseViewToggle").value;
    exportToCSV(currentCasesData, `${type}_cases_report.csv`, [
        { key: "fir_number", label: "FIR Number" },
        { key: "case_type", label: "Case Type" },
        { key: "registration_date", label: "Registration Date" },
        { key: "incident_location", label: "Location" },
        { key: "investigating_officer", label: "Officer" },
        { key: "station_name", label: "Station" },
    ]);
}

async function loadCriminalsList() {
    try {
        const res = await API.getCriminals();
        const criminals = res.data || [];
        const select = document.getElementById("criminalSelect");
        select.innerHTML = '<option value="">-- Choose Criminal --</option>' +
            criminals.map(c => `<option value="${c.criminal_id}">${escapeHTML(c.name)} (#${c.criminal_id}, Age ${c.age})</option>`).join("");
    } catch (err) {
        console.error("Failed to load criminals for dossier lookup:", err);
    }
}

async function lookupCriminalDossier() {
    const select = document.getElementById("criminalSelect");
    const id = select.value;
    const target = document.getElementById("dossierResultArea");

    if (!id) {
        showToast("Please choose a criminal profile first", "warning");
        return;
    }

    target.innerHTML = `<div class="state-box"><div class="loading-spinner"></div><p>Generating dossier...</p></div>`;

    try {
        const res = await API.getCriminalHistoryReport(id);
        const data = res.data;
        const crim = data.criminal;

        let casesHtml = "";
        if (!data.linked_cases || data.linked_cases.length === 0) {
            casesHtml = "<p>No FIR cases linked.</p>";
        } else {
            casesHtml = `
                <table class="data-table" style="margin-top: 8px;">
                    <thead><tr><th>FIR</th><th>Type</th><th>Date</th><th>Status</th><th>Location</th></tr></thead>
                    <tbody>
                        ${data.linked_cases.map(lc => `
                            <tr>
                                <td><strong>${escapeHTML(lc.fir_number)}</strong></td>
                                <td>${escapeHTML(lc.case_type)}</td>
                                <td>${formatDate(lc.registration_date)}</td>
                                <td>${statusBadge(lc.case_status || lc.status)}</td>
                                <td>${escapeHTML(lc.incident_location || lc.location || "—")}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        }

        let arrestsHtml = "";
        if (!data.arrests || data.arrests.length === 0) {
            arrestsHtml = "<p>No arrest records logged.</p>";
        } else {
            arrestsHtml = `
                <table class="data-table" style="margin-top: 8px;">
                    <thead><tr><th>Arrest ID</th><th>Date</th><th>Location</th><th>FIR</th><th>Officer</th></tr></thead>
                    <tbody>
                        ${data.arrests.map(ar => `
                            <tr>
                                <td>#${ar.arrest_id}</td>
                                <td>${formatDate(ar.arrest_date)}</td>
                                <td>${escapeHTML(ar.arrest_location || ar.location)}</td>
                                <td>${escapeHTML(ar.fir_number)}</td>
                                <td>${escapeHTML(ar.arresting_officer)}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        }

        target.innerHTML = `
            <div style="border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-top: 16px; background: white;" id="dossierPrintArea">
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--primary); padding-bottom: 8px; margin-bottom: 12px;">
                    <h4 style="margin: 0; font-size: 16px;">Dossier for ${escapeHTML(crim.name)} (Record #${crim.criminal_id})</h4>
                    <button class="btn btn-sm btn-outline-light" onclick="printSection('dossierPrintArea', 'Criminal Dossier: ${escapeHTML(crim.name)}')">Print Dossier</button>
                </div>
                <p><strong>Age:</strong> ${crim.age} &nbsp;|&nbsp; <strong>Gender:</strong> ${escapeHTML(crim.gender)} &nbsp;|&nbsp; <strong>Address:</strong> ${escapeHTML(crim.address)}</p>
                <h5 style="margin-top: 16px;">Case Involvements (${(data.linked_cases || []).length})</h5>
                ${casesHtml}
                <h5 style="margin-top: 16px;">Arrests (${(data.arrests || []).length})</h5>
                ${arrestsHtml}
            </div>
        `;

    } catch (err) {
        target.innerHTML = `<div class="state-box state-error"><p>Failed to generate dossier: ${escapeHTML(err.message)}</p></div>`;
    }
}

