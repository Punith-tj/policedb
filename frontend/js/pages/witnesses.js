/**
 * witnesses.js
 * ------------
 * Full CRUD for Witness records.
 */

let allWitnesses = [];
let allCases = [];
let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("witnesses", "Witnesses");
    await loadInitialData();
});

async function loadInitialData() {
    showLoading("tableBody", 6);
    try {
        const [witnessesRes, casesRes] = await Promise.all([
            API.getWitnesses(),
            API.getCases()
        ]);
        allWitnesses = witnessesRes.data || [];
        allCases = casesRes.data || [];

        populateDropdowns();
        renderTable(allWitnesses);
    } catch (err) {
        showError("tableBody", err.message || "Failed to load witnesses.", 6);
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

function renderTable(witnesses) {
    const tbody = document.getElementById("tableBody");
    if (!witnesses || witnesses.length === 0) {
        showEmpty("tableBody", "No witness statements recorded.", 6);
        return;
    }

    tbody.innerHTML = witnesses.map(w => `
        <tr>
            <td><strong>#${w.witness_id}</strong></td>
            <td><strong>${escapeHTML(w.name)}</strong></td>
            <td>${w.age} yrs</td>
            <td><code>${escapeHTML(w.contact_number || "—")}</code></td>
            <td><a href="case-details.html?fir=${encodeURIComponent(w.fir_number)}"><strong>${escapeHTML(w.fir_number)}</strong></a></td>
            <td class="actions">
                <button class="btn btn-sm btn-info" onclick="openEditModal(${w.witness_id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${w.witness_id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function filterWitnesses() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const fir = document.getElementById("firFilter").value;

    let filtered = allWitnesses;
    if (fir) {
        filtered = filtered.filter(w => w.fir_number === fir);
    }
    if (query) {
        filtered = filtered.filter(w =>
            w.name.toLowerCase().includes(query) ||
            (w.contact_number && w.contact_number.includes(query)) ||
            w.fir_number.toLowerCase().includes(query)
        );
    }
    renderTable(filtered);
}

function openAddModal() {
    editingId = null;
    document.getElementById("modalTitle").textContent = "Record Witness Statement";
    document.getElementById("witnessForm").reset();
    openModal("formModal");
}

function openEditModal(id) {
    const w = allWitnesses.find(item => item.witness_id === id);
    if (!w) return;

    editingId = id;
    document.getElementById("modalTitle").textContent = `Edit Witness #${id}`;
    document.getElementById("witnessName").value = w.name;
    document.getElementById("age").value = w.age;
    document.getElementById("contactNumber").value = w.contact_number || "";
    document.getElementById("firNumber").value = w.fir_number;
    openModal("formModal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;

    const payload = {
        name: document.getElementById("witnessName").value.trim(),
        age: parseInt(document.getElementById("age").value, 10),
        contact_number: document.getElementById("contactNumber").value.trim() || null,
        fir_number: document.getElementById("firNumber").value,
    };

    try {
        if (editingId) {
            await API.updateWitness(editingId, payload);
            showToast("Witness statement updated", "success");
        } else {
            await API.createWitness(payload);
            showToast("Witness statement recorded", "success");
        }
        closeModal("formModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Failed to save witness", "error");
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
        await API.deleteWitness(editingId);
        showToast("Witness statement deleted", "success");
        closeModal("deleteModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Failed to delete witness", "error");
    } finally {
        btn.disabled = false;
        editingId = null;
    }
}

