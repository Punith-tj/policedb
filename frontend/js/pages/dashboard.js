/**
 * dashboard.js
 * -----------
 * Loads dashboard statistics from the API and renders
 * stat cards + two Chart.js charts (bar & doughnut).
 */

/* ── Chart instance references (for cleanup on re-render) ── */
let stationChartInstance = null;
let statusChartInstance = null;

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
    // Render sidebar, topbar, and verify authentication
    initPage('dashboard', 'Dashboard');

    // Fetch and display dashboard data
    loadDashboardData();
});

/**
 * Fetch dashboard stats from the API, populate stat cards,
 * and build both charts.
 */
async function loadDashboardData() {
    try {
        // Show a simple loading indicator in each stat value
        setStatLoading(true);

        const response = await API.getDashboardStats();

        if (!response.success) {
            showToast(response.message || 'Failed to load dashboard data', 'error');
            return;
        }

        const data = response.data;

        /* ── Populate stat cards ── */
        document.getElementById('totalFirs').textContent     = data.totalFirs     ?? 0;
        document.getElementById('pendingFirs').textContent    = data.pendingFirs   ?? 0;
        document.getElementById('solvedFirs').textContent     = data.solvedFirs    ?? 0;
        document.getElementById('totalOfficers').textContent  = data.totalOfficers ?? 0;
        document.getElementById('totalCriminals').textContent = data.totalCriminals ?? 0;

        /* ── Build charts ── */
        buildStationChart(data.casesPerStation || []);
        buildStatusChart(data.casesByStatus || []);

    } catch (err) {
        console.error('Dashboard load error:', err);
        showToast('Error loading dashboard data', 'error');
    }
}

/* ── Helpers ── */

/**
 * Toggle a loading placeholder on all stat-value elements.
 */
function setStatLoading(loading) {
    const ids = ['totalFirs', 'pendingFirs', 'solvedFirs', 'totalOfficers', 'totalCriminals'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = loading ? '...' : '—';
    });
}

/**
 * Build a Bar chart — Cases Per Station.
 * @param {Array} casesPerStation - [{station_name, case_count}, ...]
 */
function buildStationChart(casesPerStation) {
    const ctx = document.getElementById('stationChart');
    if (!ctx) return;

    // Destroy previous instance to prevent canvas reuse errors
    if (stationChartInstance) {
        stationChartInstance.destroy();
    }

    const labels = casesPerStation.map(s => s.station_name);
    const counts = casesPerStation.map(s => s.case_count);

    stationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cases',
                data: counts,
                backgroundColor: 'rgba(52, 152, 219, 0.7)',   // blue fill
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 }   // whole numbers only
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

/**
 * Build a Doughnut chart — Cases By Status.
 * @param {Array} casesByStatus - [{status, count}, ...]
 */
function buildStatusChart(casesByStatus) {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;

    // Destroy previous instance
    if (statusChartInstance) {
        statusChartInstance.destroy();
    }

    const labels = casesByStatus.map(s => s.status);
    const counts = casesByStatus.map(s => s.count);

    // Map each status to its designated colour
    const colorMap = {
        'Pending':              '#f1c40f',   // yellow
        'Under Investigation':  '#3498db',   // blue
        'Solved':               '#2ecc71',   // green
        'Closed':               '#95a5a6'    // gray
    };

    const backgroundColors = labels.map(label => colorMap[label] || '#bdc3c7');

    statusChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}
