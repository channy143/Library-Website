// Wishlist Page
const API_BASE = 'api';
let currentUser = null;
let wishlist = [];

document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUser();
    if (!currentUser) { window.location.href = 'login.html'; return; }
    await loadWishlist();
    renderWishlist();
});

function loadCurrentUser() {
    try {
        const stored = sessionStorage.getItem('currentUser');
        currentUser = stored ? JSON.parse(stored) : null;
    } catch (e) { currentUser = null; }
}

async function loadWishlist() {
    if (!currentUser) return;
    try {
        const response = await fetch(`${API_BASE}/wishlist?action=list&userId=${currentUser.id}`);
        const result = await response.json();
        wishlist = result.success ? result.data : [];
    } catch (e) { wishlist = []; }
}

function renderWishlist() {
    const container = document.getElementById('wishlistGrid');
    const emptyState = document.getElementById('emptyState');

    if (wishlist.length === 0) { emptyState.style.display = 'block'; return; }
    emptyState.style.display = 'none';

    let html = '';
    wishlist.forEach(book => {
        html += `
            <div class="wishlist-card">
                <img src="${book.cover || 'https://via.placeholder.com/180x270'}" alt="${book.title}">
                <div class="wishlist-card-body">
                    <h3>${book.title}</h3>
                    <p class="author">${book.author}</p>
                    <button class="btn-remove" onclick="removeFromWishlist(${book.id})">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

async function removeFromWishlist(bookId) {
    try {
        const response = await fetch(`${API_BASE}/wishlist?action=remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookId, userId: currentUser.id })
        });
        const result = await response.json();
        if (result.success) {
            await loadWishlist();
            renderWishlist();
        }
    } catch (e) { console.error(e); }
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
});
