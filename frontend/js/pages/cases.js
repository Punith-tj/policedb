/**
 * cases.js
 * --------
 * Full CRUD for First Information Reports (FIRs) with filters, search, and navigation.
 */

let allCases = [];
let allStations = [];
let allOfficers = [];
let editingFir = null;
let deletingFir = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("cases", "FIR Cases");
    await loadInitialData();
});

async function loadInitialData() {
    showLoading("casesTableBody", 8);
    try {
        const [casesRes, stationsRes, officersRes] = await Promise.all([
            API.getCases(),
            API.getStations(),
            API.getOfficers()
        ]);
        allCases = casesRes.data || [];
        allStations = stationsRes.data || [];
        allOfficers = officersRes.data || [];

        populateDropdowns();
        renderTable(allCases);
    } catch (err) {
        showError("casesTableBody", err.message || "Failed to load cases.", 8);
    }
}

function populateDropdowns() {
    const stationFilter = document.getElementById("stationFilter");
    const stationSelect = document.getElementById("station_id");
    const officerSelect = document.getElementById("officer_id");

    stationFilter.innerHTML = '<option value="">All Stations</option>' +
        allStations.map(s => `<option value="${s.station_id}">${escapeHTML(s.station_name)}</option>`).join("");

    stationSelect.innerHTML = '<option value="">-- Select Station --</option>' +
        allStations.map(s => `<option value="${s.station_id}">${escapeHTML(s.station_name)}</option>`).join("");

    officerSelect.innerHTML = '<option value="">-- Select Officer --</option>' +
        allOfficers.map(o => `<option value="${o.officer_id}">${escapeHTML(o.name)} (${escapeHTML(o.designation)})</option>`).join("");
}

function renderTable(cases) {
    const tbody = document.getElementById("casesTableBody");
    if (!cases || cases.length === 0) {
        showEmpty("casesTableBody", "No FIR cases found.", 8);
        return;
    }

    tbody.innerHTML = cases.map(c => `
        <tr>
            <td><strong>${escapeHTML(c.fir_number)}</strong></td>
            <td>${escapeHTML(c.case_type)}</td>
            <td>${formatDate(c.registration_date)}</td>
            <td>${escapeHTML(c.location)}</td>
            <td>${statusBadge(c.status)}</td>
            <td>${escapeHTML(c.officer_name || "Unassigned")}</td>
            <td>${escapeHTML(c.station_name || "—")}</td>
            <td class="actions">
                <a href="case-details.html?fir=${encodeURIComponent(c.fir_number)}" class="btn btn-sm btn-info">View</a>
                <button class="btn btn-sm btn-secondary" onclick="openEditModal('${c.fir_number}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="openDeleteModal('${c.fir_number}')">Delete</button>
            </td>
        </tr>
    `).join("");
}

function handleSearch() { applyFilters(); }
function handleStatusFilter() { applyFilters(); }
function handleStationFilter() { applyFilters(); }

function applyFilters() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const status = document.getElementById("statusFilter").value;
    const stationId = document.getElementById("stationFilter").value;

    let filtered = allCases;
    if (status) {
        filtered = filtered.filter(c => c.status === status);
    }
    if (stationId) {
        filtered = filtered.filter(c => String(c.station_id) === String(stationId));
    }
    if (query) {
        filtered = filtered.filter(c =>
            c.fir_number.toLowerCase().includes(query) ||
            c.case_type.toLowerCase().includes(query) ||
            (c.location && c.location.toLowerCase().includes(query)) ||
            (c.description && c.description.toLowerCase().includes(query))
        );
    }
    renderTable(filtered);
}

function openAddModal() {
    editingFir = null;
    document.getElementById("formModalTitle").textContent = "Register New FIR";
    document.getElementById("formSubmitBtn").textContent = "Register FIR";
    document.getElementById("firNumberGroup").style.display = "block";
    document.getElementById("fir_number").required = true;
    document.getElementById("caseForm").reset();

    // Default registration date to today
    document.getElementById("registration_date").value = new Date().toISOString().split("T")[0];
    openModal("formModal");
}

function openEditModal(firNumber) {
    const c = allCases.find(item => item.fir_number === firNumber);
    if (!c) return;

    editingFir = firNumber;
    document.getElementById("formModalTitle").textContent = `Edit FIR: ${firNumber}`;
    document.getElementById("formSubmitBtn").textContent = "Update FIR";
    document.getElementById("firNumberGroup").style.display = "none";
    document.getElementById("fir_number").required = false;

    document.getElementById("case_type").value = c.case_type;
    document.getElementById("registration_date").value = c.registration_date ? c.registration_date.split("T")[0] : "";
    document.getElementById("location").value = c.location || "";
    document.getElementById("description").value = c.description || "";
    document.getElementById("status").value = c.status;
    document.getElementById("officer_id").value = c.officer_id || "";
    document.getElementById("station_id").value = c.station_id || "";

    openModal("formModal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("formSubmitBtn");
    btn.disabled = true;

    const payload = {
        case_type: document.getElementById("case_type").value.trim(),
        registration_date: document.getElementById("registration_date").value,
        location: document.getElementById("location").value.trim(),
        description: document.getElementById("description").value.trim(),
        status: document.getElementById("status").value,
        officer_id: parseInt(document.getElementById("officer_id").value, 10),
        station_id: parseInt(document.getElementById("station_id").value, 10),
    };

    try {
        if (editingFir) {
            await API.updateCase(editingFir, payload);
            showToast("FIR updated successfully", "success");
        } else {
            payload.fir_number = document.getElementById("fir_number").value.trim();
            await API.createCase(payload);
            showToast("FIR registered successfully", "success");
        }
        closeModal("formModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Failed to save FIR", "error");
    } finally {
        btn.disabled = false;
    }
}

function openDeleteModal(firNumber) {
    deletingFir = firNumber;
    document.getElementById("deleteFirNumber").textContent = firNumber;
    openModal("deleteModal");
}

async function confirmDelete() {
    if (!deletingFir) return;
    const btn = document.getElementById("confirmDeleteBtn");
    btn.disabled = true;

    try {
        await API.deleteCase(deletingFir);
        showToast("FIR deleted successfully", "success");
        closeModal("deleteModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Cannot delete FIR: historical evidence/arrests depend on it.", "error");
    } finally {
        btn.disabled = false;
        deletingFir = null;
    }
}

