/**
 * arrests.js
 * ----------
 * Full CRUD for Arrest records with trigger feedback handling.
 */

let allArrests = [];
let allCases = [];
let allCriminals = [];
let allOfficers = [];
let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("arrests", "Arrest Records");
    await loadInitialData();
});

async function loadInitialData() {
    showLoading("tableBody", 8);
    try {
        const [arrestsRes, casesRes, criminalsRes, officersRes] = await Promise.all([
            API.getArrests(),
            API.getCases(),
            API.getCriminals(),
            API.getOfficers()
        ]);
        allArrests = arrestsRes.data || [];
        allCases = casesRes.data || [];
        allCriminals = criminalsRes.data || [];
        allOfficers = officersRes.data || [];

        populateDropdowns();
        renderTable(allArrests);
    } catch (err) {
        showError("tableBody", err.message || "Failed to load arrest records.", 8);
    }
}

function populateDropdowns() {
    const firFilter = document.getElementById("firFilter");
    const firSelect = document.getElementById("firNumber");
    const criminalSelect = document.getElementById("criminalId");
    const officerSelect = document.getElementById("officerId");

    firFilter.innerHTML = '<option value="">All FIRs</option>' +
        allCases.map(c => `<option value="${c.fir_number}">${escapeHTML(c.fir_number)} (${escapeHTML(c.case_type)})</option>`).join("");

    firSelect.innerHTML = '<option value="">Select FIR</option>' +
        allCases.map(c => `<option value="${c.fir_number}">${escapeHTML(c.fir_number)} - ${escapeHTML(c.case_type)} [${escapeHTML(c.status)}]</option>`).join("");

    criminalSelect.innerHTML = '<option value="">Select Criminal</option>' +
        allCriminals.map(cr => `<option value="${cr.criminal_id}">${escapeHTML(cr.name)} (#${cr.criminal_id})</option>`).join("");

    officerSelect.innerHTML = '<option value="">Select Officer</option>' +
        allOfficers.map(o => `<option value="${o.officer_id}">${escapeHTML(o.name)} (${escapeHTML(o.designation)})</option>`).join("");
}

function renderTable(arrests) {
    const tbody = document.getElementById("tableBody");
    if (!arrests || arrests.length === 0) {
        showEmpty("tableBody", "No arrest records found.", 8);
        return;
    }

    tbody.innerHTML = arrests.map(a => `
        <tr>
            <td><strong>#${a.arrest_id}</strong></td>
            <td>${formatDate(a.arrest_date)}</td>
            <td>${escapeHTML(a.location)}</td>
            <td><strong>${escapeHTML(a.criminal_name || "—")}</strong></td>
            <td><code>${escapeHTML(a.fir_number)}</code></td>
            <td>${escapeHTML(a.case_type || "—")}</td>
            <td>${escapeHTML(a.arresting_officer || "—")}</td>
            <td class="actions">
                <button class="btn btn-sm btn-info" onclick="openEditModal(${a.arrest_id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${a.arrest_id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function filterArrests() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const fir = document.getElementById("firFilter").value;

    let filtered = allArrests;
    if (fir) {
        filtered = filtered.filter(a => a.fir_number === fir);
    }
    if (query) {
        filtered = filtered.filter(a =>
            (a.criminal_name && a.criminal_name.toLowerCase().includes(query)) ||
            (a.location && a.location.toLowerCase().includes(query)) ||
            (a.arresting_officer && a.arresting_officer.toLowerCase().includes(query)) ||
            a.fir_number.toLowerCase().includes(query)
        );
    }
    renderTable(filtered);
}

function openAddModal() {
    editingId = null;
    document.getElementById("modalTitle").textContent = "Record New Arrest";
    document.getElementById("arrestForm").reset();
    document.getElementById("arrestDate").value = new Date().toISOString().split("T")[0];
    openModal("formModal");
}

function openEditModal(id) {
    const a = allArrests.find(item => item.arrest_id === id);
    if (!a) return;

    editingId = id;
    document.getElementById("modalTitle").textContent = `Edit Arrest Record #${id}`;
    document.getElementById("arrestDate").value = a.arrest_date ? a.arrest_date.split("T")[0] : "";
    document.getElementById("arrestLocation").value = a.location;
    document.getElementById("firNumber").value = a.fir_number;
    document.getElementById("criminalId").value = a.criminal_id;
    document.getElementById("officerId").value = a.officer_id;
    openModal("formModal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;

    const payload = {
        arrest_date: document.getElementById("arrestDate").value,
        location: document.getElementById("arrestLocation").value.trim(),
        fir_number: document.getElementById("firNumber").value,
        criminal_id: parseInt(document.getElementById("criminalId").value, 10),
        officer_id: parseInt(document.getElementById("officerId").value, 10),
    };

    try {
        if (editingId) {
            await API.updateArrest(editingId, payload);
            showToast("Arrest record updated", "success");
        } else {
            await API.createArrest(payload);
            showToast("Arrest recorded successfully. Trigger checked status.", "success");
        }
        closeModal("formModal");
        await loadInitialData();
    } catch (err) {
        // Triggers emit SIGNAL '45000' which backend translates to 409 Conflict
        showToast(err.message || "Failed to record arrest", "error", 6000);
    } finally {
        btn.disabled = false;
    }
}

function openDeleteModal(id) {
    editingId = id;
    openModal("deleteModal");
}

async function confirmDelete() {
    if (!editingId) return;
    const btn = document.getElementById("confirmDeleteBtn");
    btn.disabled = true;

    try {
        await API.deleteArrest(editingId);
        showToast("Arrest record deleted", "success");
        closeModal("deleteModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Failed to delete arrest record", "error");
    } finally {
        btn.disabled = false;
        editingId = null;
    }
}

