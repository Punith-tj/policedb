/**
 * criminals.js
 * ------------
 * Full CRUD for Criminal records + Criminal Dossier / History Modal.
 */

let allCriminals = [];
let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("criminals", "Criminal Records");
    await loadCriminals();
});

async function loadCriminals() {
    showLoading("tableBody", 6);
    try {
        const res = await API.getCriminals();
        allCriminals = res.data || [];
        renderTable(allCriminals);
    } catch (err) {
        showError("tableBody", err.message || "Failed to load criminals.", 6);
    }
}

function renderTable(criminals) {
    const tbody = document.getElementById("tableBody");
    if (!criminals || criminals.length === 0) {
        showEmpty("tableBody", "No criminal records found.", 6);
        return;
    }

    tbody.innerHTML = criminals.map(c => `
        <tr>
            <td><strong>#${c.criminal_id}</strong></td>
            <td><strong>${escapeHTML(c.name)}</strong></td>
            <td>${c.age} yrs</td>
            <td>${escapeHTML(c.gender)}</td>
            <td>${escapeHTML(c.address)}</td>
            <td class="actions">
                <button class="btn btn-sm btn-info" onclick="viewHistory(${c.criminal_id})">Dossier</button>
                <button class="btn btn-sm btn-secondary" onclick="openEditModal(${c.criminal_id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${c.criminal_id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function handleSearch() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    if (!query) {
        renderTable(allCriminals);
        return;
    }
    const filtered = allCriminals.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.address.toLowerCase().includes(query) ||
        c.gender.toLowerCase().includes(query)
    );
    renderTable(filtered);
}

function openAddModal() {
    editingId = null;
    document.getElementById("modalTitle").textContent = "Add Criminal Record";
    document.getElementById("criminalForm").reset();
    openModal("formModal");
}

function openEditModal(id) {
    const c = allCriminals.find(item => item.criminal_id === id);
    if (!c) return;

    editingId = id;
    document.getElementById("modalTitle").textContent = "Edit Criminal Record";
    document.getElementById("criminalName").value = c.name;
    document.getElementById("age").value = c.age;
    document.getElementById("gender").value = c.gender;
    document.getElementById("address").value = c.address;
    openModal("formModal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;

    const payload = {
        name: document.getElementById("criminalName").value.trim(),
        age: parseInt(document.getElementById("age").value, 10),
        gender: document.getElementById("gender").value,
        address: document.getElementById("address").value.trim(),
    };

    try {
        if (editingId) {
            await API.updateCriminal(editingId, payload);
            showToast("Criminal record updated", "success");
        } else {
            await API.createCriminal(payload);
            showToast("Criminal record added", "success");
        }
        closeModal("formModal");
        await loadCriminals();
    } catch (err) {
        showToast(err.message || "Failed to save record", "error");
    } finally {
        btn.disabled = false;
    }
}

async function viewHistory(id) {
    document.getElementById("historyProfile").innerHTML = "<p>Loading profile...</p>";
    showLoading("historyCasesTableBody", 5);
    showLoading("historyArrestsTableBody", 5);
    openModal("historyModal");

    try {
        const res = await API.getCriminalHistory(id);
        const data = res.data;
        const crim = data.criminal;

        document.getElementById("historyModalTitle").textContent = `Dossier: ${crim.name}`;
        document.getElementById("historyProfile").innerHTML = `
            <strong>Name:</strong> ${escapeHTML(crim.name)} &nbsp;|&nbsp;
            <strong>Age:</strong> ${crim.age} &nbsp;|&nbsp;
            <strong>Gender:</strong> ${escapeHTML(crim.gender)} &nbsp;|&nbsp;
            <strong>Address:</strong> ${escapeHTML(crim.address)}
        `;

        // Render Cases
        const casesTbody = document.getElementById("historyCasesTableBody");
        if (!data.linked_cases || data.linked_cases.length === 0) {
            showEmpty("historyCasesTableBody", "No FIR cases linked to this criminal.", 5);
        } else {
            casesTbody.innerHTML = data.linked_cases.map(lc => `
                <tr>
                    <td><strong>${escapeHTML(lc.fir_number)}</strong></td>
                    <td>${escapeHTML(lc.case_type)}</td>
                    <td>${formatDate(lc.registration_date)}</td>
                    <td>${statusBadge(lc.status || lc.case_status)}</td>
                    <td>${escapeHTML(lc.station_name || "—")}</td>
                </tr>
            `).join("");
        }

        // Render Arrests
        const arrestsTbody = document.getElementById("historyArrestsTableBody");
        if (!data.arrests || data.arrests.length === 0) {
            showEmpty("historyArrestsTableBody", "No arrest records for this individual.", 5);
        } else {
            arrestsTbody.innerHTML = data.arrests.map(ar => `
                <tr>
                    <td>#${ar.arrest_id}</td>
                    <td>${formatDate(ar.arrest_date)}</td>
                    <td>${escapeHTML(ar.location || ar.arrest_location)}</td>
                    <td>${escapeHTML(ar.fir_number)}</td>
                    <td>${escapeHTML(ar.arresting_officer)}</td>
                </tr>
            `).join("");
        }

    } catch (err) {
        showToast("Failed to load dossier: " + err.message, "error");
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
        await API.deleteCriminal(editingId);
        showToast("Criminal record deleted successfully", "success");
        closeModal("deleteModal");
        await loadCriminals();
    } catch (err) {
        showToast(err.message || "Cannot delete criminal: linked case records exist.", "error");
    } finally {
        btn.disabled = false;
        editingId = null;
    }
}

