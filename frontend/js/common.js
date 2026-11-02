/**
 * common.js — Shared UI Utilities
 *
 * Provides: sidebar rendering, toasts, modals, loading/empty/error states,
 *           CSV export, date formatting, and page initialization.
 * Used by every page in the application.
 */

// ============================================================
// Sidebar Navigation Items
// ============================================================
const NAV_ITEMS = [
  { page: "dashboard",    title: "Dashboard",    icon: "📊" },
  { section: "Management" },
  { page: "stations",     title: "Stations",     icon: "🏛️" },
  { page: "officers",     title: "Officers",     icon: "👮" },
  { page: "cases",        title: "FIR Cases",    icon: "📋" },
  { section: "Records" },
  { page: "criminals",    title: "Criminals",     icon: "🔍" },
  { page: "arrests",      title: "Arrests",      icon: "⛓️" },
  { page: "victims",      title: "Victims",      icon: "🛡️" },
  { page: "witnesses",    title: "Witnesses",    icon: "👁️" },
  { page: "evidence",     title: "Evidence",     icon: "🔬" },
  { section: "Analytics" },
  { page: "reports",      title: "Reports",      icon: "📈" },
];

// ============================================================
// Page Initialization
// ============================================================

/**
 * Initialize a page: check auth, render sidebar & topbar, set active nav.
 * Call this in DOMContentLoaded of every protected page.
 *
 * @param {string} pageName  - Must match a NAV_ITEMS page value (e.g., "stations")
 * @param {string} pageTitle - Display title for the topbar (e.g., "Police Stations")
 */
async function initPage(pageName, pageTitle) {
  // Check authentication first
  const session = await checkAuth();
  if (!session) return; // checkAuth redirects to login

  // Render sidebar
  const sidebar = document.getElementById("sidebar");
  if (sidebar) {
    sidebar.innerHTML = buildSidebarHTML(pageName);
  }

  // Render topbar
  const topbar = document.getElementById("topbar");
  if (topbar) {
    topbar.innerHTML = `
      <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
      <h1 class="page-title">${pageTitle}</h1>
      <div class="user-area">
        <span class="user-email">${session.user.email || "User"}</span>
        <button class="btn btn-sm btn-outline-light" onclick="handleLogout()">Logout</button>
      </div>
    `;
  }
}

/**
 * Builds sidebar HTML with the correct active item highlighted.
 */
function buildSidebarHTML(activePage) {
  let html = `
    <div class="sidebar-header">
      <div class="sidebar-logo">
        <span class="logo-icon">🚔</span>
        <span class="logo-text">Police DBMS</span>
      </div>
    </div>
    <nav class="sidebar-nav">
  `;

  for (const item of NAV_ITEMS) {
    if (item.section) {
      html += `<div class="nav-section">${item.section}</div>`;
    } else {
      const active = item.page === activePage ? "active" : "";
      html += `
        <a href="${item.page}.html" class="nav-item ${active}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.title}</span>
        </a>
      `;
    }
  }

  html += `</nav>`;
  return html;
}

/**
 * Toggle sidebar visibility on mobile.
 */
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("sidebar-open");
}

// ============================================================
// Toast Notifications (never use alert())
// ============================================================

/**
 * Show a toast notification.
 * @param {string} message - Text to display
 * @param {string} type    - "success" | "error" | "warning" | "info"
 * @param {number} duration - Auto-dismiss ms (default 4000)
 */
function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || "ℹ️"}</span>
    <span class="toast-message">${escapeHTML(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add("toast-show"));

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================
// Modal Helpers
// ============================================================

/** Open a modal overlay by ID. */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("modal-active");
    document.body.style.overflow = "hidden";
  }
}

/** Close a modal overlay by ID. */
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("modal-active");
    document.body.style.overflow = "";
  }
}

// Close modal on backdrop click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay") && e.target.classList.contains("modal-active")) {
    e.target.classList.remove("modal-active");
    document.body.style.overflow = "";
  }
});

// ============================================================
// Loading / Empty / Error States
// ============================================================

/**
 * Show a loading spinner inside a container element.
 * @param {string} containerId - ID of the container (e.g., "tableBody")
 * @param {number} colspan     - Number of table columns for <td> spanning
 */
function showLoading(containerId, colspan = 1) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (el.tagName === "TBODY") {
    el.innerHTML = `<tr><td colspan="${colspan}" class="state-cell">
      <div class="loading-spinner"></div><p>Loading...</p>
    </td></tr>`;
  } else {
    el.innerHTML = `<div class="state-box"><div class="loading-spinner"></div><p>Loading...</p></div>`;
  }
}

/**
 * Show an empty-state message.
 */
function showEmpty(containerId, message = "No records found.", colspan = 1) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (el.tagName === "TBODY") {
    el.innerHTML = `<tr><td colspan="${colspan}" class="state-cell">
      <span class="empty-icon">📭</span><p>${escapeHTML(message)}</p>
    </td></tr>`;
  } else {
    el.innerHTML = `<div class="state-box"><span class="empty-icon">📭</span><p>${escapeHTML(message)}</p></div>`;
  }
}

/**
 * Show an error message inside a container.
 */
function showError(containerId, message = "Something went wrong.", colspan = 1) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (el.tagName === "TBODY") {
    el.innerHTML = `<tr><td colspan="${colspan}" class="state-cell state-error">
      <span>❌</span><p>${escapeHTML(message)}</p>
    </td></tr>`;
  } else {
    el.innerHTML = `<div class="state-box state-error"><span>❌</span><p>${escapeHTML(message)}</p></div>`;
  }
}

// ============================================================
// CSV Export
// ============================================================

/**
 * Export an array of objects as a CSV file download.
 * Properly escapes commas, quotes, and newlines in cell values.
 *
 * @param {Array} data     - Array of objects (each object = one row)
 * @param {string} filename - File name (e.g., "stations.csv")
 * @param {Array}  columns  - Optional array of {key, label} to control column order/names
 */
function exportToCSV(data, filename, columns = null) {
  if (!data || data.length === 0) {
    showToast("No data to export.", "warning");
    return;
  }

  // Determine columns from data keys if not provided
  if (!columns) {
    columns = Object.keys(data[0]).map((key) => ({ key, label: key }));
  }

  // Build CSV content
  const header = columns.map((c) => escapeCSVField(c.label)).join(",");
  const rows = data.map((row) =>
    columns.map((c) => escapeCSVField(String(row[c.key] ?? ""))).join(",")
  );
  const csv = [header, ...rows].join("\n");

  // Trigger download
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);

  showToast(`Exported ${data.length} records to ${filename}`, "success");
}

/**
 * Escapes a CSV field value. Wraps in quotes if it contains commas,
 * quotes, or newlines. Doubles internal quotes.
 */
function escapeCSVField(value) {
  if (/[",\n\r]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

// ============================================================
// Utility Functions
// ============================================================

/** Format a date string (YYYY-MM-DD) to a readable format. */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    year: "numeric", month: "short", day: "numeric",
  });
}

/** Escape HTML to prevent XSS in dynamic content. */
function escapeHTML(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Get a status badge HTML string with appropriate color.
 */
function statusBadge(status) {
  const colors = {
    "Pending":              "badge-warning",
    "Under Investigation":  "badge-info",
    "Solved":               "badge-success",
    "Closed":               "badge-secondary",
  };
  const cls = colors[status] || "badge-secondary";
  return `<span class="badge ${cls}">${escapeHTML(status)}</span>`;
}

/**
 * Debounce helper for search inputs.
 */
function debounce(func, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Prepare a print view for a report section.
 */
function printSection(elementId, title) {
  const content = document.getElementById(elementId);
  if (!content) return;

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html><html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
      th { background: #1e3a5f; color: white; }
      h2 { color: #1e3a5f; }
      .badge { padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    </style></head><body>
    <h2>${title} — Police Record Management System</h2>
    <p>Generated: ${new Date().toLocaleString("en-IN")}</p>
    ${content.innerHTML}
    </body></html>
  `);
  printWindow.document.close();
  printWindow.print();
}

