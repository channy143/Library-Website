// Due Dates Page - Shows user's borrowed books
const API_BASE = 'api';

let currentUser = null;
let borrowedBooks = [];

document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUser();
    checkAuth();
    await loadBorrowedBooks();
    renderDueDates();
    updateSummary();
});

function loadCurrentUser() {
    try {
        const stored = sessionStorage.getItem('currentUser');
        currentUser = stored ? JSON.parse(stored) : null;

        if (currentUser) {
            document.getElementById('userName').textContent = currentUser.full_name || currentUser.username;
            const initials = (currentUser.full_name || currentUser.username || 'G').split(' ')
                .map(n => n[0]).join('').toUpperCase().slice(0, 2);
            document.getElementById('userAvatar').textContent = initials;
        }
    } catch (e) {
        currentUser = null;
    }
}

function checkAuth() {
    if (!currentUser) {
        window.location.href = 'login.html';
    }
}

async function loadBorrowedBooks() {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/borrow?action=list&userId=${currentUser.id}`);
        const result = await response.json();
        borrowedBooks = result.success ? result.data : [];
    } catch (e) {
        console.error('Failed to load borrowed books:', e);
        borrowedBooks = [];
    }
}

function getDaysRemaining(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

function renderDueDates() {
    const container = document.getElementById('dueDatesList');
    const emptyState = document.getElementById('emptyState');

    if (borrowedBooks.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Sort by due date (most urgent first)
    const sorted = [...borrowedBooks].sort((a, b) =>
        new Date(a.dueDate) - new Date(b.dueDate)
    );

    let html = '';
    sorted.forEach(item => {
        const book = item.book || {};
        const daysLeft = getDaysRemaining(item.dueDate);
        const isOverdue = daysLeft < 0;
        const isDueSoon = daysLeft >= 0 && daysLeft <= 3;

        let statusClass = '';
        let statusText = '';

        if (isOverdue) {
            statusClass = 'overdue';
            statusText = `${Math.abs(daysLeft)} days overdue`;
        } else if (isDueSoon) {
            statusClass = 'due-soon';
            statusText = daysLeft === 0 ? 'Due today!' : `Due in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
        } else {
            statusClass = 'on-time';
            statusText = `${daysLeft} days remaining`;
        }

        html += `
            <div class="due-date-card ${statusClass}">
                <div class="book-cover">
                    <img src="${book.cover || 'https://via.placeholder.com/80x120'}" alt="${book.title}">
                </div>
                <div class="book-details">
                    <h3>${book.title || 'Unknown Book'}</h3>
                    <p class="author">${book.author || 'Unknown Author'}</p>
                    <div class="due-info">
                        <span class="due-date"><i class="fas fa-calendar"></i> Due: ${item.dueDate}</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <p class="renewals"><i class="fas fa-sync"></i> ${item.renewalsLeft} renewals remaining</p>
                </div>
                <div class="card-actions">
                    <button class="btn btn-return" onclick="returnBook(${item.bookId})">
                        <i class="fas fa-undo"></i> Return
                    </button>
                    <button class="btn btn-renew ${item.renewalsLeft <= 0 ? 'disabled' : ''}" 
                            onclick="renewBook(${item.bookId})" ${item.renewalsLeft <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-sync-alt"></i> Renew
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function updateSummary() {
    const total = borrowedBooks.length;
    let dueSoon = 0;
    let overdue = 0;

    borrowedBooks.forEach(item => {
        const daysLeft = getDaysRemaining(item.dueDate);
        if (daysLeft < 0) {
            overdue++;
        } else if (daysLeft <= 3) {
            dueSoon++;
        }
    });

    document.getElementById('totalBorrowed').textContent = total;
    document.getElementById('dueSoon').textContent = dueSoon;
    document.getElementById('overdue').textContent = overdue;
}

async function returnBook(bookId) {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/borrow?action=return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookId, userId: currentUser.id })
        });
        const result = await response.json();

        if (result.success) {
            alert('Book returned successfully!');
            await loadBorrowedBooks();
            renderDueDates();
            updateSummary();
        } else {
            alert(result.message);
        }
    } catch (e) {
        alert('Failed to return book');
    }
}

async function renewBook(bookId) {
    if (!currentUser) return;

    try {
        const response = await fetch(`${API_BASE}/borrow?action=renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookId, userId: currentUser.id })
        });
        const result = await response.json();

        if (result.success) {
            alert(`Renewed! New due date: ${result.data.newDueDate}`);
            await loadBorrowedBooks();
            renderDueDates();
        } else {
            alert(result.message);
        }
    } catch (e) {
        alert('Failed to renew book');
    }
}

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
});
