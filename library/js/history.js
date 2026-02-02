// History Page - Shows completed book reads
const API_BASE = '/library/api';
let currentUser = null;
let history = [];

document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUser();
    if (!currentUser) { window.location.href = 'login.html'; return; }
    await loadHistory();
    renderHistory();
});

function loadCurrentUser() {
    try {
        const stored = sessionStorage.getItem('currentUser');
        currentUser = stored ? JSON.parse(stored) : null;
        if (currentUser) {
            document.getElementById('userName').textContent = currentUser.full_name || currentUser.username;
            document.getElementById('userAvatar').textContent =
                (currentUser.full_name || currentUser.username || 'G').charAt(0).toUpperCase();
        }
    } catch (e) { currentUser = null; }
}

async function loadHistory() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_BASE}/history.php?userId=${currentUser.id}`);
        const result = await response.json();
        history = result.success ? result.data : [];
    } catch (e) { history = []; }
}

function renderHistory() {
    const container = document.getElementById('historyList');
    const emptyState = document.getElementById('emptyState');

    if (history.length === 0) { emptyState.style.display = 'block'; return; }
    emptyState.style.display = 'none';

    let onTimeCount = 0;
    let html = '';

    history.forEach(item => {
        const book = item.book || {};
        if (!item.overdue) onTimeCount++;

        html += `
            <div class="history-card ${item.overdue ? 'was-overdue' : ''}">
                <img src="${book.cover || 'https://via.placeholder.com/60x90'}" alt="${book.title}" class="book-thumb">
                <div class="book-info">
                    <h3>${book.title || 'Unknown'}</h3>
                    <p class="author">${book.author || 'Unknown'}</p>
                    <div class="dates">
                        <span><i class="fas fa-calendar-check"></i> Borrowed: ${item.borrowDate}</span>
                        <span><i class="fas fa-calendar-times"></i> Returned: ${item.returnDate}</span>
                    </div>
                </div>
                ${item.overdue ? '<span class="overdue-badge">Was Overdue</span>' : ''}
            </div>
        `;
    });

    container.innerHTML = html;
    document.getElementById('totalRead').textContent = history.length;
    document.getElementById('onTimeReturns').textContent = onTimeCount;
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
});
