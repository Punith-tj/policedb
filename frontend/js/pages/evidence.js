/**
 * evidence.js
 * -----------
 * Full CRUD for Evidence catalog.
 */

let allEvidence = [];
let allCases = [];
let editingId = null;

document.addEventListener("DOMContentLoaded", async () => {
    await initPage("evidence", "Evidence");
    await loadInitialData();
});

async function loadInitialData() {
    showLoading("tableBody", 6);
    try {
        const [evidenceRes, casesRes] = await Promise.all([
            API.getEvidence(),
            API.getCases()
        ]);
        allEvidence = evidenceRes.data || [];
        allCases = casesRes.data || [];

        populateDropdowns();
        renderTable(allEvidence);
    } catch (err) {
        showError("tableBody", err.message || "Failed to load evidence records.", 6);
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

function renderTable(evidenceList) {
    const tbody = document.getElementById("tableBody");
    if (!evidenceList || evidenceList.length === 0) {
        showEmpty("tableBody", "No evidence catalogued yet.", 6);
        return;
    }

    tbody.innerHTML = evidenceList.map(e => `
        <tr>
            <td><strong>#${e.evidence_id}</strong></td>
            <td><span class="badge badge-info">${escapeHTML(e.evidence_type)}</span></td>
            <td>${formatDate(e.collection_date)}</td>
            <td><a href="case-details.html?fir=${encodeURIComponent(e.fir_number)}"><strong>${escapeHTML(e.fir_number)}</strong></a></td>
            <td>${escapeHTML(e.description || "—")}</td>
            <td class="actions">
                <button class="btn btn-sm btn-info" onclick="openEditModal(${e.evidence_id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="openDeleteModal(${e.evidence_id})">Delete</button>
            </td>
        </tr>
    `).join("");
}

function filterEvidence() {
    const query = document.getElementById("searchInput").value.toLowerCase().trim();
    const fir = document.getElementById("firFilter").value;

    let filtered = allEvidence;
    if (fir) {
        filtered = filtered.filter(e => e.fir_number === fir);
    }
    if (query) {
        filtered = filtered.filter(e =>
            e.evidence_type.toLowerCase().includes(query) ||
            (e.description && e.description.toLowerCase().includes(query)) ||
            e.fir_number.toLowerCase().includes(query)
        );
    }
    renderTable(filtered);
}

function openAddModal() {
    editingId = null;
    document.getElementById("modalTitle").textContent = "Add Evidence Record";
    document.getElementById("evidenceForm").reset();
    document.getElementById("collectionDate").value = new Date().toISOString().split("T")[0];
    openModal("formModal");
}

function openEditModal(id) {
    const e = allEvidence.find(item => item.evidence_id === id);
    if (!e) return;

    editingId = id;
    document.getElementById("modalTitle").textContent = `Edit Evidence #${id}`;
    document.getElementById("evidenceType").value = e.evidence_type;
    document.getElementById("collectionDate").value = e.collection_date ? e.collection_date.split("T")[0] : "";
    document.getElementById("firNumber").value = e.fir_number;
    document.getElementById("description").value = e.description || "";
    openModal("formModal");
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("saveBtn");
    btn.disabled = true;

    const payload = {
        evidence_type: document.getElementById("evidenceType").value,
        collection_date: document.getElementById("collectionDate").value,
        fir_number: document.getElementById("firNumber").value,
        description: document.getElementById("description").value.trim() || null,
    };

    try {
        if (editingId) {
            await API.updateEvidence(editingId, payload);
            showToast("Evidence record updated", "success");
        } else {
            await API.createEvidence(payload);
            showToast("Evidence item catalogued", "success");
        }
        closeModal("formModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Failed to save evidence", "error");
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
        await API.deleteEvidence(editingId);
        showToast("Evidence record deleted", "success");
        closeModal("deleteModal");
        await loadInitialData();
    } catch (err) {
        showToast(err.message || "Failed to delete evidence", "error");
    } finally {
        btn.disabled = false;
        editingId = null;
    }
}

