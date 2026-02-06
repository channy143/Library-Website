// Stats Page - Reading Statistics
const API_BASE = 'api';
let currentUser = null;
let stats = null;
let borrowed = [];

document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUser();
    if (!currentUser) { window.location.href = 'login.html'; return; }
    await loadStats();
    renderStats();
});

function loadCurrentUser() {
    try {
        const stored = sessionStorage.getItem('currentUser');
        currentUser = stored ? JSON.parse(stored) : null;
    } catch (e) { currentUser = null; }
}

async function loadStats() {
    if (!currentUser) return;
    try {
        // Get full stats with monthly data
        const statsResponse = await fetch(`${API_BASE}/history?action=fullStats&userId=${currentUser.id}`);
        const text = await statsResponse.text();
        try {
            const statsResult = JSON.parse(text);
            stats = statsResult.success ? statsResult.data : null;
        } catch (e) {
            console.error('Failed to parse stats:', text.substring(0, 200));
            stats = null;
        }

        // Get current borrowed
        const borrowedResponse = await fetch(`${API_BASE}/borrow?action=list&userId=${currentUser.id}`);
        const borrowedText = await borrowedResponse.text();
        try {
            const borrowedResult = JSON.parse(borrowedText);
            borrowed = borrowedResult.success ? borrowedResult.data : [];
        } catch (e) {
            borrowed = [];
        }
    } catch (e) {
        console.error('Failed to load stats:', e);
        stats = null;
        borrowed = [];
    }
}

function renderStats() {
    if (!stats) {
        // Show empty state
        const container = document.querySelector('.stats-container');
        if (container) {
            container.innerHTML = '<div class="empty-state" style="text-align:center;padding:60px;color:var(--text-gray);"><i class="fas fa-chart-bar" style="font-size:48px;margin-bottom:16px;opacity:0.5;"></i><p>No reading statistics yet. Start borrowing books to see your stats!</p></div>';
        }
        return;
    }

    // Update stat cards
    const totalBooksEl = document.getElementById('totalBooks');
    const activeBorrowedEl = document.getElementById('activeBorrowed');
    const mostReadCategoryEl = document.getElementById('mostReadCategory');
    const readerScoreEl = document.getElementById('readerScore');
    const avgReadingDaysEl = document.getElementById('avgReadingDays');
    const overduePercentEl = document.getElementById('overduePercent');

    if (totalBooksEl) totalBooksEl.textContent = stats.totalBooks || 0;
    if (activeBorrowedEl) activeBorrowedEl.textContent = stats.currentBorrowed || borrowed.length || 0;
    if (mostReadCategoryEl) mostReadCategoryEl.textContent = stats.mostReadCategory || '-';
    if (avgReadingDaysEl) avgReadingDaysEl.textContent = stats.avgReadingDays ? `${stats.avgReadingDays} days` : '-';
    if (overduePercentEl) overduePercentEl.textContent = `${stats.overduePercentage || 0}%`;

    // Calculate reader score (books read * 10, minus overdue penalties)
    const score = Math.max(0, (stats.totalBooks * 10) - (stats.overdueCount * 5));
    if (readerScoreEl) readerScoreEl.textContent = score;

    // Render detailed sections
    renderCategories();
    renderMonthlyChart();
}

function renderCategories() {
    const container = document.getElementById('categoriesList');
    if (!container) return;

    if (!stats.categories || Object.keys(stats.categories).length === 0) {
        container.innerHTML = '<p style="color: var(--text-gray);">No reading history yet.</p>';
        return;
    }

    const total = Object.values(stats.categories).reduce((a, b) => a + b, 0);
    let html = '';

    for (const [cat, count] of Object.entries(stats.categories).sort((a, b) => b[1] - a[1])) {
        const percent = Math.round((count / total) * 100);
        html += `
            <div class="category-bar">
                <div class="category-info">
                    <span class="category-name">${cat}</span>
                    <span class="category-count">${count} books</span>
                </div>
                <div class="bar-bg">
                    <div class="bar-fill" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function renderMonthlyChart() {
    const container = document.getElementById('monthlyChart');
    if (!container) return;

    // Use new monthlyReading array format from fullStats
    if (!stats.monthlyReading || stats.monthlyReading.length === 0) {
        container.innerHTML = '<p style="color: var(--text-gray); text-align: center; padding: 40px;">No monthly data yet.</p>';
        return;
    }

    // monthlyReading is now an array: [{month: "2024-01", count: 3}, ...]
    const months = stats.monthlyReading.slice(0, 6).reverse(); // Latest 6, displayed left to right
    const maxVal = Math.max(...months.map(m => m.count));

    let html = '<div class="bar-chart">';
    months.forEach(item => {
        const count = item.count;
        const height = maxVal > 0 ? (count / maxVal) * 100 : 0;
        const label = new Date(item.month + '-01').toLocaleDateString('en-US', { month: 'short' });
        html += `
            <div class="bar-column">
                <div class="bar" style="height: ${height}%"><span>${count}</span></div>
                <div class="bar-label">${label}</div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
});

