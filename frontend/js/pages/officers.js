/**
 * officers.js
 * -----------
 * Full CRUD for Police Officers with station dropdown, filtering, and search.
 */

let allOfficers = [];
let allStations = [];
let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("officers", "Police Officers");
    await loadData();
});

async function loadData() {
    showLoading("tableBody", 6);
    try {
        const [officersRes, stationsRes] = await Promise.all([
            API.getOfficers(),
            API.getStations()
        ]);
        allOfficers = officersRes.data || [];
        allStations = stationsRes.data || [];

        populateStationDropdowns();
        renderTable(allOfficers);
    } catch (err) {
        showError("tableBody", err.message || "Failed to load officers.", 6);
    }
}

function populateStationDropdowns() {
    const filterSelect = document.getElementById("stationFilter");
    const formSelect = document.getElementById("stationId");

    filterSelect.innerHTML = '<option value="">All Stations</option>' +
        allStations.map(s => `<option value="${s.station_id}">${escapeHTML(s.station_name)}</option>`).join("");

    formSelect.innerHTML = '<option value="">Select Police Station</option>' +
        allStations.map(s => `<option value="${s.station_id}">${escapeHTML(s.station_name)}</option>`).join("");
}

function renderTable(officers) {
    const tbody = document.getElementById("tableBody");
    if (!officers || officers.length === 0) {
        showEmpty("tableBody", "No officers found.", 6);
        return;
    }

    tbody.innerHTML = officers.map(o => `
        <tr>
            <td><strong>#${o.officer_id}</strong></td>
            <td><strong>${escapeHTML(o.name)}</strong></td>
            <td><span class="badge badge-info">${escapeHTML(o.designation)}</span></td>
            <td><code>${escapeHTML(o.contact_number)}</code></td>
            <td>${escapeHTML(o.station_name || "—")}</td>
            <td class="actions">
                <button class="btn btn-sm btn-info" onclick="openEditModal(${o.officer_id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${o.officer_id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function filterOfficers() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const stationId = document.getElementById("stationFilter").value;

    let filtered = allOfficers;
    if (stationId) {
        filtered = filtered.filter(o => String(o.station_id) === String(stationId));
    }
    if (query) {
        filtered = filtered.filter(o =>
            o.name.toLowerCase().includes(query) ||
            o.designation.toLowerCase().includes(query) ||
            o.contact_number.toLowerCase().includes(query)
        );
    }
    renderTable(filtered);
}

function openAddModal() {
    editingId = null;
    document.getElementById("modalTitle").textContent = "Add Officer";
    document.getElementById("officerForm").reset();
    openModal("formModal");
}

function openEditModal(id) {
    const officer = allOfficers.find(o => o.officer_id === id);
    if (!officer) return;

    editingId = id;
    document.getElementById("modalTitle").textContent = "Edit Officer";
    document.getElementById("officerName").value = officer.name;
    document.getElementById("designation").value = officer.designation;
    document.getElementById("contactNumber").value = officer.contact_number;
    document.getElementById("stationId").value = officer.station_id;
    openModal("formModal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;

    const payload = {
        name: document.getElementById("officerName").value.trim(),
        designation: document.getElementById("designation").value.trim(),
        contact_number: document.getElementById("contactNumber").value.trim(),
        station_id: parseInt(document.getElementById("stationId").value, 10),
    };

    try {
        if (editingId) {
            await API.updateOfficer(editingId, payload);
            showToast("Officer record updated", "success");
        } else {
            await API.createOfficer(payload);
            showToast("Officer created successfully", "success");
        }
        closeModal("formModal");
        await loadData();
    } catch (err) {
        showToast(err.message || "Failed to save officer", "error");
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
        await API.deleteOfficer(editingId);
        showToast("Officer deleted successfully", "success");
        closeModal("deleteModal");
        await loadData();
    } catch (err) {
        showToast(err.message || "Cannot delete officer with registered cases/arrests.", "error");
    } finally {
        btn.disabled = false;
        editingId = null;
    }
}

