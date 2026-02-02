// For You Page - Personalized Recommendations
const API_BASE = '/library/api';
let currentUser = null;
let allBooks = [];
let history = [];
let wishlist = [];
let favorites = [];
let stats = null;

document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentUser();
    if (!currentUser) { window.location.href = 'login.html'; return; }
    await loadData();
    generateRecommendations();
});

function loadCurrentUser() {
    try {
        const stored = sessionStorage.getItem('currentUser');
        currentUser = stored ? JSON.parse(stored) : null;
    } catch (e) { currentUser = null; }
}

async function loadData() {
    if (!currentUser) return;

    try {
        // Load all books
        const booksRes = await fetch(`${API_BASE}/books.php`);
        const booksResult = await booksRes.json();
        allBooks = booksResult.success ? booksResult.data : [];

        // Load history for stats
        const statsRes = await fetch(`${API_BASE}/history.php?action=stats&userId=${currentUser.id}`);
        const statsResult = await statsRes.json();
        stats = statsResult.success ? statsResult.data : null;

        // Load wishlist (legacy wishlist table)
        const wishRes = await fetch(`${API_BASE}/wishlist.php?action=list&userId=${currentUser.id}`);
        const wishResult = await wishRes.json();
        wishlist = wishResult.success ? wishResult.data : [];

        // Load favorites (favorite_books table)
        const favRes = await fetch(`${API_BASE}/favorites.php?action=list&userId=${currentUser.id}`);
        const favResult = await favRes.json();
        favorites = favResult.success ? favResult.data : [];

        // Load history
        const histRes = await fetch(`${API_BASE}/history.php?userId=${currentUser.id}`);
        const histResult = await histRes.json();
        history = histResult.success ? histResult.data : [];
    } catch (e) {
        console.error(e);
    }
}

function generateRecommendations() {
    const historyBookIds = new Set(history.map(h => h.bookId));
    const wishlistBookIds = new Set(wishlist.map(b => b.id));
    const favoriteBookIds = new Set(favorites.map(b => b.id));

    const preferredBookIds = new Set();
    wishlistBookIds.forEach(id => preferredBookIds.add(id));
    favoriteBookIds.forEach(id => preferredBookIds.add(id));

    // Get favorite category from stats
    const favCategory = stats?.mostReadCategory || null;

    // Based on History - recommend same category as most read, excluding already-read and liked
    const historyRecs = [];
    if (favCategory) {
        allBooks.forEach(book => {
            if (book.category === favCategory && !historyBookIds.has(book.id) && !preferredBookIds.has(book.id)) {
                historyRecs.push({ ...book, reason: `You liked ${favCategory}` });
            }
        });
    }
    renderBooks('historyRecs', historyRecs.slice(0, 6), historyRecs.length === 0 ? 'Read more books to get recommendations!' : null);

    // Based on Wishlist/Favorites - same categories as liked items
    const wishlistCategories = new Set();
    wishlist.forEach(b => { if (b.category) wishlistCategories.add(b.category); });
    favorites.forEach(b => { if (b.category) wishlistCategories.add(b.category); });
    const wishlistRecs = [];
    allBooks.forEach(book => {
        if (wishlistCategories.has(book.category) && !preferredBookIds.has(book.id) && !historyBookIds.has(book.id)) {
            wishlistRecs.push({ ...book, reason: `Similar to your wishlist & favorites` });
        }
    });
    const noLikes = wishlist.length === 0 && favorites.length === 0;
    renderBooks('wishlistRecs', wishlistRecs.slice(0, 6), noLikes ? 'Add books to your wishlist or favorites!' : null);

    // Trending - just show available books
    const trending = allBooks.filter(b => b.available).slice(0, 6).map(b => ({ ...b, reason: 'Popular' }));
    renderBooks('trendingRecs', trending);
}

function renderBooks(containerId, books, emptyMessage = 'No recommendations available') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (books.length === 0) {
        container.innerHTML = `<p style="color: var(--text-gray); padding: 20px;">${emptyMessage}</p>`;
        return;
    }

    let html = '';
    books.forEach(book => {
        html += `
            <div class="rec-card" onclick="window.location.href='books.html'">
                <img src="${book.cover || 'https://via.placeholder.com/160x240'}" alt="${book.title}">
                <div class="rec-card-body">
                    <h4>${book.title}</h4>
                    <p>${book.author}</p>
                    ${book.reason ? `<span class="reason-badge">${book.reason}</span>` : ''}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    sessionStorage.removeItem('currentUser');
    window.location.href = 'login.html';
});
