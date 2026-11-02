/**
 * victims.js
 * ----------
 * Full CRUD for Victim records.
 */

let allVictims = [];
let allCases = [];
let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("victims", "Victims");
    await loadInitialData();
});

async function loadInitialData() {
    showLoading("tableBody", 7);
    try {
        const [victimsRes, casesRes] = await Promise.all([
            API.getVictims(),
            API.getCases()
        ]);
        allVictims = victimsRes.data || [];
        allCases = casesRes.data || [];

        populateDropdowns();
        renderTable(allVictims);
    } catch (err) {
        showError("tableBody", err.message || "Failed to load victim records.", 7);
    }
}

function populateDropdowns() {
    const filterSelect = document.getElementById("firFilter");
    const formSelect = document.getElementById("firNumber");

    filterSelect.innerHTML = '<option value="">All FIRs</option>' +
        allCases.map(c => `<option value="${c.fir_number}">${escapeHTML(c.fir_number)} (${escapeHTML(c.case_type)})</option>`).join("");

    formSelect.innerHTML = '<option value="">Select FIR</option>' +
        allCases.map(c => `<option value="${c.fir_number}">${escapeHTML(c.fir_number)} - ${escapeHTML(c.case_type)}</option>`).join("");
}

function renderTable(victims) {
    const tbody = document.getElementById("tableBody");
    if (!victims || victims.length === 0) {
        showEmpty("tableBody", "No victim records found.", 7);
        return;
    }

    tbody.innerHTML = victims.map(v => `
        <tr>
            <td><strong>#${v.victim_id}</strong></td>
            <td><strong>${escapeHTML(v.name)}</strong></td>
            <td>${v.age} yrs</td>
            <td>${escapeHTML(v.gender)}</td>
            <td><code>${escapeHTML(v.contact_number || "—")}</code></td>
            <td><a href="case-details.html?fir=${encodeURIComponent(v.fir_number)}"><strong>${escapeHTML(v.fir_number)}</strong></a></td>
            <td class="actions">
                <button class="btn btn-sm btn-info" onclick="openEditModal(${v.victim_id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${v.victim_id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function filterVictims() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const fir = document.getElementById("firFilter").value;

    let filtered = allVictims;
    if (fir) {
        filtered = filtered.filter(v => v.fir_number === fir);
    }
    if (query) {
        filtered = filtered.filter(v =>
            v.name.toLowerCase().includes(query) ||
            (v.contact_number && v.contact_number.includes(query)) ||
            v.fir_number.toLowerCase().includes(query)
        );
    }
    renderTable(filtered);
}

function openAddModal() {
    editingId = null;
    document.getElementById("modalTitle").textContent = "Register Victim";
    document.getElementById("victimForm").reset();
    openModal("formModal");
}

function openEditModal(id) {
    const v = allVictims.find(item => item.victim_id === id);
    if (!v) return;

    editingId = id;
    document.getElementById("modalTitle").textContent = `Edit Victim #${id}`;
    document.getElementById("victimName").value = v.name;
    document.getElementById("age").value = v.age;
    document.getElementById("gender").value = v.gender;
    document.getElementById("contactNumber").value = v.contact_number || "";
    document.getElementById("firNumber").value = v.fir_number;
    openModal("formModal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;

    const payload = {
        name: document.getElementById("victimName").value.trim(),
        age: parseInt(document.getElementById("age").value, 10),
        gender: document.getElementById("gender").value,
        contact_number: document.getElementById("contactNumber").value.trim() || null,
        fir_number: document.getElementById("firNumber").value,
    };

    try {
        if (editingId) {
            await API.updateVictim(editingId, payload);
            showToast("Victim record updated", "success");
        } else {
            await API.createVictim(payload);
            showToast("Victim registered successfully", "success");
        }
        closeModal("formModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Failed to save victim record", "error");
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
        await API.deleteVictim(editingId);
        showToast("Victim record deleted", "success");
        closeModal("deleteModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Failed to delete victim record", "error");
    } finally {
        btn.disabled = false;
        editingId = null;
    }
}

