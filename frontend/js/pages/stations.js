/**
 * stations.js
 * -----------
 * Full CRUD for Police Stations with search, validation, and modals.
 */

let allStations = [];
let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("stations", "Police Stations");
    await loadStations();
});

async function loadStations() {
    showLoading("tableBody", 5);
    try {
        const response = await API.getStations();
        allStations = response.data || [];
        renderTable(allStations);
    } catch (err) {
        showError("tableBody", err.message || "Failed to load police stations.", 5);
    }
}

function renderTable(stations) {
    const tbody = document.getElementById("tableBody");
    if (!stations || stations.length === 0) {
        showEmpty("tableBody", "No police stations registered yet.", 5);
        return;
    }

    tbody.innerHTML = stations.map(s => `
        <tr>
            <td><strong>#${s.station_id}</strong></td>
            <td><strong>${escapeHTML(s.station_name)}</strong></td>
            <td>${escapeHTML(s.location)}</td>
            <td><code>${escapeHTML(s.contact_number)}</code></td>
            <td class="actions">
                <button class="btn btn-sm btn-info" onclick="openEditModal(${s.station_id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${s.station_id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function handleSearch() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    if (!query) {
        renderTable(allStations);
        return;
    }
    const filtered = allStations.filter(s =>
        s.station_name.toLowerCase().includes(query) ||
        s.location.toLowerCase().includes(query) ||
        s.contact_number.toLowerCase().includes(query)
    );
    renderTable(filtered);
}

function openAddModal() {
    editingId = null;
    document.getElementById("modalTitle").textContent = "Add Police Station";
    document.getElementById("stationForm").reset();
    openModal("formModal");
}

function openEditModal(id) {
    const station = allStations.find(s => s.station_id === id);
    if (!station) return;

    editingId = id;
    document.getElementById("modalTitle").textContent = "Edit Police Station";
    document.getElementById("stationName").value = station.station_name;
    document.getElementById("location").value = station.location;
    document.getElementById("contactNumber").value = station.contact_number;
    openModal("formModal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;

    const payload = {
        station_name: document.getElementById("stationName").value.trim(),
        location: document.getElementById("location").value.trim(),
        contact_number: document.getElementById("contactNumber").value.trim(),
    };

    try {
        if (editingId) {
            await API.updateStation(editingId, payload);
            showToast("Station updated successfully", "success");
        } else {
            await API.createStation(payload);
            showToast("Station created successfully", "success");
        }
        closeModal("formModal");
        await loadStations();
    } catch (err) {
        showToast(err.message || "Failed to save station", "error");
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
        await API.deleteStation(editingId);
        showToast("Station deleted successfully", "success");
        closeModal("deleteModal");
        await loadStations();
    } catch (err) {
        showToast(err.message || "Cannot delete station. It may have officers or cases attached.", "error");
    } finally {
        btn.disabled = false;
        editingId = null;
    }
}

