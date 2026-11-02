/**
 * case-details.js
 * ---------------
 * Complete FIR case inspection page.
 * Loads main case details, linked criminals (M:N), victims, witnesses, evidence,
 * and arrests, and executes stored procedures (sp_assign_officer_to_case, sp_close_case).
 */

let currentFirNumber = null;
let currentCase = null;
let linkedCriminalIds = new Set();

document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    currentFirNumber = params.get("fir");

    if (!currentFirNumber) {
        window.location.href = "cases.html";
        return;
    }

    await initPage("cases", `FIR: ${currentFirNumber}`);
    await loadCaseDetails();
});

async function loadCaseDetails() {
    showLoading("criminalsTableBody", 6);
    showLoading("victimsTableBody", 5);
    showLoading("witnessesTableBody", 4);
    showLoading("evidenceTableBody", 4);
    showLoading("arrestsTableBody", 5);

    try {
        // Query full FIR details from reports endpoint or direct endpoints
        const res = await API.getFirDetails(currentFirNumber);
        const data = res.data;

        currentCase = data.fir;
        document.getElementById("headerFirNumber").textContent = `Case File: ${currentCase.fir_number}`;
        document.getElementById("detailCaseType").textContent = currentCase.case_type || "—";
        document.getElementById("detailDate").textContent = formatDate(currentCase.registration_date);
        document.getElementById("detailStatus").innerHTML = statusBadge(currentCase.status);
        document.getElementById("detailLocation").textContent = currentCase.incident_location || currentCase.location || "—";
        document.getElementById("detailOfficer").textContent = currentCase.investigating_officer
            ? `${currentCase.investigating_officer} (${currentCase.officer_designation || "Officer"})`
            : "Unassigned";
        document.getElementById("detailStation").textContent = currentCase.station_name || "—";
        document.getElementById("detailDescription").textContent = currentCase.description || "No description provided.";

        // If case is closed, disable close button
        const closeBtn = document.getElementById("closeCaseBtn");
        if (currentCase.status === "Closed") {
            closeBtn.disabled = true;
            closeBtn.textContent = "✓ Case Closed";
        } else {
            closeBtn.disabled = false;
            closeBtn.textContent = "🔒 Close Case";
        }

        // Render sub-tables
        renderCriminals(data.criminals || []);
        renderVictims(data.victims || []);
        renderWitnesses(data.witnesses || []);
        renderEvidence(data.evidence || []);
        renderArrests(data.arrests || []);

    } catch (err) {
        showToast(err.message || "Failed to load case details", "error");
        document.getElementById("headerFirNumber").textContent = "Case Details (Error)";
    }
}

function renderCriminals(criminals) {
    linkedCriminalIds.clear();
    const tbody = document.getElementById("criminalsTableBody");
    if (!criminals || criminals.length === 0) {
        showEmpty("criminalsTableBody", "No suspect/criminal records linked to this FIR yet.", 6);
        return;
    }

    tbody.innerHTML = criminals.map(c => {
        linkedCriminalIds.add(c.criminal_id);
        return `
            <tr>
                <td><strong>#${c.criminal_id}</strong></td>
                <td><strong>${escapeHTML(c.name)}</strong></td>
                <td>${c.age}</td>
                <td>${escapeHTML(c.gender)}</td>
                <td>${escapeHTML(c.address)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-danger" onclick="unlinkCriminal(${c.criminal_id})">Unlink</button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderVictims(victims) {
    const tbody = document.getElementById("victimsTableBody");
    if (!victims || victims.length === 0) {
        showEmpty("victimsTableBody", "No victims registered for this case.", 5);
        return;
    }
    tbody.innerHTML = victims.map(v => `
        <tr>
            <td>#${v.victim_id}</td>
            <td><strong>${escapeHTML(v.name)}</strong></td>
            <td>${v.age}</td>
            <td>${escapeHTML(v.gender)}</td>
            <td><code>${escapeHTML(v.contact_number || "—")}</code></td>
        </tr>
    `).join("");
}

function renderWitnesses(witnesses) {
    const tbody = document.getElementById("witnessesTableBody");
    if (!witnesses || witnesses.length === 0) {
        showEmpty("witnessesTableBody", "No witness statements recorded.", 4);
        return;
    }
    tbody.innerHTML = witnesses.map(w => `
        <tr>
            <td>#${w.witness_id}</td>
            <td><strong>${escapeHTML(w.name)}</strong></td>
            <td>${w.age}</td>
            <td><code>${escapeHTML(w.contact_number || "—")}</code></td>
        </tr>
    `).join("");
}

function renderEvidence(evidence) {
    const tbody = document.getElementById("evidenceTableBody");
    if (!evidence || evidence.length === 0) {
        showEmpty("evidenceTableBody", "No evidence catalogued yet.", 4);
        return;
    }
    tbody.innerHTML = evidence.map(e => `
        <tr>
            <td>#${e.evidence_id}</td>
            <td><span class="badge badge-info">${escapeHTML(e.evidence_type)}</span></td>
            <td>${formatDate(e.collection_date)}</td>
            <td>${escapeHTML(e.description || "—")}</td>
        </tr>
    `).join("");
}

function renderArrests(arrests) {
    const tbody = document.getElementById("arrestsTableBody");
    if (!arrests || arrests.length === 0) {
        showEmpty("arrestsTableBody", "No arrests recorded under this FIR.", 5);
        return;
    }
    tbody.innerHTML = arrests.map(a => `
        <tr>
            <td>#${a.arrest_id}</td>
            <td>${formatDate(a.arrest_date)}</td>
            <td>${escapeHTML(a.location)}</td>
            <td><strong>${escapeHTML(a.criminal_name)}</strong></td>
            <td>${escapeHTML(a.arresting_officer)}</td>
        </tr>
    `).join("");
}

/* ── Stored Procedure: Assign Officer ── */
async function openAssignOfficerModal() {
    const select = document.getElementById("assignOfficerSelect");
    select.innerHTML = '<option value="">Loading officers...</option>';
    openModal("assignOfficerModal");

    try {
        const res = await API.getOfficers();
        const officers = res.data || [];
        select.innerHTML = '<option value="">-- Choose Officer --</option>' +
            officers.map(o => `
                <option value="${o.officer_id}" ${o.officer_id === currentCase?.officer_id ? "selected" : ""}>
                    ${escapeHTML(o.name)} (${escapeHTML(o.designation)}) - ${escapeHTML(o.station_name || "")}
                </option>
            `).join("");
    } catch (err) {
        showToast("Failed to load officers: " + err.message, "error");
    }
}

async function submitAssignOfficer(e) {
    e.preventDefault();
    const officerId = parseInt(document.getElementById("assignOfficerSelect").value, 10);
    const btn = document.getElementById("assignOfficerSubmitBtn");
    btn.disabled = true;

    try {
        await API.assignOfficer(currentFirNumber, officerId);
        showToast("Investigating officer assigned successfully via sp_assign_officer_to_case", "success");
        closeModal("assignOfficerModal");
        await loadCaseDetails();
    } catch (err) {
        showToast(err.message || "Failed to assign officer", "error");
    } finally {
        btn.disabled = false;
    }
}

/* ── Stored Procedure: Close Case ── */
async function handleCloseCase() {
    if (!confirm(`Are you sure you want to officially CLOSE case ${currentFirNumber}? Stored procedure sp_close_case will verify that the case is active.`)) {
        return;
    }

    try {
        await API.closeCase(currentFirNumber);
        showToast("Case closed successfully via sp_close_case", "success");
        await loadCaseDetails();
    } catch (err) {
        showToast(err.message || "Failed to close case", "error");
    }
}

/* ── Junction Table: Link Criminal ── */
async function openLinkCriminalModal() {
    const select = document.getElementById("criminalSelect");
    select.innerHTML = '<option value="">Loading criminals...</option>';
    openModal("linkCriminalModal");

    try {
        const res = await API.getCriminals();
        const criminals = res.data || [];
        // Exclude already linked criminals
        const available = criminals.filter(c => !linkedCriminalIds.has(c.criminal_id));

        if (available.length === 0) {
            select.innerHTML = '<option value="">All registered criminals are already linked</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Choose Criminal --</option>' +
            available.map(c => `
                <option value="${c.criminal_id}">${escapeHTML(c.name)} (Age ${c.age}, ${escapeHTML(c.gender)})</option>
            `).join("");
    } catch (err) {
        showToast("Failed to load criminal records: " + err.message, "error");
    }
}

async function submitLinkCriminal(e) {
    e.preventDefault();
    const crimId = parseInt(document.getElementById("criminalSelect").value, 10);
    if (!crimId) return;

    const btn = document.getElementById("linkCriminalSubmitBtn");
    btn.disabled = true;

    try {
        await API.linkCriminal({ fir_number: currentFirNumber, criminal_id: crimId });
        showToast("Criminal record linked to FIR successfully", "success");
        closeModal("linkCriminalModal");
        await loadCaseDetails();
    } catch (err) {
        showToast(err.message || "Failed to link criminal", "error");
    } finally {
        btn.disabled = false;
    }
}

async function unlinkCriminal(crimId) {
    if (!confirm("Are you sure you want to remove this criminal association from the case?")) return;

    try {
        await API.unlinkCriminal(currentFirNumber, crimId);
        showToast("Criminal record unlinked successfully", "success");
        await loadCaseDetails();
    } catch (err) {
        showToast(err.message || "Failed to unlink criminal", "error");
    }
}

