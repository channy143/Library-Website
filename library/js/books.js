// Books Page - Full Library System
// Integrates with PHP API for borrowing, reservations, wishlist

// Configuration
const API_BASE = '/library/api';

// State
let books = [];
let currentUser = null;
let userBorrowed = [];
let userReservations = [];
let userWishlist = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUser();
    await loadBooks();
    await loadUserData();
    renderBooks();
    setupSearch();
    setupModal();
});

// Load current user from session
function loadCurrentUser() {
    try {
        const stored = sessionStorage.getItem('currentUser');
        currentUser = stored ? JSON.parse(stored) : null;
    } catch (e) {
        currentUser = null;
    }
}

// API Helpers
async function apiGet(endpoint) {
    try {
        const response = await fetch(`${API_BASE}/${endpoint}`);
        return await response.json();
    } catch (e) {
        console.error('API Error:', e);
        return { success: false, message: 'Network error' };
    }
}

async function apiPost(endpoint, data) {
    try {
        const response = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (e) {
        console.error('API Error:', e);
        return { success: false, message: 'Network error' };
    }
}

// Load books from API
async function loadBooks() {
    const result = await apiGet('books.php');
    if (result.success) {
        books = result.data;
    } else {
        console.error('Failed to load books:', result.message);
        books = [];
    }
}

// Load user-specific data
async function loadUserData() {
    if (!currentUser) return;

    const userId = currentUser.id;

    // Load borrowed books
    const borrowedResult = await apiGet(`borrow.php?action=list&userId=${userId}`);
    userBorrowed = borrowedResult.success ? borrowedResult.data : [];

    // Load reservations
    const reservationsResult = await apiGet(`reserve.php?action=user&userId=${userId}`);
    userReservations = reservationsResult.success ? reservationsResult.data : [];

    // Load wishlist
    const wishlistResult = await apiGet(`wishlist.php?action=list&userId=${userId}`);
    userWishlist = wishlistResult.success ? wishlistResult.data : [];
}

// Check if user has borrowed a book
function getUserBorrowedEntry(bookId) {
    return userBorrowed.find(b => b.bookId === bookId);
}

// Check if user has reserved a book
function getUserReservation(bookId) {
    return userReservations.find(r => r.bookId === bookId);
}

// Check if book is in wishlist
function isInWishlist(bookId) {
    return userWishlist.some(b => b.id === bookId);
}

// Render Books Grid
function renderBooks(booksToRender = books) {
    const grid = document.getElementById('booksGrid');
    if (!grid) return;

    grid.innerHTML = '';

    booksToRender.forEach(book => {
        const borrowed = getUserBorrowedEntry(book.id);
        const reserved = getUserReservation(book.id);
        const inWishlist = isInWishlist(book.id);

        const card = document.createElement('div');
        card.className = 'book-card';
        card.dataset.bookId = book.id;

        // Status badge
        let statusBadge = '';
        if (borrowed) {
            statusBadge = '<span class="status-badge borrowed">Borrowed</span>';
        } else if (reserved) {
            statusBadge = '<span class="status-badge reserved">Reserved</span>';
        } else if (!book.available) {
            statusBadge = '<span class="status-badge unavailable">Unavailable</span>';
        }

        card.innerHTML = `
            <div class="book-actions">
                <button class="action-btn wishlist-btn ${inWishlist ? 'active' : ''}" 
                        onclick="toggleWishlist(${book.id}, event)" 
                        title="${inWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="${inWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                </button>
            </div>
            ${statusBadge}
            <img src="${book.cover}" alt="${book.title}" class="book-cover" onclick="openBookModal(${book.id})">
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
                <span class="book-genre">${book.category}</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Modal Setup
function setupModal() {
    const modal = document.getElementById('bookModal');
    if (!modal) return;

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBookModal();
        }
    });
}

// Open Book Modal with full details and actions
function openBookModal(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;

    const modal = document.getElementById('bookModal');
    const modalContent = modal.querySelector('.modal-content') || modal;

    const borrowed = getUserBorrowedEntry(bookId);
    const reserved = getUserReservation(bookId);
    const inWishlist = isInWishlist(bookId);

    // Build action buttons based on state
    let actionsHtml = '';

    if (!currentUser) {
        actionsHtml = '<p class="login-prompt">Please <a href="login.html">login</a> to borrow or reserve books.</p>';
    } else if (borrowed) {
        // User has this book borrowed
        const dueDate = new Date(borrowed.dueDate);
        const today = new Date();
        const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
        const isOverdue = daysLeft < 0;

        actionsHtml = `
            <div class="borrowed-info ${isOverdue ? 'overdue' : ''}">
                <p><strong>Due Date:</strong> ${borrowed.dueDate}</p>
                <p><strong>${isOverdue ? 'Overdue by' : 'Days remaining'}:</strong> ${Math.abs(daysLeft)} days</p>
                <p><strong>Renewals left:</strong> ${borrowed.renewalsLeft}</p>
            </div>
            <div class="action-buttons">
                <button class="btn btn-return" onclick="returnBook(${bookId})">
                    <i class="fas fa-undo"></i> Return Book
                </button>
                <button class="btn btn-renew ${borrowed.renewalsLeft <= 0 ? 'disabled' : ''}" 
                        onclick="renewBook(${bookId})" ${borrowed.renewalsLeft <= 0 ? 'disabled' : ''}>
                    <i class="fas fa-sync"></i> Renew (+7 days)
                </button>
            </div>
        `;
    } else if (reserved) {
        // User has reserved this book
        actionsHtml = `
            <div class="reserved-info">
                <p><strong>Queue Position:</strong> #${reserved.queuePosition}</p>
                <p><strong>Status:</strong> ${reserved.status}</p>
                <p><strong>Pickup Date:</strong> ${reserved.pickupDate}</p>
            </div>
            <div class="action-buttons">
                <button class="btn btn-cancel" onclick="cancelReservation('${reserved.id}')">
                    <i class="fas fa-times"></i> Cancel Reservation
                </button>
            </div>
        `;
    } else if (book.available) {
        // Book is available to borrow
        actionsHtml = `
            <div class="action-buttons">
                <button class="btn btn-borrow" onclick="borrowBook(${bookId})">
                    <i class="fas fa-book-reader"></i> Borrow Book
                </button>
                <button class="btn btn-wishlist ${inWishlist ? 'active' : ''}" onclick="toggleWishlist(${bookId})">
                    <i class="fas fa-heart"></i> ${inWishlist ? 'In Wishlist' : 'Add to Wishlist'}
                </button>
            </div>
        `;
    } else {
        // Book is not available - offer reservation
        actionsHtml = `
            <div class="reserve-form">
                <p>This book is currently unavailable.</p>
                <label for="pickupDate">Preferred Pickup Date:</label>
                <input type="date" id="pickupDate" min="${getMinDate()}" value="${getDefaultPickupDate()}">
            </div>
            <div class="action-buttons">
                <button class="btn btn-reserve" onclick="reserveBook(${bookId})">
                    <i class="fas fa-bookmark"></i> Reserve Book
                </button>
                <button class="btn btn-wishlist ${inWishlist ? 'active' : ''}" onclick="toggleWishlist(${bookId})">
                    <i class="fas fa-heart"></i> ${inWishlist ? 'In Wishlist' : 'Add to Wishlist'}
                </button>
            </div>
        `;
    }

    // PDF button
    let pdfButton = '';
    if (book.pdf) {
        pdfButton = `
            <button class="btn btn-pdf" onclick="downloadPdf('${book.pdf}')">
                <i class="fas fa-file-pdf"></i> Download PDF
            </button>
        `;
    } else {
        pdfButton = `
            <button class="btn btn-pdf disabled" disabled>
                <i class="fas fa-file-pdf"></i> No Digital Copy Available
            </button>
        `;
    }

    modalContent.innerHTML = `
        <button class="modal-close" onclick="closeBookModal()">&times;</button>
        <div class="modal-book-content">
            <div class="modal-book-cover">
                <img src="${book.cover}" alt="${book.title}">
            </div>
            <div class="modal-book-details">
                <h2>${book.title}</h2>
                <p class="modal-author">by ${book.author}</p>
                <span class="modal-category">${book.category}</span>
                <p class="modal-description">${book.description || 'No description available.'}</p>
                
                <div class="modal-status">
                    <span class="availability ${book.available ? 'available' : 'unavailable'}">
                        ${book.available ? 'Available' : 'Currently Borrowed'}
                    </span>
                </div>
                
                ${actionsHtml}
                
                <div class="pdf-section">
                    ${pdfButton}
                </div>
                
                <div id="actionFeedback" class="action-feedback"></div>
            </div>
        </div>
    `;

    modal.classList.add('active');
}

function closeBookModal() {
    const modal = document.getElementById('bookModal');
    modal.classList.remove('active');
}

// Helper functions for dates
function getMinDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
}

function getDefaultPickupDate() {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
}

// Show feedback in modal
function showFeedback(message, isSuccess = true) {
    const feedback = document.getElementById('actionFeedback');
    if (feedback) {
        feedback.className = `action-feedback ${isSuccess ? 'success' : 'error'}`;
        feedback.textContent = message;
        feedback.style.display = 'block';

        setTimeout(() => {
            feedback.style.display = 'none';
        }, 4000);
    }
}

// ===== BOOK ACTIONS =====

// Borrow Book
async function borrowBook(bookId) {
    if (!currentUser) {
        showFeedback('Please login first', false);
        return;
    }

    const result = await apiPost('borrow.php?action=borrow', {
        bookId: bookId,
        userId: currentUser.id
    });

    if (result.success) {
        showFeedback(`Book borrowed! Due: ${result.data.dueDate}`);
        await loadBooks();
        await loadUserData();
        renderBooks();
        setTimeout(() => openBookModal(bookId), 500);
    } else {
        showFeedback(result.message, false);
    }
}

// Return Book
async function returnBook(bookId) {
    if (!currentUser) return;

    const result = await apiPost('borrow.php?action=return', {
        bookId: bookId,
        userId: currentUser.id
    });

    if (result.success) {
        showFeedback('Book returned successfully!');
        await loadBooks();
        await loadUserData();
        renderBooks();
        setTimeout(() => openBookModal(bookId), 500);
    } else {
        showFeedback(result.message, false);
    }
}

// Renew Book
async function renewBook(bookId) {
    if (!currentUser) return;

    const result = await apiPost('borrow.php?action=renew', {
        bookId: bookId,
        userId: currentUser.id
    });

    if (result.success) {
        showFeedback(`Renewed! New due date: ${result.data.newDueDate}`);
        await loadUserData();
        setTimeout(() => openBookModal(bookId), 500);
    } else {
        showFeedback(result.message, false);
    }
}

// Reserve Book
async function reserveBook(bookId) {
    if (!currentUser) {
        showFeedback('Please login first', false);
        return;
    }

    const pickupDateEl = document.getElementById('pickupDate');
    const pickupDate = pickupDateEl ? pickupDateEl.value : null;

    const result = await apiPost('reserve.php?action=reserve', {
        bookId: bookId,
        userId: currentUser.id,
        pickupDate: pickupDate
    });

    if (result.success) {
        showFeedback(`Reserved! Queue position: #${result.data.queuePosition}`);
        await loadUserData();
        setTimeout(() => openBookModal(bookId), 500);
    } else {
        showFeedback(result.message, false);
    }
}

// Cancel Reservation
async function cancelReservation(reservationId) {
    if (!currentUser) return;

    const result = await apiPost('reserve.php?action=cancel', {
        reservationId: reservationId,
        userId: currentUser.id
    });

    if (result.success) {
        showFeedback('Reservation cancelled');
        await loadUserData();
        renderBooks();
        closeBookModal();
    } else {
        showFeedback(result.message, false);
    }
}

// Toggle Wishlist
async function toggleWishlist(bookId, event) {
    if (event) event.stopPropagation();

    if (!currentUser) {
        alert('Please login to use wishlist');
        return;
    }

    const inWishlist = isInWishlist(bookId);
    const action = inWishlist ? 'remove' : 'add';

    const result = await apiPost(`wishlist.php?action=${action}`, {
        bookId: bookId,
        userId: currentUser.id
    });

    if (result.success) {
        await loadUserData();
        renderBooks();

        // Update modal if open
        const modal = document.getElementById('bookModal');
        if (modal.classList.contains('active')) {
            openBookModal(bookId);
        }
    }
}

// Download PDF
function downloadPdf(filename) {
    window.open(`/library/pdf/${filename}`, '_blank');
}

// Search Functionality
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = books.filter(book =>
            book.title.toLowerCase().includes(term) ||
            book.author.toLowerCase().includes(term) ||
            book.category.toLowerCase().includes(term)
        );
        renderBooks(filtered);
    });
}

// Admin Functions (if needed)
function openAddBookModal() {
    const modal = document.getElementById('addBookModal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('bookForm')?.reset();
    }
}

function closeAddBookModal() {
    const modal = document.getElementById('addBookModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function handleBookSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const result = await apiPost('books.php?action=add', {
        title: formData.get('title'),
        author: formData.get('author'),
        category: formData.get('genre') || formData.get('category'),
        cover: formData.get('coverUrl') || formData.get('cover'),
        pdf: formData.get('pdf') || null,
        description: formData.get('description')
    });

    if (result.success) {
        await loadBooks();
        renderBooks();
        closeAddBookModal();
    } else {
        alert(result.message);
    }
}

async function deleteBook(id) {
    if (!confirm('Are you sure you want to delete this book?')) return;

    const response = await fetch(`${API_BASE}/books.php?id=${id}`, {
        method: 'DELETE'
    });
    const result = await response.json();

    if (result.success) {
        await loadBooks();
        renderBooks();
    } else {
        alert(result.message);
    }
}

function editBook(id) {
    alert('Edit functionality - open modal with book data');
}
