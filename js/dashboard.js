document.addEventListener('DOMContentLoaded', async () => {
    const API_BASE = 'api';

    // --- NAVIGATION LOGIC ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.dashboard-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Handle Logout
            if (item.getAttribute('href') === 'index.html') {
                window.location.href = 'index.html';
                return;
            }

            const targetId = item.getAttribute('data-target');
            if (!targetId) return;

            // Update Active State
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show Target Section
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetId) {
                    section.classList.add('active');

                    // Trigger animation
                    const content = section.querySelectorAll('.animate-on-show');
                    content.forEach((el, index) => {
                        el.style.animation = 'none';
                        el.offsetHeight; /* trigger reflow */
                        el.style.animation = `slideUp 0.5s ease forwards ${index * 0.1}s`;
                    });

                    // Animate Stats if target is stats-section
                    if (targetId === 'stats-section') {
                        animateStats();
                    }
                }
            });
        });
    });

    // Clicking the top-right profile block should open the Profile section
    const profileTrigger = document.getElementById('profile-trigger');
    if (profileTrigger) {
        profileTrigger.addEventListener('click', () => {
            const profileNav = document.querySelector('.nav-item[data-target="profile-section"]');
            if (profileNav) {
                profileNav.click();
            } else {
                // Fallback: manually activate the profile section
                sections.forEach(section => {
                    section.classList.toggle('active', section.id === 'profile-section');
                });
            }
        });
    }

    // --- SEARCH FUNCTIONALITY ---
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const books = document.querySelectorAll('#catalog-section .content-card');

            books.forEach(book => {
                const title = book.querySelector('.card-title').innerText.toLowerCase();
                const author = book.querySelector('.card-meta span:first-child').innerText.toLowerCase();

                if (title.includes(term) || author.includes(term)) {
                    book.style.display = 'block';
                } else {
                    book.style.display = 'none';
                }
            });
        });
    }

    // --- PROFILE FORM LOGIC ---
    const saveProfileBtn = document.querySelector('#profile-section .btn-primary');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (typeof saveUserProfile === 'function') {
                await saveUserProfile(saveProfileBtn);
            }
        });
    }

    // --- BOOK DETAILS MODAL LOGIC ---
    const modal = document.getElementById('book-modal');
    const modalClose = document.getElementById('modal-close');
    const modalFavoriteBtn = document.getElementById('modal-favorite-btn');
    const modalBorrowerBtn = document.getElementById('modal-borrower-btn');

    // Modal Elements to Populate
    const modalCover = document.getElementById('modal-cover');
    const modalTag = document.getElementById('modal-tag');
    const modalTitle = document.getElementById('modal-title');
    const modalAuthor = document.getElementById('modal-author');
    const modalDesc = document.getElementById('modal-desc');
    const modalRatingStars = document.getElementById('modal-rating-stars');
    const modalRatingAverage = document.getElementById('modal-rating-average');
    const modalRatingCount = document.getElementById('modal-rating-count');
    const modalUserRatingStars = document.getElementById('modal-user-rating-stars');
    const modalUserRatingLabel = document.getElementById('modal-user-rating-label');

    // Advanced Elements
    const reservationDetails = document.getElementById('reservation-details');
    const reservationList = document.getElementById('reservation-list');
    const actionFeedback = document.getElementById('action-feedback');
    const btnReserve = document.querySelector('.btn-reserve');
    const btnDownload = document.querySelector('.btn-download');
    const reservationConfirmActions = document.getElementById('reservation-confirm-actions');
    const btnConfirmReservation = document.getElementById('btn-confirm-reservation');
    const btnCancelReservation = document.getElementById('btn-cancel-reservation');

    // Reservation-specific elements
    const reservationSummary = document.getElementById('reservation-summary');
    const reservationStatusChip = document.getElementById('reservation-status-chip');
    const reservationQueueLabel = document.getElementById('reservation-queue-label');
    const reservationWait = document.getElementById('reservation-wait');
    const reservationPrimaryAction = document.getElementById('reservation-primary-action');

    // Track which reservation (if any) is currently shown in the modal
    let currentReservationId = null;

    // Track the current book and matching admin metadata
    let currentBookTitle = null;
    let currentAdminBook = null;
    let currentBookId = null;

    // Rating state for the modal
    let currentRatingSummary = null;
    let currentUserRating = null;
    let ratingStarsInitialized = false;
    let isSubmittingRating = false;

    // Load books from API database
    async function loadAdminBooks() {
        try {
            const response = await fetch(`${API_BASE}/books`);
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                return result.data.map(book => ({
                    id: book.id,
                    title: book.title,
                    author: book.author,
                    category: book.category || 'General',
                    status: book.available ? 'available' : 'checked_out',
                    imageUrl: book.cover || '',
                    pdfUrl: book.pdf || '',
                    description: book.description || '',
                    copies: typeof book.copies === 'number'
                        ? book.copies
                        : parseInt(book.copies || '1', 10),
                    // Optional rating aggregates (used in admin and catalog cards)
                    averageRating: typeof book.avg_rating === 'number'
                        ? book.avg_rating
                        : parseFloat(book.avg_rating || '0') || 0,
                    ratingCount: typeof book.rating_count === 'number'
                        ? book.rating_count
                        : parseInt(book.rating_count || '0', 10) || 0
                }));
            }
            return [];
        } catch (e) {
            console.error('Failed to load books:', e);
            return [];
        }
    }

    // --- RATING HELPERS ---
    function renderAverageRatingStars(avg) {
        if (!modalRatingStars) return;
        modalRatingStars.innerHTML = '';
        const value = typeof avg === 'number' ? avg : 0;
        const rounded = Math.round(value || 0);
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.className = i <= rounded ? 'fas fa-star' : 'far fa-star';
            modalRatingStars.appendChild(star);
        }
    }

    function renderUserRatingStarsVisual(value) {
        if (!modalUserRatingStars) return;
        const stars = modalUserRatingStars.querySelectorAll('i');
        stars.forEach(star => {
            const val = parseInt(star.dataset.value || '0', 10);
            star.className = val > 0 && val <= value ? 'fas fa-star' : 'far fa-star';
        });
    }

    function ensureUserRatingStarsInitialized() {
        if (!modalUserRatingStars || ratingStarsInitialized) return;
        ratingStarsInitialized = true;
        modalUserRatingStars.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.className = 'far fa-star';
            star.dataset.value = String(i);
            modalUserRatingStars.appendChild(star);
        }

        modalUserRatingStars.addEventListener('mouseover', (e) => {
            if (modalUserRatingStars.classList.contains('disabled')) return;
            const star = e.target.closest('i');
            if (!star) return;
            const value = parseInt(star.dataset.value || '0', 10) || 0;
            renderUserRatingStarsVisual(value);
        });

        modalUserRatingStars.addEventListener('mouseleave', () => {
            if (modalUserRatingStars.classList.contains('disabled')) return;
            renderUserRatingStarsVisual(currentUserRating || 0);
        });

        modalUserRatingStars.addEventListener('click', async (e) => {
            if (modalUserRatingStars.classList.contains('disabled')) return;
            const star = e.target.closest('i');
            if (!star) return;
            const value = parseInt(star.dataset.value || '0', 10) || 0;
            if (!value) return;
            await submitUserRating(value);
        });
    }

    async function loadBookRatingSummary(bookId) {
        if (!modalRatingStars || !modalRatingAverage || !modalRatingCount) return;

        ensureUserRatingStarsInitialized();
        currentRatingSummary = null;
        currentUserRating = null;

        if (!bookId) {
            renderAverageRatingStars(0);
            modalRatingAverage.innerText = '—';
            modalRatingCount.innerText = '(no reviews yet)';
            if (modalUserRatingStars) {
                modalUserRatingStars.classList.add('disabled');
                renderUserRatingStarsVisual(0);
            }
            if (modalUserRatingLabel) {
                modalUserRatingLabel.innerText = 'Your rating:';
            }
            return;
        }

        try {
            const userParam = currentUser && currentUser.id ? `&userId=${currentUser.id}` : '';
            const response = await fetch(`${API_BASE}/ratings?action=book&bookId=${bookId}${userParam}`);
            const result = await response.json();

            if (!result.success || !result.data) {
                renderAverageRatingStars(0);
                modalRatingAverage.innerText = '—';
                modalRatingCount.innerText = '(no reviews yet)';
                return;
            }

            const summary = result.data;
            currentRatingSummary = summary;
            const avg = typeof summary.averageRating === 'number' ? summary.averageRating : 0;
            const count = typeof summary.ratingCount === 'number' ? summary.ratingCount : 0;
            const userRating = typeof summary.userRating === 'number' ? summary.userRating : null;
            currentUserRating = userRating;

            renderAverageRatingStars(avg);
            modalRatingAverage.innerText = avg ? avg.toFixed(1) : '—';
            modalRatingCount.innerText = count === 1 ? '(1 review)' : `(${count} reviews)`;

            if (currentUser && currentUser.id) {
                if (modalUserRatingStars) {
                    modalUserRatingStars.classList.remove('disabled');
                    renderUserRatingStarsVisual(userRating || 0);
                }
                if (modalUserRatingLabel) {
                    modalUserRatingLabel.innerText = userRating ? 'Your rating:' : 'Tap to rate:';
                }
            } else {
                if (modalUserRatingStars) {
                    modalUserRatingStars.classList.add('disabled');
                    renderUserRatingStarsVisual(0);
                }
                if (modalUserRatingLabel) {
                    modalUserRatingLabel.innerText = 'Sign in to rate';
                }
            }
        } catch (e) {
            console.error('Failed to load book rating', e);
        }
    }

    async function submitUserRating(value) {
        if (!currentUser || !currentUser.id) {
            showActionFeedback('Please log in to rate books', 'error');
            return;
        }
        if (!currentBookId || isSubmittingRating) return;

        isSubmittingRating = true;
        try {
            const response = await fetch(`${API_BASE}/ratings?action=rate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    bookId: currentBookId,
                    rating: value
                })
            });
            const result = await response.json();

            if (result.success && result.data) {
                const summary = result.data;
                currentRatingSummary = summary;
                const avg = typeof summary.averageRating === 'number' ? summary.averageRating : value;
                const count = typeof summary.ratingCount === 'number' ? summary.ratingCount : 1;
                currentUserRating = typeof summary.userRating === 'number' ? summary.userRating : value;

                renderAverageRatingStars(avg);
                modalRatingAverage.innerText = avg ? avg.toFixed(1) : '—';
                modalRatingCount.innerText = count === 1 ? '(1 review)' : `(${count} reviews)`;
                renderUserRatingStarsVisual(currentUserRating || 0);
                if (modalUserRatingLabel) {
                    modalUserRatingLabel.innerText = 'Your rating:';
                }
                showActionFeedback('Rating saved', 'success');
            } else {
                showActionFeedback(result.message || 'Failed to save rating', 'error');
            }
        } catch (e) {
            console.error('Rating error:', e);
            showActionFeedback('Failed to save rating', 'error');
        } finally {
            isSubmittingRating = false;
        }
    }

    // Update the dedicated Stats section using full user stats
    function updateStatsSection() {
        const statsSection = document.getElementById('stats-section');
        if (!statsSection) return;

        const metricCards = statsSection.querySelectorAll('.metric-card');
        const donutTotalEl = statsSection.querySelector('.donut-chart .center-text strong');
        const ringTextEl = statsSection.querySelector('.ring-text');
        const goalTargetEl = statsSection.querySelector('.goal-target');

        let totalBooks = 0;
        let overdueCount = 0;
        let avgReadingDays = 0;
        let currentBorrowed = 0;
        let activeReservations = 0;
        let monthlyReading = [];

        if (userFullStats) {
            totalBooks = userFullStats.totalBooks || 0;
            overdueCount = userFullStats.overdueCount || 0;
            avgReadingDays = userFullStats.avgReadingDays || 0;
            currentBorrowed = userFullStats.currentBorrowed || 0;
            activeReservations = userFullStats.activeReservations || 0;
            monthlyReading = Array.isArray(userFullStats.monthlyReading) ? userFullStats.monthlyReading : [];
        }

        // Top metric cards: Books Read, Pages Read, Current Streak, Reading Time
        if (metricCards.length >= 1) {
            const valueEl = metricCards[0].querySelector('.metric-info h3');
            if (valueEl) valueEl.innerText = totalBooks;
        }

        if (metricCards.length >= 2) {
            const valueEl = metricCards[1].querySelector('.metric-info h3');
            const pagesRead = totalBooks * 300; // Approximate pages based on books
            if (valueEl) valueEl.innerText = pagesRead;
        }

        if (metricCards.length >= 3) {
            const valueEl = metricCards[2].querySelector('.metric-info h3');
            // Simple streak approximation: number of recent months with reading * 2 days
            const streakDays = monthlyReading.length * 2;
            if (valueEl) valueEl.innerText = `${streakDays} Days`;
        }

        if (metricCards.length >= 4) {
            const valueEl = metricCards[3].querySelector('.metric-info h3');
            const readingHours = Math.round(totalBooks * avgReadingDays);
            if (valueEl) valueEl.innerText = `${readingHours}h`;
        }

        // Donut center total
        if (donutTotalEl) {
            donutTotalEl.innerText = totalBooks;
        }

        // Monthly goal (progress ring and label) – assume goal of 5 books/month
        let booksThisMonth = 0;
        if (monthlyReading.length > 0) {
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            const currentEntry = monthlyReading.find(m => m.month === currentMonth) || monthlyReading[0];
            if (currentEntry && typeof currentEntry.count === 'number') {
                booksThisMonth = currentEntry.count;
            }
        }

        const monthlyGoal = 5;
        statsGoalPercent = monthlyGoal > 0 ? Math.min(100, (booksThisMonth / monthlyGoal) * 100) : 0;

        if (ringTextEl) {
            ringTextEl.innerText = `${Math.round(statsGoalPercent)}%`;
        }

        if (goalTargetEl) {
            const clamped = Math.min(booksThisMonth, monthlyGoal);
            goalTargetEl.innerText = `${clamped} / ${monthlyGoal} Books`;
        }
    }

    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
            return parsed || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function saveJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
        }
    }

    function loadCategories() {
        return loadJSON('admin_categories', []);
    }

    function generateReservationId() {
        return 'user_res_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    }

    function generateDueId() {
        return 'due_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
    }

    // ===== LIBRARY CONFIGURATION =====
    const LIBRARY_CONFIG = {
        maxBorrowedBooks: 5,
        maxReservations: 3,
        loanPeriodDays: 14,
        renewalExtensionDays: 7,
        maxRenewals: 2,
        gracePeriodDays: 3,
        lateFeePerDay: 0.50,
        reservationHoldDays: 3,
        minReservationAdvanceDays: 1,
        maxReservationAdvanceDays: 30
    };

    // ===== LIBRARY VALIDATION FUNCTIONS =====
    function canUserBorrow() {
        const currentBorrowed = userData && userData.due ? userData.due.length : 0;
        return currentBorrowed < LIBRARY_CONFIG.maxBorrowedBooks;
    }

    function canUserReserve() {
        const currentReservations = reservations ? reservations.length : 0;
        return currentReservations < LIBRARY_CONFIG.maxReservations;
    }

    function userHasBook(bookId) {
        if (!userData || !userData.due) return false;
        return userData.due.some(d => d.bookId === bookId);
    }

    function userHasReservation(bookId) {
        if (!reservations) return false;
        return reservations.some(r => r.bookId === bookId);
    }

    function getUserDueEntry(bookId) {
        if (!userData || !userData.due) return null;
        return userData.due.find(d => d.bookId === bookId);
    }

    function calculateLateFee(dueDate) {
        const today = new Date();
        const due = new Date(dueDate);
        const daysLate = Math.floor((today - due) / (1000 * 60 * 60 * 24));
        if (daysLate <= LIBRARY_CONFIG.gracePeriodDays) return 0;
        return (daysLate - LIBRARY_CONFIG.gracePeriodDays) * LIBRARY_CONFIG.lateFeePerDay;
    }

    function formatDate(date) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(date).toLocaleDateString('en-US', options);
    }

    // ===== CORE LIBRARY FUNCTIONS =====

    // Borrow a book - uses API
    async function borrowBook(adminBook) {
        if (!adminBook) {
            showActionFeedback('No book selected', 'error');
            return false;
        }

        if (!currentUser || !currentUser.id) {
            showActionFeedback('Please log in to borrow books', 'error');
            return false;
        }

        try {
            const response = await fetch(`${API_BASE}/borrow?action=borrow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: adminBook.id,
                    userId: currentUser.id
                })
            });
            const result = await response.json();

            if (result.success) {
                // Refresh books and user borrowed data from API
                adminBooks = await loadAdminBooks();
                await loadUserBorrowedBooks();

                // Re-render catalog and home sections that depend on borrowed data
                renderCatalogFromAdmin();
                renderHomeContinueFromAdmin();
                renderDueDatesFromUserData();
                updateHomeStats();

                // Update hero metrics and recommendations
                updateSectionHeroStats();
                renderForYouFromData();

                // Update the modal state so the "books borrowed" count reflects the new total
                updateModalButtonStates(adminBook);

                showActionFeedback(`Borrowed successfully! Due on ${formatDate(result.data?.dueDate)}`, 'success');
                return true;
            } else {
                showActionFeedback(result.message || 'Failed to borrow book', 'error');
                return false;
            }
        } catch (e) {
            console.error('Borrow error:', e);
            showActionFeedback('Failed to borrow book', 'error');
            return false;
        }
    }

    async function pickupReservationById(id) {
        if (!id) return false;

        if (!currentUser || !currentUser.id) {
            showActionFeedback('Please log in to pick up reservations', 'error');
            return false;
        }

        try {
            const response = await fetch(`${API_BASE}/borrow?action=pickup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationId: id,
                    userId: currentUser.id
                })
            });
            const result = await response.json();

            if (result.success) {
                await loadUserBorrowedBooks();
                renderDueDatesFromUserData();
                await loadUserReservations();
                renderReservations();

                updateSectionHeroStats();
                renderForYouFromData();

                const due = result.data?.newDueDate || result.data?.dueDate || null;
                const msg = due ? `Book picked up! Due on ${formatDate(due)}` : 'Book picked up from reservation!';
                showActionFeedback(msg, 'success');
                return true;
            } else {
                showActionFeedback(result.message || 'Failed to pick up reservation', 'error');
                return false;
            }
        } catch (e) {
            console.error('Pickup reservation error:', e);
            showActionFeedback('Failed to pick up reservation', 'error');
            return false;
        }
    }



    // Return a book - uses API
    async function returnBook(bookId) {
        if (!currentUser || !currentUser.id) {
            showActionFeedback('Please log in to return books', 'error');
            return false;
        }

        try {
            const response = await fetch(`${API_BASE}/borrow?action=return`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: bookId,
                    userId: currentUser.id
                })
            });
            const result = await response.json();

            if (result.success) {
                // Refresh data and UI
                adminBooks = await loadAdminBooks();
                await loadUserBorrowedBooks();

                // Track as recently read
                await trackRecentlyRead(bookId);
                await loadRecentlyRead();

                // Reload history so the History section reflects this return
                await loadUserHistory();

                renderCatalogFromAdmin();
                renderDueDatesFromUserData();
                renderHomeContinueFromAdmin();
                renderHistoryFromUserData();
                renderRecentSection();
                renderProfileBorrowed();

                updateSectionHeroStats();
                renderForYouFromData();

                let message = 'Book returned successfully!';
                if (result.data && result.data.overdue) {
                    message += ' (Overdue)';
                }
                showActionFeedback(message, 'success');
                return true;
            } else {
                showActionFeedback(result.message || 'Failed to return book', 'error');
                return false;
            }
        } catch (e) {
            console.error('Return error:', e);
            showActionFeedback('Failed to return book', 'error');
            return false;
        }
    }


    // Renew a book - uses API
    async function renewBook(bookId) {
        if (!currentUser || !currentUser.id) {
            showActionFeedback('Please log in to renew books', 'error');
            return false;
        }

        try {
            const response = await fetch(`${API_BASE}/borrow?action=renew`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: bookId,
                    userId: currentUser.id
                })
            });
            const result = await response.json();

            if (result.success) {
                // Refresh data and UI
                await loadUserBorrowedBooks();
                renderDueDatesFromUserData();

                updateSectionHeroStats();
                renderForYouFromData();

                const newDate = result.data?.newDueDate ? formatDate(result.data.newDueDate) : 'extended';
                const left = result.data?.renewalsLeft ?? 0;
                showActionFeedback(`Renewed! New due date: ${newDate}. ${left} renewal(s) left.`, 'success');
                return true;
            } else {
                showActionFeedback(result.message || 'Failed to renew book', 'error');
                return false;
            }
        } catch (e) {
            console.error('Renew error:', e);
            showActionFeedback('Failed to renew book', 'error');
            return false;
        }
    }


    // Reserve a book - uses API
    async function reserveBookWithDate(adminBook, preferredDate) {
        if (!adminBook) {
            showActionFeedback('No book selected', 'error');
            return null;
        }

        if (!currentUser || !currentUser.id) {
            showActionFeedback('Please log in to reserve books', 'error');
            return null;
        }

        try {
            const response = await fetch(`${API_BASE}/reserve?action=reserve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: adminBook.id,
                    userId: currentUser.id,
                    pickupDate: preferredDate || null
                })
            });
            const result = await response.json();

            if (result.success) {
                // Refresh reservations
                await loadUserReservations();
                renderReservations();

                updateSectionHeroStats();

                const queuePos = result.data?.queuePosition || 1;
                showActionFeedback(`Reserved "${adminBook.title}"! Queue position: ${queuePos}`, 'success');
                return { bookTitle: adminBook.title, queue: queuePos, preferredDate: preferredDate };
            } else {
                showActionFeedback(result.message || 'Failed to reserve book', 'error');
                return null;
            }
        } catch (e) {
            console.error('Reserve error:', e);
            showActionFeedback('Failed to reserve book', 'error');
            return null;
        }
    }

    // Load user's current borrowed books from API
    async function loadUserBorrowedBooks() {
        if (!currentUser || !currentUser.id) return;

        try {
            const response = await fetch(`${API_BASE}/borrow?action=list&userId=${currentUser.id}`);
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                // Convert to userData.due format for compatibility
                userData.due = result.data.map(item => ({
                    id: item.id,
                    bookId: item.bookId,
                    bookTitle: item.book?.title || 'Unknown',
                    author: item.book?.author || 'Unknown',
                    category: item.book?.category || 'General',
                    imageUrl: item.book?.cover || '',
                    dueDate: item.dueDate,
                    daysRemaining: Math.ceil((new Date(item.dueDate) - new Date()) / (1000 * 60 * 60 * 24)),
                    renewalsLeft: item.renewalsLeft,
                    borrowedDate: item.borrowDate
                }));
            }
        } catch (e) {
            console.error('Failed to load borrowed books:', e);
        }
    }

    // Load user's reading history from API into userData.history
    async function loadUserHistory() {
        if (!currentUser || !currentUser.id) {
            userData.history = [];
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/history?userId=${currentUser.id}`);
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                const mapped = result.data.map(item => ({
                    id: item.id,
                    bookId: item.bookId,
                    bookTitle: item.book?.title || 'Unknown title',
                    author: item.book?.author || 'Unknown author',
                    finishedDate: item.returnDate ? formatDate(item.returnDate) : '',
                    rating: typeof item.rating === 'number' ? item.rating : null,
                    coverUrl: item.book?.cover || '',
                    category: item.book?.category || 'General'
                }));
                userData.history = mapped;
                saveUserDataForCurrentUser(userData);
            } else {
                userData.history = [];
            }
        } catch (e) {
            console.error('Failed to load user history:', e);
            userData.history = [];
        }
    }

    // Load user's reservations from API
    async function loadUserReservations() {
        if (!currentUser || !currentUser.id) return;

        try {
            // Backend supports 'user' for active and 'expired' for expired reservations
            const [activeResp, expiredResp] = await Promise.all([
                fetch(`${API_BASE}/reserve?action=user&userId=${currentUser.id}`),
                fetch(`${API_BASE}/reserve?action=expired&userId=${currentUser.id}`)
            ]);

            const activeResult = await activeResp.json();
            const expiredResult = await expiredResp.json();

            if (activeResult.success && Array.isArray(activeResult.data)) {
                reservations = activeResult.data.map(item => {
                    const rawStatus = (item.status || 'waiting').toLowerCase();

                    let statusLabel;
                    if (rawStatus === 'ready') statusLabel = 'Ready';
                    else if (rawStatus === 'waiting') statusLabel = 'Waiting';
                    else {
                        statusLabel = rawStatus
                            .split('_')
                            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                            .join(' ');
                    }

                    const pickupDate = item.pickupDate || null;
                    const queuePosition = item.queuePosition;
                    let waitTime = '';

                    if (pickupDate) {
                        if (rawStatus === 'ready') {
                            waitTime = `Pickup by ${formatDate(pickupDate)}`;
                        } else {
                            waitTime = `Pickup on ${formatDate(pickupDate)}`;
                        }
                    } else if (typeof queuePosition === 'number') {
                        waitTime = `You are #${queuePosition} in line`;
                    } else {
                        waitTime = `Status: ${statusLabel}`;
                    }

                    return {
                        id: item.id,
                        bookId: item.bookId,
                        title: item.book?.title || 'Unknown',
                        author: item.book?.author || 'Unknown',
                        image: item.book?.cover || "https://images.unsplash.com/photo-1614583224978-f05ce51ef5fa?auto=format&fit=crop&q=80&w=300",
                        status: statusLabel,
                        rawStatus,
                        queuePosition,
                        pickupDate,
                        waitTime
                    };
                });
            } else {
                reservations = [];
            }

            if (expiredResult.success && Array.isArray(expiredResult.data)) {
                expiredReservations = expiredResult.data.map(item => ({
                    id: item.id,
                    bookId: item.bookId,
                    title: item.book?.title || 'Unknown',
                    author: item.book?.author || 'Unknown',
                    image: item.book?.cover || "https://images.unsplash.com/photo-1614583224978-f05ce51ef5fa?auto=format&fit=crop&q=80&w=300",
                    pickupDate: item.pickupDate || null,
                    rawStatus: (item.status || 'expired').toLowerCase()
                }));
            } else {
                expiredReservations = [];
            }
        } catch (e) {
            console.error('Failed to load reservations:', e);
            reservations = [];
            expiredReservations = [];
        }
    }

    // User wishlist / favorites
    let userWishlist = [];
    // Recently read
    let recentlyRead = [];

    // Load user's wishlist (favorites) from API
    async function loadUserWishlist() {
        if (!currentUser || !currentUser.id) return;

        try {
            const response = await fetch(`${API_BASE}/favorites?action=list&userId=${currentUser.id}`);
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                userWishlist = result.data;
            }
        } catch (e) {
            console.error('Failed to load wishlist:', e);
        }
    }

    // Load full user stats for the Stats section
    async function loadUserFullStats() {
        if (!currentUser || !currentUser.id) {
            userFullStats = null;
            statsGoalPercent = 0;
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/history?action=fullStats&userId=${currentUser.id}`);
            const result = await response.json();
            if (result.success && result.data) {
                userFullStats = result.data;
            } else {
                userFullStats = null;
            }
        } catch (e) {
            console.error('Failed to load user stats:', e);
            userFullStats = null;
        }

        updateStatsSection();
        updateSectionHeroStats();
        renderForYouFromData();
    }

    // Load recently read books from recent
    async function loadRecentlyRead() {
        if (!currentUser || !currentUser.id) {
            recentlyRead = [];
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/recent?action=list&userId=${currentUser.id}`);
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                recentlyRead = result.data;
            } else {
                recentlyRead = [];
            }
        } catch (e) {
            console.error('Failed to load recently read:', e);
            recentlyRead = [];
        }
    }

    // Track a book as recently read via recent
    async function trackRecentlyRead(bookId) {
        if (!currentUser || !currentUser.id || !bookId) return;

        try {
            await fetch(`${API_BASE}/recent?action=track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    bookId: bookId
                })
            });
        } catch (e) {
            console.error('Failed to track recently read:', e);
        }
    }

    // Check if book is in wishlist
    function isInWishlist(bookId) {
        return userWishlist.some(b => b.id === bookId || b.bookId === bookId);
    }

    // Toggle wishlist (favorites) - add or remove book
    async function toggleWishlist(bookId) {
        if (!currentUser || !currentUser.id) {
            showActionFeedback('Please log in to use wishlist', 'error');
            return false;
        }

        const inWishlist = isInWishlist(bookId);
        const action = inWishlist ? 'remove' : 'add';

        try {
            const response = await fetch(`${API_BASE}/favorites?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookId: bookId,
                    userId: currentUser.id
                })
            });
            const result = await response.json();

            if (result.success) {
                await loadUserWishlist();
                renderWishlistSection();
                renderProfileFavorites();
                updateSectionHeroStats();
                renderForYouFromData();
                showActionFeedback(inWishlist ? 'Removed from wishlist' : 'Added to wishlist', 'success');
                return true;
            } else {
                showActionFeedback(result.message || 'Failed to update wishlist', 'error');
                return false;
            }
        } catch (e) {
            console.error('Wishlist error:', e);
            showActionFeedback('Failed to update wishlist', 'error');
            return false;
        }
    }

    // Render wishlist section (API favorites) using redesigned wishlist cards
    function renderWishlistSection() {
        const wishlistGridEl = document.querySelector('#wishlist-section .wishlist-grid');
        if (!wishlistGridEl) return;

        wishlistGridEl.innerHTML = '';

        if (!userWishlist.length) {
            wishlistGridEl.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-gray);">
                    <i class="fas fa-heart" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>Your wishlist is empty. Click the heart icon on books to add them!</p>
                </div>
            `;
            return;
        }

        userWishlist.forEach(book => {
            const title = book.title || 'Untitled';
            const author = book.author || 'Unknown author';
            const category = book.category || 'General';
            const cover = book.cover || book.imageUrl || 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=300';

            const card = document.createElement('div');
            card.className = 'wishlist-card';
            card.dataset.bookId = book.id || book.bookId;

            card.innerHTML = `
                <img src="${cover}" class="wishlist-thumb" alt="Cover">
                <div class="wishlist-info">
                    <h3>${title}</h3>
                    <span class="author">${author}</span>
                    <div class="wishlist-meta">
                        <span><i class="fas fa-tag"></i> ${category}</span>
                    </div>
                </div>
                <div class="wishlist-actions">
                    <button class="btn-icon danger btn-remove-wishlist" title="Remove from wishlist">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            wishlistGridEl.appendChild(card);
        });
    }


    // Show action feedback in modal
    function showActionFeedback(message, type) {
        if (!actionFeedback) return;
        actionFeedback.className = 'action-feedback ' + type;
        actionFeedback.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' :
            type === 'error' ? 'fa-exclamation-circle' :
                type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'
            }"></i> ${message}`;
        actionFeedback.style.display = 'block';

        setTimeout(() => {
            actionFeedback.style.display = 'none';
        }, 4000);
    }

    // Helper: mark a button as disabled with an optional tooltip reason
    function setButtonDisabledWithReason(btn, isDisabled, reason) {
        if (!btn) return;
        if (isDisabled) {
            btn.classList.add('disabled');
            btn.setAttribute('aria-disabled', 'true');
            if (reason) {
                btn.title = reason;
            }
        } else {
            btn.classList.remove('disabled');
            btn.removeAttribute('aria-disabled');
            btn.removeAttribute('title');
        }
    }

    // Update modal button states based on book status and user's relationship to book
    function updateModalButtonStates(adminBook) {
        const btnBorrow = document.getElementById('btn-borrow');
        const btnReserveBook = document.getElementById('btn-reserve-book');
        const btnReturn = document.getElementById('btn-return');
        const btnRenew = document.getElementById('btn-renew');
        const reservationDateSection = document.getElementById('reservation-date-section');
        const bookDueInfo = document.getElementById('book-due-info');
        const borrowingStats = document.getElementById('borrowing-stats');
        const reservationDateInput = document.getElementById('reservation-date-input');
        const reservationConfirmActionsEl = document.getElementById('reservation-confirm-actions');
        const borrowedCountEl = document.getElementById('borrowed-count');
        const reservedCountEl = document.getElementById('reserved-count');
        const maxBorrowedEl = document.getElementById('max-borrowed');
        const modalDueDate = document.getElementById('modal-due-date');
        const renewalsLeftEl = document.getElementById('renewals-left');

        // Update stats display
        if (borrowingStats) {
            // For this modal, show how many copies of THIS book the current user has borrowed
            let borrowedCount = 0;
            let reservedCount = 0;

            if (adminBook && adminBook.id != null) {
                if (userData && Array.isArray(userData.due)) {
                    borrowedCount = userData.due.filter(d => d.bookId === adminBook.id).length;
                }
                if (Array.isArray(reservations)) {
                    reservedCount = reservations.filter(r => r.bookId === adminBook.id).length;
                }
            }

            let maxForThisBook = LIBRARY_CONFIG.maxBorrowedBooks;
            if (adminBook && adminBook.copies != null) {
                const parsedCopies = typeof adminBook.copies === 'number'
                    ? adminBook.copies
                    : parseInt(adminBook.copies, 10);
                if (!isNaN(parsedCopies) && parsedCopies > 0) {
                    maxForThisBook = parsedCopies;
                }
            }

            if (borrowedCountEl) borrowedCountEl.textContent = borrowedCount;
            if (reservedCountEl) reservedCountEl.textContent = reservedCount;
            if (maxBorrowedEl) maxBorrowedEl.textContent = maxForThisBook;
        }

        // Reset all buttons and sections
        if (btnBorrow) {
            btnBorrow.style.display = 'flex';
            setButtonDisabledWithReason(btnBorrow, false);
        }
        if (btnReserveBook) {
            // Restore default Reserve label when resetting state
            btnReserveBook.innerHTML = '<i class="fas fa-bookmark"></i> Reserve';
            btnReserveBook.style.display = 'flex';
            setButtonDisabledWithReason(btnReserveBook, false);
        }
        if (btnReturn) {
            btnReturn.style.display = 'none';
            setButtonDisabledWithReason(btnReturn, false);
        }
        if (btnRenew) {
            btnRenew.style.display = 'none';
            setButtonDisabledWithReason(btnRenew, false);
        }
        if (reservationDateSection) reservationDateSection.style.display = 'none';
        if (reservationConfirmActionsEl) reservationConfirmActionsEl.style.display = 'none';
        if (bookDueInfo) bookDueInfo.style.display = 'none';

        if (!adminBook) return;

        const bookId = adminBook.id;
        const dueEntry = getUserDueEntry(bookId);
        const hasReservation = userHasReservation(bookId);

        // Set date picker constraints but do not pre-fill a value
        if (reservationDateInput) {
            const base = new Date();
            const minDate = new Date(base.getTime());
            minDate.setDate(minDate.getDate() + LIBRARY_CONFIG.minReservationAdvanceDays);
            const maxDate = new Date(base.getTime());
            maxDate.setDate(maxDate.getDate() + LIBRARY_CONFIG.maxReservationAdvanceDays);

            const toInputValue = (d) => d.toISOString().split('T')[0];
            reservationDateInput.min = toInputValue(minDate);
            reservationDateInput.max = toInputValue(maxDate);

            // Clear any previously selected date when opening the modal
            reservationDateInput.value = '';
        }

        // Case 1: User has this book borrowed
        if (dueEntry) {
            if (btnBorrow) btnBorrow.style.display = 'none';
            if (btnReserveBook) btnReserveBook.style.display = 'none';
            if (btnReturn) btnReturn.style.display = 'flex';
            if (btnRenew) {
                btnRenew.style.display = 'flex';
                const renewExhausted = (dueEntry.renewalsUsed || 0) >= LIBRARY_CONFIG.maxRenewals;
                if (renewExhausted) {
                    setButtonDisabledWithReason(btnRenew, true, 'You have used all allowed renewals for this book');
                }
            }
            if (bookDueInfo) {
                bookDueInfo.style.display = 'flex';
                if (modalDueDate) modalDueDate.textContent = formatDate(dueEntry.dueDate);
                if (renewalsLeftEl) renewalsLeftEl.textContent = LIBRARY_CONFIG.maxRenewals - (dueEntry.renewalsUsed || 0);

                // Check if overdue
                const today = new Date();
                const due = new Date(dueEntry.dueDate);
                if (today > due) {
                    bookDueInfo.classList.add('overdue');
                } else {
                    bookDueInfo.classList.remove('overdue');
                }
            }
            return;
        }

        // Case 2: User already has reservation for this book
        if (hasReservation) {
            if (btnBorrow) { btnBorrow.style.display = 'none'; }
            if (btnReserveBook) {
                btnReserveBook.innerHTML = '<i class="fas fa-check"></i> Already Reserved';
                setButtonDisabledWithReason(btnReserveBook, true, 'You already have a reservation for this book');
            }
            return;
        }

        // Case 3: Book is available - can borrow, not reserve
        if (adminBook.status === 'available') {
            if (btnReserveBook) {
                setButtonDisabledWithReason(btnReserveBook, true, 'Reservations are only needed when all copies are borrowed');
            }
            if (!canUserBorrow()) {
                if (btnBorrow) setButtonDisabledWithReason(btnBorrow, true, 'You have reached the maximum number of borrowed books');
            }
            return;
        }

        // Case 4: Book is not available - user may choose to reserve
        // Borrow is disabled, Reserve is enabled. The pickup date section
        // will only be shown when the user actually clicks Reserve.
        if (btnBorrow) setButtonDisabledWithReason(btnBorrow, true, 'All copies are currently borrowed');
        if (reservationDateSection) reservationDateSection.style.display = 'none';
        if (!canUserReserve()) {
            if (btnReserveBook) setButtonDisabledWithReason(btnReserveBook, true, 'You have reached the maximum number of active reservations');
        }
    }

    let adminBooks = [];

    // Show simple in-app notification banner for borrower nudges
    function showBorrowerNudgeBanner(messages) {
        if (!messages || !messages.length) return;

        const existing = document.getElementById('dashboard-notification-banner');
        if (existing) {
            existing.remove();
        }

        const container = document.createElement('div');
        container.id = 'dashboard-notification-banner';
        container.className = 'dashboard-notification-banner';

        const primary = messages[0];
        const text = primary.message || 'You have overdue books that other readers are waiting for.';

        container.innerHTML = `
            <div class="banner-icon">
                <i class="fas fa-bell"></i>
            </div>
            <div class="banner-content">
                <div class="banner-title">Return requested</div>
                <div class="banner-message">${text}</div>
            </div>
            <button class="banner-close" type="button" aria-label="Dismiss notification">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.querySelector('.banner-close').addEventListener('click', () => {
            container.remove();
        });

        const root = document.querySelector('.dashboard-shell') || document.body;
        root.appendChild(container);
    }

    async function loadUserNotificationsAndShowBanner() {
        if (!currentUser || !currentUser.id) return;

        try {
            const response = await fetch(`${API_BASE}/notifications?action=listForUser&userId=${currentUser.id}`);
            const result = await response.json();
            if (!result.success || !Array.isArray(result.data) || !result.data.length) return;

            const nudges = result.data.filter(n => n.notification_type === 'borrower_nudge');
            if (!nudges.length) return;

            // Only surface nudges that still make sense: user must still
            // have an overdue loan for the referenced book.
            const activeOverdueBookIds = new Set();
            if (userData && Array.isArray(userData.due)) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                userData.due.forEach(entry => {
                    if (!entry || !entry.bookId || !entry.dueDate) return;
                    try {
                        const due = new Date(entry.dueDate);
                        due.setHours(0, 0, 0, 0);
                        if (due < today) {
                            activeOverdueBookIds.add(entry.bookId);
                        }
                    } catch (e) {
                        // Ignore parse errors and fall back to server state
                    }
                });
            }

            const relevantNudges = nudges.filter(n => {
                if (!n.book_id) return false;
                if (!activeOverdueBookIds.size) return false;
                return activeOverdueBookIds.has(n.book_id);
            });

            if (!relevantNudges.length) return;

            showBorrowerNudgeBanner(relevantNudges);

            // Mark shown notifications as read so they don't reappear
            try {
                await Promise.all(relevantNudges.map(n => {
                    if (!n.id) return null;
                    return fetch(`${API_BASE}/notifications?action=markRead`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: n.id, userId: currentUser.id })
                    }).catch(() => undefined);
                }));
            } catch (e) {
                // Non-blocking if marking as read fails
            }
        } catch (e) {
            // Silent fail; notifications are non-critical
        }
    }

    // Initialize all data from APIs
    async function initializeBooks() {
        // Load catalog
        adminBooks = await loadAdminBooks();

        // Load user's borrowed books, reservations, and wishlist
        await loadUserBorrowedBooks();
        await loadUserReservations();
        await loadUserWishlist();
        await loadUserFullStats();
        await loadRecentlyRead();

        // Render all sections
        renderCatalogFromAdmin();
        renderHomeContinueFromAdmin();
        renderDueDatesFromUserData();
        renderReservations();
        renderWishlistSection();
        renderRecentSection();
        renderProfileBorrowed();
        renderProfileFavorites();

        // Refresh history and summary views with fully loaded data
        renderHistoryFromUserData();
        updateHomeStats();
        updateSectionHeroStats();
        renderForYouFromData();

        // Finally, check for any borrower-nudge notifications for this user
        await loadUserNotificationsAndShowBanner();
    }

    // Make functions globally accessible for onclick handlers
    window.toggleWishlist = toggleWishlist;
    window.cancelReservationById = cancelReservationById;



    function findAdminBookByTitle(title) {
        if (!title) return null;
        if (!Array.isArray(adminBooks)) return null;
        const lower = title.toLowerCase();
        return adminBooks.find(b => (b.title || '').toLowerCase() === lower) || null;
    }


    // Extended Data for Demo (fallbacks when admin data is missing)
    const bookData = {
        "Dune": {
            desc: "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the 'spice' melange, a drug capable of extending life and enhancing consciousness.",
            copies: 3,
            currentHolders: [
                { name: "Sarah Connor", returnDate: "Dec 15, 2023", overdue: false },
                { name: "Kyle Reese", returnDate: "Dec 18, 2023", overdue: false }
            ]
        },
        "The Hobbit": {
            desc: "In a hole in the ground there lived a hobbit. Not a nasty, dirty, wet hole, filled with the ends of worms and an oozy smell, nor yet a dry, bare, sandy hole with nothing in it to sit down on or to eat: it was a hobbit-hole, and that means comfort.",
            copies: 1,
            currentHolders: [
                { name: "Bilbo Baggins", returnDate: "Nov 20, 2023", overdue: true, phone: "+1 (555) 019-2834" }
            ]
        },
        "Sherlock Holmes": {
            desc: "The Adventures of Sherlock Holmes is a collection of twelve short stories by Arthur Conan Doyle, first published on 14 October 1892.",
            copies: 5,
            currentHolders: []
        },
        "Meditations": {
            desc: "Meditations is a series of personal writings by Marcus Aurelius, Roman Emperor from 161 to 180 AD, recording his private notes to himself and ideas on Stoic philosophy.",
            copies: 2,
            currentHolders: [
                { name: "Lucius Verus", returnDate: "Dec 10, 2023", overdue: false }
            ]
        },
        "The Great Gatsby": {
            desc: "The Great Gatsby is a 1925 novel by American writer F. Scott Fitzgerald. Set in the Jazz Age on Long Island, near New York City.",
            copies: 0,
            currentHolders: [
                { name: "Daisy Buchanan", returnDate: "Oct 30, 2023", overdue: true, phone: "+1 (555) 998-2211" },
                { name: "Tom Buchanan", returnDate: "Dec 05, 2023", overdue: false }
            ]
        },
        "1984": {
            desc: "Nineteen Eighty-Four is a dystopian social science fiction novel and cautionary tale written by the English writer George Orwell.",
            copies: 4,
            currentHolders: []
        },
        "Project Hail Mary": {
            desc: "Ryland Grace is the sole survivor on a desperate, last-chance mission—and if he fails, humanity and the earth itself will perish.",
            copies: 0,
            currentHolders: [
                { name: "Stratt", returnDate: "Dec 25, 2023", overdue: false },
                { name: "Yevgeny Dimitri", returnDate: "Dec 28, 2023", overdue: false }
            ]
        },
        "The Alchemist": {
            desc: "The Alchemist follows the journey of an Andalusian shepherd boy named Santiago. Believing a recurring dream to be prophetic, he asks a Romani fortune teller in a nearby town about its meaning.",
            copies: 8,
            currentHolders: []
        },
        "Foundation": {
            desc: "The Foundation series is a science fiction book series written by American author Isaac Asimov. First published as a series of short stories in 1942–50, and subsequently in three collections in 1951–53, for thirty years the series was a trilogy: Foundation, Foundation and Empire, and Second Foundation.",
            copies: 2,
            currentHolders: []
        },
        "Name of the Wind": {
            desc: "The Name of the Wind, also called The Kingkiller Chronicle: Day One, is a fantasy novel written by American author Patrick Rothfuss. It is the first book in the Kingkiller Chronicle series and was published in 2007.",
            copies: 0,
            currentHolders: [
                { name: "Kvothe", returnDate: "Jan 01, 2024", overdue: false }
            ]
        }
    };

    // --- RESERVATION DATA (from API) ---
    let reservations = [];
    let expiredReservations = [];

    // --- USER STATS (from API) ---
    let userFullStats = null;
    let statsGoalPercent = 0;

    let currentUser = null;
    try {
        const storedUser = sessionStorage.getItem('currentUser');
        currentUser = storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
        currentUser = null;
    }

    function getCurrentUserKey() {
        if (currentUser && currentUser.id) return 'user_' + currentUser.id;
        if (currentUser && currentUser.username) return 'user_' + currentUser.username;
        return 'user_guest';
    }

    const USER_DATA_KEY = 'user_library_data';

    function buildDefaultUserData() {
        // New users start with empty data - no demo content
        return {
            history: [],
            wishlist: [],
            due: []
        };
    }

    function loadUserData() {
        const key = getCurrentUserKey();
        const all = loadJSON(USER_DATA_KEY, {});
        let data = all[key];
        if (!data || typeof data !== 'object') {
            data = buildDefaultUserData();
            all[key] = data;
            saveJSON(USER_DATA_KEY, all);
        }
        return data;
    }

    function saveUserDataForCurrentUser(data) {
        const key = getCurrentUserKey();
        const all = loadJSON(USER_DATA_KEY, {});
        all[key] = data;
        saveJSON(USER_DATA_KEY, all);
    }

    let userData = loadUserData();

    const headerUserNameEl = document.querySelector('.user-profile .user-name');
    const headerUserRoleEl = document.querySelector('.user-profile .user-role');
    const avatarEl = document.querySelector('.user-profile .avatar');
    const welcomeBannerH1 = document.querySelector('.welcome-banner .banner-text h1');
    const profileNameInput = document.getElementById('profile-full-name');
    const profileEmailInput = document.getElementById('profile-email');
    const profilePhoneInput = document.getElementById('profile-phone');
    const profileBioInput = document.getElementById('profile-bio');
    const profileMembershipInput = document.getElementById('profile-membership-id');
    const profileAvatarEl = document.getElementById('profile-avatar');
    const profileAvatarInitialsEl = document.getElementById('profile-avatar-initials');
    const profileDisplayNameEl = document.getElementById('profile-display-name');
    const profileRoleEl = document.getElementById('profile-role');
    const profileEmailDisplayEl = document.getElementById('profile-email-display');

    // Get user display name
    const userDisplayName = currentUser ? (currentUser.fullName || currentUser.username || 'Guest') : 'Guest';
    const userFirstName = userDisplayName.split(' ')[0];

    // Update header user info
    if (currentUser && headerUserNameEl) {
        headerUserNameEl.innerText = userDisplayName;
    }
    if (currentUser && headerUserRoleEl) {
        headerUserRoleEl.innerText = currentUser.role === 'admin' ? 'Admin' : 'Member';
    }

    // Update avatar initials
    if (avatarEl || profileAvatarInitialsEl) {
        const nameParts = userDisplayName.split(' ');
        let initials = nameParts[0].charAt(0).toUpperCase();
        if (nameParts.length > 1) {
            initials += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
        }
        if (avatarEl) {
            avatarEl.innerText = initials;
        }
        if (profileAvatarInitialsEl) {
            profileAvatarInitialsEl.innerText = initials;
        }
    }

    // Update profile header text
    if (profileDisplayNameEl) {
        profileDisplayNameEl.innerText = userDisplayName;
    }
    if (profileRoleEl && currentUser) {
        profileRoleEl.innerText = currentUser.role === 'admin' ? 'Admin' : 'Member';
    }
    if (profileEmailDisplayEl && currentUser) {
        profileEmailDisplayEl.innerText = currentUser.email || (currentUser.username ? currentUser.username + '@example.com' : '');
    }

    // Update welcome banner
    if (welcomeBannerH1) {
        welcomeBannerH1.innerText = `Welcome back, ${userFirstName}!`;
    }

    // Update profile form with basic user data first
    if (profileNameInput && currentUser) {
        profileNameInput.value = userDisplayName;
    }
    if (profileEmailInput && currentUser) {
        profileEmailInput.value = currentUser.email || currentUser.username + '@example.com';
    }
    if (profileMembershipInput && currentUser && currentUser.id) {
        profileMembershipInput.value = profileMembershipInput.value || `LIB-${String(currentUser.id).padStart(4, '0')}`;
    }

    // Load extended profile data from profile API
    async function loadUserProfile() {
        if (!currentUser || !currentUser.id) return;

        try {
            const response = await fetch(`${API_BASE}/profile?userId=${currentUser.id}`);
            const result = await response.json();
            if (result.success && result.data) {
                const data = result.data;
                if (profileNameInput) {
                    profileNameInput.value = data.full_name || currentUser.fullName || currentUser.username || '';
                }
                if (profileEmailInput) {
                    profileEmailInput.value = data.email || currentUser.email || '';
                }
                if (profilePhoneInput) {
                    profilePhoneInput.value = data.phone || '';
                }
                if (profileBioInput) {
                    profileBioInput.value = data.bio || '';
                }
            }
        } catch (e) {
            console.error('Failed to load profile:', e);
        }
    }

    // Save profile changes: update core user fields via users API
    async function saveUserProfile(buttonEl) {
        if (!currentUser || !currentUser.id) return;

        const fullName = profileNameInput ? profileNameInput.value.trim() : '';
        const email = profileEmailInput ? profileEmailInput.value.trim() : '';
        const phone = profilePhoneInput ? profilePhoneInput.value.trim() : '';
        const bio = profileBioInput ? profileBioInput.value.trim() : '';

        const originalText = buttonEl.innerText;
        const originalBg = buttonEl.style.background;

        try {
            const payload = {
                full_name: fullName,
                email: email
            };

            const response = await fetch(`${API_BASE}/users?id=${currentUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (result.success) {
                // Reflect changes in session and header
                currentUser.fullName = fullName;
                currentUser.email = email;
                try {
                    sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
                } catch (e) { }

                if (headerUserNameEl) {
                    headerUserNameEl.innerText = fullName || currentUser.username || 'Member';
                }
                if (profileDisplayNameEl) {
                    profileDisplayNameEl.innerText = fullName || currentUser.username || 'Member';
                }
                if (profileEmailDisplayEl) {
                    profileEmailDisplayEl.innerText = email || (currentUser.username ? currentUser.username + '@example.com' : '');
                }

                const updatedName = fullName || currentUser.username || 'Guest';
                const nameParts = updatedName.split(' ');
                let initials = nameParts[0] ? nameParts[0].charAt(0).toUpperCase() : 'U';
                if (nameParts.length > 1) {
                    initials += nameParts[nameParts.length - 1].charAt(0).toUpperCase();
                }
                if (avatarEl) {
                    avatarEl.innerText = initials;
                }
                if (profileAvatarInitialsEl) {
                    profileAvatarInitialsEl.innerText = initials;
                }

                // Save extended profile info (phone/bio) via profile API
                try {
                    await fetch(`${API_BASE}/profile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: currentUser.id,
                            phone: phone || null,
                            bio: bio || null
                        })
                    });
                } catch (e) {
                    console.error('Failed to save extended profile:', e);
                }

                buttonEl.innerText = 'Saved!';
                buttonEl.style.background = 'var(--success-green)';
                setTimeout(() => {
                    buttonEl.innerText = originalText;
                    buttonEl.style.background = originalBg;
                }, 2000);
            } else {
                buttonEl.innerText = 'Error';
                buttonEl.style.background = 'var(--danger-red)';
                setTimeout(() => {
                    buttonEl.innerText = originalText;
                    buttonEl.style.background = originalBg;
                }, 2000);
            }
        } catch (e) {
            console.error('Failed to save profile:', e);
            buttonEl.innerText = 'Error';
            buttonEl.style.background = 'var(--danger-red)';
            setTimeout(() => {
                buttonEl.innerText = originalText;
                buttonEl.style.background = originalBg;
            }, 2000);
        }
    }

    if (currentUser && currentUser.id) {
        loadUserProfile();
    }

    // Reservations are now fully driven by loadUserReservations() from the API

    function renderReservations() {
        const activeContainer = document.getElementById('active-reservations-list') || document.querySelector('.reservations-list');
        const expiredContainer = document.getElementById('expired-reservations');

        if (!activeContainer) return;

        activeContainer.innerHTML = '';

        if (!reservations || reservations.length === 0) {
            activeContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-gray);">
                    <i class="fas fa-calendar-times" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No active reservations.</p>
                </div>
            `;
        } else {
            reservations.forEach(res => {
            let statusColor = '#f1c40f'; // Pending / Waiting (Yellow)
            let statusDot = 'background: #f1c40f; box-shadow: 0 0 10px rgba(241, 196, 15, 0.4);';

            if (res.status === 'Ready') {
                statusColor = '#2ecc71'; // Green
                statusDot = 'background: #2ecc71; box-shadow: 0 0 10px rgba(46, 204, 113, 0.4);';
            } else if (res.status === 'In Transit') {
                statusColor = '#3498db'; // Blue
                statusDot = 'background: #3498db; box-shadow: 0 0 10px rgba(52, 152, 219, 0.4);';
            }

            const card = document.createElement('div');
            card.className = 'ticket-card';
            card.dataset.id = res.id;
            card.innerHTML = `
                <div class="ticket-left">
                    <div class="ticket-book">
                        <img src="${res.image}" class="ticket-thumb" alt="Cover">
                        <div class="ticket-info">
                            <h3>${res.title}</h3>
                            <p>${res.author}</p>
                            <div class="queue-badge">
                                <i class="fas fa-users"></i> ${res.status === 'Ready' ? 'Ready for Pickup' : (typeof res.queuePosition === 'number' ? `You are #${res.queuePosition} in line` : 'In queue')}
                            </div>
                            <div class="wait-time" style="color: ${statusColor}">${res.waitTime}</div>
                        </div>
                    </div>
                </div>
                <div class="ticket-right">
                    <div class="ticket-status">
                        <span class="status-dot" style="${statusDot}"></span> ${res.status}
                    </div>
                    <div class="ticket-action">
                        <button class="btn-primary-small view-details-btn" style="margin-bottom: 8px;">View Details</button>
                        ${res.rawStatus === 'ready' ? `
                        <button class="btn-primary-small pickup-btn" style="margin-bottom: 8px; background: var(--accent-green); color: #fff;">Pick Up</button>
                        ` : ''}
                        <button class="btn-primary-small cancel-btn" 
                            style="background: rgba(231, 76, 60, 0.2); color: #e74c3c;">Cancel</button>
                    </div>
                </div>
            `;
                activeContainer.appendChild(card);
            });
        }

        if (expiredContainer) {
            expiredContainer.innerHTML = '';

            if (expiredReservations && expiredReservations.length > 0) {
                const header = document.createElement('div');
                header.className = 'expired-header';
                header.innerHTML = `
                    <h3 style="font-size: 16px; margin-bottom: 8px;">Expired Reservations</h3>
                    <p style="font-size: 13px; color: var(--text-gray);">Reservations you didn’t pick up in time.</p>
                `;
                expiredContainer.appendChild(header);

                const list = document.createElement('div');
                list.className = 'expired-list';

                expiredReservations.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'ticket-card expired';
                    card.innerHTML = `
                        <div class="ticket-left">
                            <div class="ticket-book">
                                <img src="${item.image}" class="ticket-thumb" alt="Cover">
                                <div class="ticket-info">
                                    <h3>${item.title}</h3>
                                    <p>${item.author}</p>
                                    <div class="queue-badge" style="background: rgba(231, 76, 60, 0.1); color: #e74c3c;">
                                        <i class="fas fa-exclamation-circle"></i> Expired${item.pickupDate ? ` - pickup by ${formatDate(item.pickupDate)}` : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    list.appendChild(card);
                });

                expiredContainer.appendChild(list);
            }
        }
    }

    function updateSectionHeroStats() {
        // HISTORY HERO
        const totalRead = userFullStats && typeof userFullStats.totalBooks === 'number'
            ? userFullStats.totalBooks
            : (userData && Array.isArray(userData.history) ? userData.history.length : 0);

        const overdueReturns = userFullStats && typeof userFullStats.overdueCount === 'number'
            ? userFullStats.overdueCount
            : 0;
        const onTimeReturns = Math.max(0, totalRead - overdueReturns);

        if (historyHeroTotalEl) historyHeroTotalEl.innerText = totalRead;
        if (historyHeroOnTimeEl) historyHeroOnTimeEl.innerText = onTimeReturns;
        if (historyHeroOverdueEl) historyHeroOverdueEl.innerText = overdueReturns;

        // DUE DATES HERO
        const dueList = userData && Array.isArray(userData.due) ? userData.due : [];
        const borrowedCount = dueList.length;
        const dueSoonCount = dueList.filter(entry => {
            const days = typeof entry.daysRemaining === 'number' ? entry.daysRemaining : 0;
            return days >= 0 && days <= 5;
        }).length;
        const overdueCount = dueList.filter(entry => {
            const days = typeof entry.daysRemaining === 'number' ? entry.daysRemaining : 0;
            return days < 0;
        }).length;

        if (dueHeroBorrowedEl) dueHeroBorrowedEl.innerText = borrowedCount;
        if (dueHeroDueSoonEl) dueHeroDueSoonEl.innerText = dueSoonCount;
        if (dueHeroOverdueEl) dueHeroOverdueEl.innerText = overdueCount;

        // RESERVATIONS HERO
        const activeReservationsCount = Array.isArray(reservations) ? reservations.length : 0;
        const readyCount = Array.isArray(reservations)
            ? reservations.filter(r => (r.rawStatus || '').toLowerCase() === 'ready').length
            : 0;
        const expiredCount = Array.isArray(expiredReservations) ? expiredReservations.length : 0;

        if (reservationsHeroActiveEl) reservationsHeroActiveEl.innerText = activeReservationsCount;
        if (reservationsHeroReadyEl) reservationsHeroReadyEl.innerText = readyCount;
        if (reservationsHeroExpiredEl) reservationsHeroExpiredEl.innerText = expiredCount;

        // WISHLIST HERO
        const wishlistCount = Array.isArray(userWishlist) ? userWishlist.length : 0;
        if (wishlistHeroCountEl) wishlistHeroCountEl.innerText = wishlistCount;

        // RECENT HERO
        const recent = Array.isArray(recentlyRead) ? recentlyRead : [];
        if (recentHeroCountEl) recentHeroCountEl.innerText = recent.length;

        if (recentHeroLastEl) {
            let latestLabel = '–';
            let latestDate = null;

            recent.forEach(entry => {
                const raw = entry.last_read_date || entry.lastReadDate || entry.last_read || null;
                if (!raw) return;
                const d = new Date(raw);
                if (!latestDate || d > latestDate) {
                    latestDate = d;
                    latestLabel = formatDate(raw);
                }
            });

            recentHeroLastEl.innerText = latestDate ? latestLabel : '–';
        }

        // FOR YOU HERO & PROFILE HERO
        const activeBorrowed = borrowedCount;
        const booksReadForSummary = totalRead;

        if (forYouStatReadEl) forYouStatReadEl.innerText = booksReadForSummary;
        if (forYouStatActiveEl) forYouStatActiveEl.innerText = activeBorrowed;
        if (forYouStatWishlistEl) forYouStatWishlistEl.innerText = wishlistCount;

        if (profileHeroBooksEl) profileHeroBooksEl.innerText = booksReadForSummary;
        if (profileHeroActiveEl) profileHeroActiveEl.innerText = activeBorrowed;
        if (profileHeroWishlistEl) profileHeroWishlistEl.innerText = wishlistCount;

        if (forYouHeroSubtitleEl) {
            if (booksReadForSummary > 0 || activeBorrowed > 0 || wishlistCount > 0) {
                const favCat = getFavoriteCategoryFromData();
                if (favCat) {
                    forYouHeroSubtitleEl.innerText = `Based on your activity and love for ${favCat}.`;
                } else {
                    forYouHeroSubtitleEl.innerText = 'Suggestions based on what you borrow, finish, and save.';
                }
            } else {
                forYouHeroSubtitleEl.innerText = 'Start by borrowing or saving a few books to see personalized picks.';
            }
        }
    }

    // Cancel reservation - uses API
    async function cancelReservationById(id) {
        if (!id) return false;

        if (!currentUser || !currentUser.id) {
            showActionFeedback('Please log in to cancel reservations', 'error');
            return false;
        }

        try {
            const response = await fetch(`${API_BASE}/reserve?action=cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationId: id,
                    userId: currentUser.id
                })
            });
            const result = await response.json();

            if (result.success) {
                await loadUserReservations();
                renderReservations();

                updateSectionHeroStats();
                showActionFeedback('Reservation cancelled successfully', 'success');
                return true;
            } else {
                showActionFeedback(result.message || 'Failed to cancel reservation', 'error');
                return false;
            }
        } catch (e) {
            console.error('Cancel reservation error:', e);
            showActionFeedback('Failed to cancel reservation', 'error');
            return false;
        }
    }


    const homeContinueGrid = document.querySelector('#home-continue-grid');
    const catalogGrid = document.querySelector('#catalog-section .content-grid');
    const historyListEl = document.querySelector('#history-section .history-list');
    const dueDatesGridEl = document.querySelector('#due-dates-section .due-dates-grid');
    const wishlistGridEl = document.querySelector('#wishlist-section .wishlist-grid');
    const recentGridEl = document.getElementById('recent-grid');
    const profileBorrowedListEl = document.getElementById('profile-borrowed-list');
    const profileFavoritesListEl = document.getElementById('profile-favorites-list');

    // For You section grids
    const forYouContinueGrid = document.getElementById('for-you-continue-grid');
    const forYouCategoryGrid = document.getElementById('for-you-category-grid');
    const forYouWishlistGrid = document.getElementById('for-you-wishlist-grid');

    // Hero metric elements
    const historyHeroTotalEl = document.getElementById('history-hero-total');
    const historyHeroOnTimeEl = document.getElementById('history-hero-on-time');
    const historyHeroOverdueEl = document.getElementById('history-hero-overdue');

    const dueHeroBorrowedEl = document.getElementById('due-hero-borrowed');
    const dueHeroDueSoonEl = document.getElementById('due-hero-due-soon');
    const dueHeroOverdueEl = document.getElementById('due-hero-overdue');

    const reservationsHeroActiveEl = document.getElementById('reservations-hero-active');
    const reservationsHeroReadyEl = document.getElementById('reservations-hero-ready');
    const reservationsHeroExpiredEl = document.getElementById('reservations-hero-expired');

    const wishlistHeroCountEl = document.getElementById('wishlist-hero-count');

    const recentHeroCountEl = document.getElementById('recent-hero-count');
    const recentHeroLastEl = document.getElementById('recent-hero-last');

    const forYouStatReadEl = document.getElementById('for-you-stat-read');
    const forYouStatActiveEl = document.getElementById('for-you-stat-active');
    const forYouStatWishlistEl = document.getElementById('for-you-stat-wishlist');
    const forYouCategoryTitleEl = document.getElementById('for-you-category-title');
    const forYouHeroSubtitleEl = document.getElementById('for-you-hero-subtitle');

    const profileHeroBooksEl = document.getElementById('profile-hero-books');
    const profileHeroActiveEl = document.getElementById('profile-hero-active');
    const profileHeroWishlistEl = document.getElementById('profile-hero-wishlist');

    function renderHomeContinueFromAdmin() {
        if (!homeContinueGrid) return;

        // Show books the current user has borrowed (from userData.due)
        const dueBooks = userData && Array.isArray(userData.due) ? userData.due : [];

        homeContinueGrid.innerHTML = '';

        if (!dueBooks.length) {
            // If there are no active borrows, fall back to recently read
            if (!recentlyRead || !recentlyRead.length) {
                homeContinueGrid.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-gray); grid-column: 1 / -1;">
                        <i class="fas fa-book-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                        <p>No books currently borrowed. Browse the catalog to borrow a book!</p>
                    </div>
                `;
                return;
            }

            recentlyRead.slice(0, 4).forEach(entry => {
                const title = entry.title || 'Untitled';
                const author = entry.author || 'Unknown author';
                const category = entry.category || 'General';
                const imageUrl = entry.cover || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800';
                const lastDate = entry.last_read_date || entry.lastReadDate || entry.last_read || null;
                const subtitle = lastDate ? `Last read on ${formatDate(lastDate)}` : 'Recently read';

                const card = document.createElement('div');
                card.className = 'content-card';
                card.innerHTML = `
                    <div class="card-image" style="background-image: url('${imageUrl}'); background-size: cover;"></div>
                    <div class="card-body">
                        <span class="card-tag">${category}</span>
                        <h3 class="card-title">${title}</h3>
                        <div class="card-meta">
                            <span>${author}</span>
                            <span>${subtitle}</span>
                        </div>
                    </div>
                `;
                homeContinueGrid.appendChild(card);
            });

            return;
        }

        dueBooks.slice(0, 4).forEach(entry => {
            const title = entry.bookTitle || 'Untitled';
            const author = entry.author || 'Unknown author';
            const daysRemaining = typeof entry.daysRemaining === 'number' ? entry.daysRemaining : 0;

            // Try to get cover image from admin books
            const adminBook = findAdminBookByTitle(title);
            const category = (adminBook && adminBook.category) || 'General';
            const imageUrl = (adminBook && adminBook.imageUrl) || entry.coverUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800';

            const card = document.createElement('div');
            card.className = 'content-card';
            card.innerHTML = `
                <div class="card-image" style="background-image: url('${imageUrl}'); background-size: cover;"></div>
                <div class="card-body">
                    <span class="card-tag">${category}</span>
                    <h3 class="card-title">${title}</h3>
                    <div class="card-meta">
                        <span>${author}</span>
                        <span>Due in ${daysRemaining} days</span>
                    </div>
                </div>
            `;
            homeContinueGrid.appendChild(card);
        });
    }

    function renderRecentSection() {
        if (!recentGridEl) return;

        recentGridEl.innerHTML = '';

        if (!recentlyRead || !recentlyRead.length) {
            recentGridEl.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-gray); grid-column: 1 / -1;">
                    <i class="fas fa-book-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>No recently read books yet. Finish a book to see it here!</p>
                </div>
            `;
            return;
        }

        recentlyRead.forEach(entry => {
            const title = entry.title || 'Untitled';
            const author = entry.author || 'Unknown author';
            const category = entry.category || 'General';
            const imageUrl = entry.cover || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800';
            const lastDate = entry.last_read_date || entry.lastReadDate || entry.last_read || null;
            const subtitle = lastDate ? `Last read on ${formatDate(lastDate)}` : 'Recently read';

            const card = document.createElement('div');
            card.className = 'content-card';
            card.innerHTML = `
                <div class="card-image" style="background-image: url('${imageUrl}'); background-size: cover;"></div>
                <div class="card-body">
                    <span class="card-tag">${category}</span>
                    <h3 class="card-title">${title}</h3>
                    <div class="card-meta">
                        <span>${author}</span>
                        <span>${subtitle}</span>
                    </div>
                </div>
            `;
            recentGridEl.appendChild(card);
        });
    }

    function getFavoriteCategoryFromData() {
        // Prefer server-computed most read category if available
        if (userFullStats && userFullStats.mostReadCategory) {
            return userFullStats.mostReadCategory;
        }

        const counts = new Map();

        function addCategory(cat) {
            if (!cat || cat === 'General') return;
            const key = String(cat);
            counts.set(key, (counts.get(key) || 0) + 1);
        }

        const history = userData && Array.isArray(userData.history) ? userData.history : [];
        history.forEach(entry => addCategory(entry.category));

        const due = userData && Array.isArray(userData.due) ? userData.due : [];
        due.forEach(entry => addCategory(entry.category));

        const wishlist = Array.isArray(userWishlist) ? userWishlist : [];
        wishlist.forEach(book => addCategory(book.category));

        const recent = Array.isArray(recentlyRead) ? recentlyRead : [];
        recent.forEach(entry => addCategory(entry.category));

        let best = null;
        let bestCount = 0;
        counts.forEach((count, cat) => {
            if (count > bestCount) {
                best = cat;
                bestCount = count;
            }
        });

        return best;
    }

    function renderForYouContinue() {
        if (!forYouContinueGrid) return;

        forYouContinueGrid.innerHTML = '';

        const dueBooks = userData && Array.isArray(userData.due) ? [...userData.due] : [];

        if (dueBooks.length) {
            // Soonest due first
            dueBooks.sort((a, b) => {
                const da = typeof a.daysRemaining === 'number' ? a.daysRemaining : 0;
                const db = typeof b.daysRemaining === 'number' ? b.daysRemaining : 0;
                return da - db;
            });

            dueBooks.slice(0, 4).forEach(entry => {
                const title = entry.bookTitle || 'Untitled';
                const author = entry.author || 'Unknown author';
                const daysRemaining = typeof entry.daysRemaining === 'number' ? entry.daysRemaining : 0;

                const adminBook = findAdminBookByTitle(title);
                const category = (adminBook && adminBook.category) || entry.category || 'General';
                const imageUrl = (adminBook && adminBook.imageUrl) || entry.imageUrl || entry.coverUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800';

                let subtitle = 'Due soon';
                if (daysRemaining > 0) subtitle = `Due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
                else if (daysRemaining === 0) subtitle = 'Due today';
                else {
                    const overdueDays = Math.abs(daysRemaining);
                    subtitle = `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
                }

                const card = document.createElement('div');
                card.className = 'content-card';
                card.innerHTML = `
                    <div class="card-image" style="background-image: url('${imageUrl}'); background-size: cover;"></div>
                    <div class="card-body">
                        <span class="card-tag">${category}</span>
                        <h3 class="card-title">${title}</h3>
                        <div class="card-meta">
                            <span>${author}</span>
                            <span>${subtitle}</span>
                        </div>
                    </div>
                `;
                forYouContinueGrid.appendChild(card);
            });
            return;
        }

        const recent = Array.isArray(recentlyRead) ? recentlyRead : [];
        if (!recent.length) {
            forYouContinueGrid.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 24px; color: var(--text-gray); grid-column: 1 / -1;">
                    <i class="fas fa-book-open" style="font-size: 40px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <p>Start reading to see personalized picks here.</p>
                </div>
            `;
            return;
        }

        recent.slice(0, 4).forEach(entry => {
            const title = entry.title || 'Untitled';
            const author = entry.author || 'Unknown author';
            const category = entry.category || 'General';
            const imageUrl = entry.cover || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800';
            const lastDate = entry.last_read_date || entry.lastReadDate || entry.last_read || null;
            const subtitle = lastDate ? `Last read on ${formatDate(lastDate)}` : 'Recently read';

            const card = document.createElement('div');
            card.className = 'content-card';
            card.innerHTML = `
                <div class="card-image" style="background-image: url('${imageUrl}'); background-size: cover;"></div>
                <div class="card-body">
                    <span class="card-tag">${category}</span>
                    <h3 class="card-title">${title}</h3>
                    <div class="card-meta">
                        <span>${author}</span>
                        <span>${subtitle}</span>
                    </div>
                </div>
            `;
            forYouContinueGrid.appendChild(card);
        });
    }

    function renderForYouCategoryRecommendations() {
        if (!forYouCategoryGrid) return;

        forYouCategoryGrid.innerHTML = '';

        const favoriteCategory = getFavoriteCategoryFromData();
        if (forYouCategoryTitleEl) {
            if (favoriteCategory) {
                forYouCategoryTitleEl.innerText = `Because you like ${favoriteCategory}`;
            } else {
                forYouCategoryTitleEl.innerText = 'Top picks from the catalog';
            }
        }

        if (!Array.isArray(adminBooks) || !adminBooks.length) {
            return;
        }

        const borrowedIds = new Set((userData && Array.isArray(userData.due) ? userData.due : []).map(d => d.bookId));
        const historyIds = new Set((userData && Array.isArray(userData.history) ? userData.history : []).map(h => h.bookId));
        const wishlistIds = new Set((Array.isArray(userWishlist) ? userWishlist : []).map(w => w.id || w.bookId));
        const reservedIds = new Set((Array.isArray(reservations) ? reservations : []).map(r => r.bookId));

        let pool = adminBooks.filter(book => {
            if (!book || !book.id) return false;
            if (borrowedIds.has(book.id) || historyIds.has(book.id) || wishlistIds.has(book.id) || reservedIds.has(book.id)) {
                return false;
            }
            if (!favoriteCategory) return true;
            const cat = (book.category || '').toLowerCase();
            return cat === favoriteCategory.toLowerCase();
        });

        if (!pool.length) {
            // Fallback: top-rated books not already interacted with
            pool = adminBooks.filter(book => !borrowedIds.has(book.id) && !historyIds.has(book.id));
        }

        pool.sort((a, b) => {
            const ra = typeof a.averageRating === 'number' ? a.averageRating : 0;
            const rb = typeof b.averageRating === 'number' ? b.averageRating : 0;
            return rb - ra;
        });

        pool.slice(0, 4).forEach(book => {
            const title = book.title || 'Untitled';
            const author = book.author || 'Unknown author';
            const category = book.category || 'General';
            const imageUrl = book.imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800';
            const rating = typeof book.averageRating === 'number' && book.averageRating > 0 ? book.averageRating.toFixed(1) : null;
            const subtitle = rating ? `${rating} ★ rating` : (book.status === 'available' ? 'Available now' : 'Popular pick');

            const card = document.createElement('div');
            card.className = 'content-card';
            card.dataset.bookId = book.id;
            card.innerHTML = `
                <div class="card-image" style="background-image: url('${imageUrl}');"></div>
                <div class="card-body">
                    <span class="card-tag">${category}</span>
                    <h3 class="card-title">${title}</h3>
                    <div class="card-meta"><span>${author}</span><span>${subtitle}</span></div>
                </div>
            `;
            forYouCategoryGrid.appendChild(card);
        });
    }

    function renderForYouWishlistStrip() {
        if (!forYouWishlistGrid) return;

        forYouWishlistGrid.innerHTML = '';

        const list = Array.isArray(userWishlist) ? userWishlist : [];
        if (!list.length) {
            forYouWishlistGrid.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 24px; color: var(--text-gray); grid-column: 1 / -1;">
                    <i class="fas fa-heart" style="font-size: 40px; margin-bottom: 12px; opacity: 0.5;"></i>
                    <p>Add books to your wishlist to get quick-start suggestions here.</p>
                </div>
            `;
            return;
        }

        list.slice(0, 4).forEach(book => {
            const title = book.title || 'Untitled';
            const author = book.author || 'Unknown author';
            const category = book.category || 'General';
            const imageUrl = book.cover || book.imageUrl || 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=300';

            const card = document.createElement('div');
            card.className = 'content-card';
            card.dataset.bookId = book.id || book.bookId;
            card.innerHTML = `
                <div class="card-image" style="background-image: url('${imageUrl}'); background-size: cover;"></div>
                <div class="card-body">
                    <span class="card-tag">Wishlist</span>
                    <h3 class="card-title">${title}</h3>
                    <div class="card-meta">
                        <span>${author}</span>
                        <span>From your wishlist</span>
                    </div>
                </div>
            `;
            forYouWishlistGrid.appendChild(card);
        });
    }

    function renderForYouFromData() {
        renderForYouContinue();
        renderForYouCategoryRecommendations();
        renderForYouWishlistStrip();
    }

    function renderProfileBorrowed() {
        if (!profileBorrowedListEl) return;

        profileBorrowedListEl.innerHTML = '';

        const list = userData && Array.isArray(userData.due) ? userData.due : [];

        if (!list.length) {
            profileBorrowedListEl.innerHTML = '<p style="color: var(--text-gray); font-size: 13px;">No borrowed books right now.</p>';
            return;
        }

        list.slice(0, 5).forEach(entry => {
            const title = entry.bookTitle || 'Untitled';
            const author = entry.author || 'Unknown author';
            const daysRemaining = typeof entry.daysRemaining === 'number' ? entry.daysRemaining : 0;

            let dueLabel = 'Due soon';
            if (daysRemaining === 0) dueLabel = 'Due today';
            else if (daysRemaining > 0) dueLabel = `Due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
            else if (daysRemaining < 0) {
                const overdueDays = Math.abs(daysRemaining);
                dueLabel = `Overdue by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`;
            }

            const adminBook = findAdminBookByTitle(title);
            const imageUrl = (adminBook && adminBook.imageUrl) || entry.coverUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=300';

            const item = document.createElement('div');
            item.className = 'profile-mini-card';
            item.innerHTML = `
                <img src="${imageUrl}" alt="Cover" class="profile-mini-thumb">
                <div class="profile-mini-info">
                    <h4>${title}</h4>
                    <p>${author}</p>
                    <p>${dueLabel}</p>
                </div>
            `;
            profileBorrowedListEl.appendChild(item);
        });
    }

    function renderProfileFavorites() {
        if (!profileFavoritesListEl) return;

        profileFavoritesListEl.innerHTML = '';

        const list = Array.isArray(userWishlist) ? userWishlist : [];

        if (!list.length) {
            profileFavoritesListEl.innerHTML = '<p style="color: var(--text-gray); font-size: 13px;">No favorites yet. Add books to your wishlist!</p>';
            return;
        }

        list.slice(0, 5).forEach(book => {
            const title = book.title || 'Untitled';
            const author = book.author || 'Unknown author';
            const category = book.category || 'General';
            const imageUrl = book.cover || book.imageUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=300';

            const item = document.createElement('div');
            item.className = 'profile-mini-card';
            item.innerHTML = `
                <img src="${imageUrl}" alt="Cover" class="profile-mini-thumb">
                <div class="profile-mini-info">
                    <h4>${title}</h4>
                    <p>${author}</p>
                    <p>${category}</p>
                </div>
            `;
            profileFavoritesListEl.appendChild(item);
        });
    }

    function buildStarsHtml(rating) {
        const value = typeof rating === 'number' && rating > 0 ? rating : 0;
        const full = Math.max(0, Math.min(5, Math.floor(value)));
        const stars = [];
        for (let i = 0; i < full; i++) stars.push('<i class="fas fa-star"></i>');
        while (stars.length < 5) stars.push('<i class="far fa-star"></i>');
        return stars.join('');
    }

    function renderHistoryFromUserData() {
        if (!historyListEl) return;
        const list = userData && Array.isArray(userData.history) ? userData.history : [];

        historyListEl.innerHTML = '';

        if (!list.length) {
            historyListEl.innerHTML = '<div class="empty-state" style="text-align:center; padding: 24px; color: var(--text-gray);">No reading history yet.</div>';
            return;
        }

        list.forEach(entry => {
            const title = entry.bookTitle || 'Unknown title';
            const author = entry.author || 'Unknown author';
            const finishedDate = entry.finishedDate || '';
            const rating = typeof entry.rating === 'number' ? entry.rating : 5;

            const adminBook = findAdminBookByTitle(title);
            const imageUrl = (adminBook && adminBook.imageUrl) || entry.coverUrl || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=300';

            const card = document.createElement('div');
            card.className = 'history-card';
            card.dataset.id = entry.id || '';
            card.innerHTML = `
                <img src="${imageUrl}" class="history-thumb" alt="Book Cover">
                <div class="history-info">
                    <h3 class="history-title">${title}</h3>
                    <p class="history-author">${author}</p>
                    <div class="history-date">
                        <i class="fas fa-check-circle"></i> ${finishedDate ? `Returned on ${finishedDate}` : 'Completed'}
                    </div>
                </div>
                <div class="history-rating">
                    ${buildStarsHtml(rating)}
                </div>
            `;
            historyListEl.appendChild(card);
        });
    }

    function renderDueDatesFromUserData() {
        if (!dueDatesGridEl) return;
        const list = userData && Array.isArray(userData.due) ? userData.due : [];

        dueDatesGridEl.innerHTML = '';

        if (!list.length) {
            dueDatesGridEl.innerHTML = '<div class="empty-state" style="text-align:center; padding: 24px; color: var(--text-gray);"><i class="fas fa-clock" style="margin-right: 8px;"></i>No upcoming due dates.</div>';
            return;
        }

        list.forEach(entry => {
            const days = typeof entry.daysRemaining === 'number' ? entry.daysRemaining : 0;
            const title = entry.bookTitle || 'Untitled';
            const author = entry.author || 'Unknown author';

            const adminBook = findAdminBookByTitle(title);
            const imageUrl = (adminBook && adminBook.imageUrl) || entry.coverUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=300';

            let cardClass = 'urgency-card';
            if (days <= 2) cardClass += ' overdue';
            else if (days <= 5) cardClass += ' urgent';

            const progress = typeof entry.progress === 'number' ? entry.progress : Math.max(10, Math.min(100, 100 - days * 10));

            const card = document.createElement('div');
            card.className = cardClass;
            card.dataset.id = entry.id || '';
            card.innerHTML = `
                <div class="urgency-header">
                    <div class="urgency-days">${days} Days</div>
                    <div class="urgency-label">Remaining</div>
                </div>
                <div class="urgency-book">
                    <img src="${imageUrl}" class="urgency-thumb" alt="Cover">
                    <div class="urgency-info">
                        <h4>${title}</h4>
                        <p>${author}</p>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%;"></div>
                </div>
                <div class="urgency-actions">
                    <button class="btn-primary-small">Renew Book</button>
                </div>
            `;
            dueDatesGridEl.appendChild(card);
        });
    }

    function renderWishlistFromUserData() {
        if (!wishlistGridEl) return;
        const list = userData && Array.isArray(userData.wishlist) ? userData.wishlist : [];

        wishlistGridEl.innerHTML = '';

        if (!list.length) {
            wishlistGridEl.innerHTML = '<div class="empty-state" style="text-align:center; padding: 24px; color: var(--text-gray);">Your wishlist is empty.</div>';
            return;
        }

        list.forEach(entry => {
            const title = entry.bookTitle || 'Untitled';
            const author = entry.author || 'Unknown author';
            const category = entry.category || 'General';
            const addedDate = entry.addedDate || '';

            const adminBook = findAdminBookByTitle(title);
            const imageUrl = (adminBook && adminBook.imageUrl) || entry.coverUrl || 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=300';

            const card = document.createElement('div');
            card.className = 'wishlist-card';
            card.dataset.id = entry.id || '';
            card.innerHTML = `
                <img src="${imageUrl}" class="wishlist-thumb" alt="Cover">
                <div class="wishlist-info">
                    <h3>${title}</h3>
                    <span class="author">${author}</span>
                    <div class="wishlist-meta">
                        <span><i class="fas fa-tag"></i> ${category}</span>
                        <span><i class="fas fa-calendar-alt"></i> ${addedDate ? `Added: ${addedDate}` : ''}</span>
                    </div>
                </div>
                <div class="wishlist-actions">
                    <button class="btn-icon" title="Move to Reservations"><i class="fas fa-bookmark"></i></button>
                    <button class="btn-icon danger" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            `;
            wishlistGridEl.appendChild(card);
        });
    }

    function renderCatalogFromAdmin(filters = {}) {
        if (!catalogGrid) return;

        catalogGrid.innerHTML = '';

        // Apply filters
        let filteredBooks = adminBooks.slice();

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filteredBooks = filteredBooks.filter(book =>
                (book.title || '').toLowerCase().includes(searchLower) ||
                (book.author || '').toLowerCase().includes(searchLower) ||
                (book.category || '').toLowerCase().includes(searchLower)
            );
        }

        if (filters.category) {
            filteredBooks = filteredBooks.filter(book =>
                (book.category || '').toLowerCase() === filters.category.toLowerCase()
            );
        }

        if (filters.status) {
            filteredBooks = filteredBooks.filter(book =>
                (book.status || 'available') === filters.status
            );
        }

        // Show empty state if no books match
        if (!filteredBooks.length) {
            const message = adminBooks.length
                ? 'No books match your filters. Try adjusting your search.'
                : 'No books in the catalog yet. Check back soon!';
            catalogGrid.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-gray); grid-column: 1 / -1;">
                    <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>${message}</p>
                </div>
            `;
            return;
        }

        filteredBooks.forEach(book => {
            const title = book.title || 'Untitled';
            const author = book.author || 'Unknown author';
            const category = book.category || 'General';
            const status = (book.status || 'available').replace('_', ' ');
            const imageUrl = book.imageUrl || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800';

            const card = document.createElement('div');
            card.className = 'content-card';
            card.dataset.bookId = book.id;
            card.innerHTML = `
                <div class="card-image" style="background-image: url('${imageUrl}');"></div>
                <div class="card-body">
                    <span class="card-tag">${category}</span>
                    <h3 class="card-title">${title}</h3>
                    <div class="card-meta"><span>${author}</span><span>${status}</span></div>
                </div>
            `;
            catalogGrid.appendChild(card);
        });
    }

    // Apply admin-defined covers to existing cards across sections (if available)
    function applyAdminBookVisuals() {
        if (!adminBooks.length) return;

        // Catalog & home content cards
        document.querySelectorAll('.content-card').forEach(card => {
            const titleEl = card.querySelector('.card-title');
            const imgDiv = card.querySelector('.card-image');
            if (!titleEl || !imgDiv) return;
            const adminBook = findAdminBookByTitle(titleEl.innerText.trim());
            if (adminBook && adminBook.imageUrl) {
                imgDiv.style.backgroundImage = `url("${adminBook.imageUrl}")`;
            }
        });

        // Due dates (urgency cards)
        document.querySelectorAll('.urgency-card').forEach(card => {
            const titleEl = card.querySelector('.urgency-info h4');
            const imgEl = card.querySelector('.urgency-thumb');
            if (!titleEl || !imgEl) return;
            const adminBook = findAdminBookByTitle(titleEl.innerText.trim());
            if (adminBook && adminBook.imageUrl) {
                imgEl.src = adminBook.imageUrl;
            }
        });

        // Wishlist cards
        document.querySelectorAll('.wishlist-card').forEach(card => {
            const titleEl = card.querySelector('.wishlist-info h3');
            const imgEl = card.querySelector('.wishlist-thumb');
            if (!titleEl || !imgEl) return;
            const adminBook = findAdminBookByTitle(titleEl.innerText.trim());
            if (adminBook && adminBook.imageUrl) {
                imgEl.src = adminBook.imageUrl;
            }
        });

        // History cards
        document.querySelectorAll('.history-card').forEach(card => {
            const titleEl = card.querySelector('.history-title');
            const imgEl = card.querySelector('.history-thumb');
            if (!titleEl || !imgEl) return;
            const adminBook = findAdminBookByTitle(titleEl.innerText.trim());
            if (adminBook && adminBook.imageUrl) {
                imgEl.src = adminBook.imageUrl;
            }
        });
    }

    // Update home section stats from user data
    function updateHomeStats() {
        // Get stat elements
        const statCards = document.querySelectorAll('#home-section .stat-card');
        if (!statCards.length) return;

        // Calculate stats from user data
        const booksRead = userData && Array.isArray(userData.history) ? userData.history.length : 0;
        const dueSoon = userData && Array.isArray(userData.due) ? userData.due.length : 0;
        const reserved = reservations.length;

        // Update stat cards in order: Books Read, Due Soon, Reserved
        const statValues = [booksRead, dueSoon, reserved];

        statCards.forEach((card, index) => {
            const valueEl = card.querySelector('.stat-details h3');
            const labelEl = card.querySelector('.stat-details p');
            if (valueEl && index < statValues.length) {
                valueEl.innerText = statValues[index];
            }
        });

        // Update welcome banner message
        const bannerP = document.querySelector('.welcome-banner .banner-text p');
        if (bannerP) {
            if (dueSoon === 0) {
                bannerP.innerText = "You have no books due. Happy reading!";
            } else if (dueSoon === 1) {
                bannerP.innerText = "You have 1 book due soon. Happy reading!";
            } else {
                bannerP.innerText = `You have ${dueSoon} books due this week. Happy reading!`;
            }
        }
    }

    // Initial Render (local data, before API sync)
    renderHomeContinueFromAdmin();
    renderCatalogFromAdmin();
    renderHistoryFromUserData();
    renderDueDatesFromUserData();
    renderWishlistFromUserData();
    applyAdminBookVisuals();
    renderReservations();
    updateHomeStats();
    updateStatsSection();
    updateSectionHeroStats();
    renderForYouFromData();

    // --- CATALOG FILTER CONTROLS ---
    const filterBtn = document.getElementById('catalog-filter-btn');
    const filterDropdown = document.getElementById('filter-dropdown');
    const categoryFilter = document.getElementById('category-filter');
    const statusFilter = document.getElementById('status-filter');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const catalogSearch = document.getElementById('catalog-search');

    // Populate category filter from admin books
    function populateCategoryFilter() {
        if (!categoryFilter) return;
        const categories = new Set();
        adminBooks.forEach(book => {
            if (book.category) categories.add(book.category);
        });
        // Also add from admin_categories
        const storedCategories = loadCategories();
        storedCategories.forEach(cat => categories.add(cat));

        // Clear existing options except first
        while (categoryFilter.options.length > 1) {
            categoryFilter.remove(1);
        }

        Array.from(categories).sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categoryFilter.appendChild(option);
        });
    }

    // Toggle filter dropdown
    if (filterBtn && filterDropdown) {
        filterBtn.addEventListener('click', () => {
            const isVisible = filterDropdown.style.display !== 'none';
            filterDropdown.style.display = isVisible ? 'none' : 'flex';
            filterBtn.classList.toggle('active', !isVisible);
            if (!isVisible) {
                populateCategoryFilter();
            }
        });
    }

    // Apply filters
    function applyFilters() {
        const filters = {
            search: catalogSearch ? catalogSearch.value.trim() : '',
            category: categoryFilter ? categoryFilter.value : '',
            status: statusFilter ? statusFilter.value : ''
        };
        renderCatalogFromAdmin(filters);
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (catalogSearch) catalogSearch.value = '';
            if (categoryFilter) categoryFilter.value = '';
            if (statusFilter) statusFilter.value = '';
            renderCatalogFromAdmin();
        });
    }

    // Search on enter key
    if (catalogSearch) {
        catalogSearch.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                applyFilters();
            }
        });
        // Also search on input with debounce
        let searchTimeout;
        catalogSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(applyFilters, 300);
        });
    }

    // --- PDF DOWNLOAD FUNCTIONALITY ---
    // Store original button styles for reset
    const originalBtnDownloadBg = btnDownload ? window.getComputedStyle(btnDownload).background : '';
    const originalBtnDownloadColor = btnDownload ? window.getComputedStyle(btnDownload).color : '';

    function highlightDownloadButton(success) {
        if (!btnDownload) return;

        // Apply success (green) or failure (red) highlight
        if (success) {
            btnDownload.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
            btnDownload.style.color = 'white';
            btnDownload.innerHTML = '<i class="fas fa-check-circle"></i> Download Started!';
        } else {
            btnDownload.style.background = 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)';
            btnDownload.style.color = 'white';
            btnDownload.innerHTML = '<i class="fas fa-times-circle"></i> No Copy Available';
        }

        // Reset button after 3 seconds
        setTimeout(() => {
            btnDownload.style.background = '';
            btnDownload.style.color = '';
            btnDownload.innerHTML = '<i class="fas fa-file-pdf"></i> Download PDF';
        }, 3000);
    }

    function showDownloadFeedback(message, success) {
        // Highlight the download button
        highlightDownloadButton(success);

        // Also show feedback message
        if (actionFeedback) {
            actionFeedback.style.display = 'block';
            actionFeedback.style.background = success
                ? 'rgba(46, 204, 113, 0.2)'
                : 'rgba(231, 76, 60, 0.2)';
            actionFeedback.style.color = success ? '#2ecc71' : '#e74c3c';
            actionFeedback.style.border = success
                ? '1px solid rgba(46, 204, 113, 0.3)'
                : '1px solid rgba(231, 76, 60, 0.3)';
            actionFeedback.innerHTML = `<i class="fas ${success ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${message}`;

            // Hide after 3 seconds
            setTimeout(() => {
                actionFeedback.style.display = 'none';
            }, 3000);
        }
    }

    // Modal favorite button (wishlist)
    if (modalFavoriteBtn) {
        const triggerFavoriteAnimation = (button) => {
            if (!button) return;
            // Restart animation if it's already applied
            button.classList.remove('btn-click-anim');
            // Force reflow to allow re-adding the class
            void button.offsetWidth;
            button.classList.add('btn-click-anim');
            setTimeout(() => {
                button.classList.remove('btn-click-anim');
            }, 250);
        };

        const handleModalFavoriteClick = async (event) => {
            const clickedButton = event.currentTarget;

            if (!currentBookId) {
                showActionFeedback('No book selected', 'error');
                return;
            }
            if (!currentUser || !currentUser.id) {
                showActionFeedback('Please log in to use favorites', 'error');
                return;
            }

            const ok = await toggleWishlist(currentBookId);
            if (!ok) return;

            const inFav = isInWishlist(currentBookId);
            if (inFav) modalFavoriteBtn.classList.add('active');
            else modalFavoriteBtn.classList.remove('active');

            triggerFavoriteAnimation(clickedButton);
        };

        modalFavoriteBtn.addEventListener('click', handleModalFavoriteClick);
    }

    // Modal borrower info button (shows who currently has the book)
    if (modalBorrowerBtn && reservationDetails && reservationList) {
        modalBorrowerBtn.addEventListener('click', async () => {
            if (!currentAdminBook || !currentAdminBook.id) {
                showActionFeedback('No book selected', 'error');
                return;
            }

            // Toggle off if already active
            if (modalBorrowerBtn.classList.contains('active') && reservationDetails.classList.contains('active')) {
                modalBorrowerBtn.classList.remove('active');
                reservationDetails.classList.remove('active');
                reservationList.innerHTML = '';
                return;
            }

            modalBorrowerBtn.classList.add('active');

            // Update header copy for borrower context
            const headerEl = reservationDetails.querySelector('.reservation-header span:first-child');
            const subHeaderEl = reservationDetails.querySelector('.reservation-header span:nth-child(2)');
            if (headerEl) headerEl.textContent = 'Current Borrowers';
            if (subHeaderEl) subHeaderEl.innerHTML = '<i class="fas fa-user"></i> Borrower & contact status';

            // Show loading state
            reservationList.innerHTML = `
                <div class="user-card">
                    <div class="user-info-group">
                        <span class="user-name">Loading borrower information...</span>
                    </div>
                </div>
            `;
            reservationDetails.classList.add('active');

            try {
                const resp = await fetch(`${API_BASE}/borrow?action=bookBorrowers&bookId=${currentAdminBook.id}`);
                const result = await resp.json();

                if (!result.success || !Array.isArray(result.data) || !result.data.length) {
                    reservationList.innerHTML = `
                        <div class="user-card">
                            <div class="user-info-group">
                                <span class="user-name">No active borrows for this book.</span>
                            </div>
                        </div>
                    `;
                    return;
                }

                const borrowers = result.data;
                reservationList.innerHTML = '';

                for (const borrower of borrowers) {
                    let isOverdue = !!borrower.overdue;

                    // Also compute overdue status on the client using local date,
                    // to avoid timezone issues where the backend day may still be "yesterday".
                    if (!isOverdue && borrower.dueDate) {
                        try {
                            const due = new Date(borrower.dueDate);
                            const today = new Date();
                            due.setHours(0, 0, 0, 0);
                            today.setHours(0, 0, 0, 0);
                            if (due < today) {
                                isOverdue = true;
                            }
                        } catch (e) {
                            // If parsing fails, fall back to server-provided overdue flag only
                        }
                    }

                    const dueLabel = borrower.dueDate ? formatDate(borrower.dueDate) : 'N/A';

                    let contactHtml = '';

                    // Only expose contact number when the borrow is overdue
                    if (isOverdue && borrower.userId) {
                        try {
                            const profileResp = await fetch(`${API_BASE}/profile?userId=${borrower.userId}`);
                            const profileResult = await profileResp.json();
                            const phone = profileResult && profileResult.success && profileResult.data ? profileResult.data.phone : null;
                            if (phone) {
                                contactHtml = `
                                    <div class="user-contact">
                                        <span class="contact-number">${phone}</span>
                                        <button class="btn-contact" type="button"><i class="fas fa-phone"></i> Contact</button>
                                    </div>
                                `;
                            }
                        } catch (e) {
                            // If profile lookup fails, just omit contact details
                        }
                    }

                    const card = document.createElement('div');
                    card.className = `user-card ${isOverdue ? 'overdue' : ''}`;
                    if (borrower.userId) {
                        card.dataset.userId = borrower.userId;
                    }
                    card.innerHTML = `
                        <div class="user-info-group">
                            <span class="user-name">${borrower.userName || ('User #' + borrower.userId)}</span>
                            <span class="user-date">Due: ${dueLabel}${isOverdue ? ' • Overdue' : ''}</span>
                        </div>
                        ${contactHtml}
                    `;
                    reservationList.appendChild(card);
                }
            } catch (e) {
                reservationList.innerHTML = `
                    <div class="user-card">
                        <div class="user-info-group">
                            <span class="user-name">Unable to load borrower information right now.</span>
                        </div>
                    </div>
                `;
            }
        });
    }

    // --- EVENT DELEGATION FOR DYNAMIC CONTENT ---
    document.addEventListener('click', async (e) => {

        // 0. Contact button in borrower list (send in-app nudge notification)
        const contactBtn = e.target.closest('.btn-contact');
        if (contactBtn) {
            if (!currentUser || !currentUser.id) {
                showActionFeedback('Please log in to contact other readers', 'error');
                return;
            }

            if (!currentAdminBook || !currentAdminBook.id) {
                showActionFeedback('No book selected', 'error');
                return;
            }

            const contactCard = contactBtn.closest('.user-card');
            if (!contactCard || !contactCard.dataset.userId) {
                showActionFeedback('Unable to identify borrower for this book', 'error');
                return;
            }

            const targetUserId = parseInt(contactCard.dataset.userId, 10);
            if (!targetUserId || targetUserId === currentUser.id) {
                showActionFeedback('You cannot send a reminder to yourself', 'error');
                return;
            }

            const borrowerNameEl = contactCard.querySelector('.user-name');
            const borrowerName = borrowerNameEl ? borrowerNameEl.textContent.trim() : 'this borrower';
            const bookTitleForMessage = (modalTitle && modalTitle.textContent)
                ? modalTitle.textContent.trim()
                : (currentBookTitle || 'this book');

            try {
                const response = await fetch(`${API_BASE}/notifications?action=borrowerNudge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetUserId: targetUserId,
                        requesterUserId: currentUser.id,
                        bookId: currentAdminBook.id,
                        bookTitle: bookTitleForMessage
                    })
                });

                const result = await response.json();
                if (result && result.success) {
                    showActionFeedback(`We will remind ${borrowerName} to return "${bookTitleForMessage}" soon.`, 'success');
                } else {
                    const msg = (result && result.message) ? result.message : 'Unable to send reminder right now';
                    showActionFeedback(msg, 'error');
                }
            } catch (err) {
                showActionFeedback('Unable to send reminder right now', 'error');
            }

            return;
        }

        // 1. Handle Book Card Clicks (Open Modal)
        const inWishlistActions = e.target.closest('.wishlist-actions');
        const card = inWishlistActions
            ? null
            : e.target.closest('.content-card, .urgency-card, .ticket-card, .history-card, .wishlist-card');
        if (card) {
            // Reset State - with null checks
            if (reservationDetails) reservationDetails.classList.remove('active');
            if (actionFeedback) actionFeedback.style.display = 'none';


            // Reset reservation-specific context by default
            currentReservationId = null;
            if (reservationSummary) {
                reservationSummary.style.display = 'none';
            }
            if (reservationPrimaryAction) {
                reservationPrimaryAction.style.display = 'none';
                reservationPrimaryAction.style.background = '';
                reservationPrimaryAction.style.color = '';
                reservationPrimaryAction.innerHTML = '';
            }

            // Extract Data from Card
            let title, author, tag, image;

            if (card.classList.contains('content-card')) {
                title = card.querySelector('.card-title').innerText;
                author = card.querySelector('.card-meta span:first-child').innerText;
                tag = card.querySelector('.card-tag').innerText;
                image = card.querySelector('.card-image').style.backgroundImage.slice(5, -2).replace(/"/g, "");

                const adminBook = findAdminBookByTitle(title);
                if (adminBook) {
                    if (adminBook.imageUrl) {
                        image = adminBook.imageUrl;
                        card.querySelector('.card-image').style.backgroundImage = `url("${adminBook.imageUrl}")`;
                    }
                    currentBookId = adminBook.id;
                } else {
                    currentBookId = null;
                }
            } else if (card.classList.contains('urgency-card')) {
                title = card.querySelector('.urgency-info h4').innerText;
                author = card.querySelector('.urgency-info p').innerText;
                tag = "Due Soon";
                image = card.querySelector('.urgency-thumb').src;

                const adminBook = findAdminBookByTitle(title);
                if (adminBook) {
                    if (adminBook.imageUrl) {
                        image = adminBook.imageUrl;
                        card.querySelector('.urgency-thumb').src = adminBook.imageUrl;
                    }
                    currentBookId = adminBook.id;
                } else {
                    currentBookId = null;
                }
            } else if (card.classList.contains('ticket-card')) {
                title = card.querySelector('.ticket-info h3').innerText;
                author = card.querySelector('.ticket-info p').innerText;
                tag = "Reserved";
                image = card.querySelector('.ticket-thumb').src;

                // Enrich modal with reservation-specific information
                const id = parseInt(card.dataset.id, 10);
                const reservation = reservations.find(r => r.id === id);
                currentReservationId = reservation ? reservation.id : null;

                if (reservation && reservationSummary && reservationStatusChip && reservationQueueLabel && reservationWait) {
                    // Status chip text and basic coloring based on reservation status
                    reservationStatusChip.innerText = reservation.status;

                    if (reservation.status === 'Ready') {
                        reservationStatusChip.style.background = 'rgba(46, 204, 113, 0.2)';
                        reservationStatusChip.style.color = '#2ecc71';
                    } else if (reservation.status === 'In Transit') {
                        reservationStatusChip.style.background = 'rgba(52, 152, 219, 0.2)';
                        reservationStatusChip.style.color = '#3498db';
                    } else {
                        // Pending / default
                        reservationStatusChip.style.background = 'rgba(241, 196, 15, 0.2)';
                        reservationStatusChip.style.color = '#f1c40f';
                    }

                    // Queue label and wait time
                    if (reservation.status === 'Ready') {
                        reservationQueueLabel.innerText = 'Ready for pickup';
                        reservationWait.innerText = reservation.waitTime || 'Ready for pickup';
                    } else {
                        const position = typeof reservation.queuePosition === 'number' ? reservation.queuePosition : null;
                        if (position && position > 0) {
                            reservationQueueLabel.innerText = `You are #${position} in line`;
                        } else {
                            reservationQueueLabel.innerText = 'In reservation queue';
                        }

                        reservationWait.innerText = reservation.waitTime ? `Estimated wait: ${reservation.waitTime}` : 'Estimated wait: TBD';
                    }

                    if (reservationPrimaryAction) {
                        reservationPrimaryAction.style.display = 'inline-flex';
                        if (reservation.status === 'Ready') {
                            reservationPrimaryAction.innerHTML = '<i class="fas fa-info-circle"></i> View Pickup Instructions';
                            reservationPrimaryAction.style.background = 'rgba(46, 204, 113, 0.2)';
                            reservationPrimaryAction.style.color = '#2ecc71';
                        } else {
                            reservationPrimaryAction.innerHTML = '<i class="fas fa-times-circle"></i> Cancel Reservation';
                            reservationPrimaryAction.style.background = 'rgba(231, 76, 60, 0.2)';
                            reservationPrimaryAction.style.color = '#e74c3c';
                        }
                    }

                    reservationSummary.style.display = 'block';
                }
            } else if (card.classList.contains('history-card')) {
                title = card.querySelector('.history-title').innerText;
                author = card.querySelector('.history-author').innerText;
                tag = "History";
                image = card.querySelector('.history-thumb').src;

                const adminBook = findAdminBookByTitle(title);
                if (adminBook) {
                    if (adminBook.imageUrl) {
                        image = adminBook.imageUrl;
                        card.querySelector('.history-thumb').src = adminBook.imageUrl;
                    }
                    currentBookId = adminBook.id;
                } else {
                    currentBookId = null;
                }
            } else if (card.classList.contains('wishlist-card')) {
                const titleEl = card.querySelector('.wishlist-info h3');
                const authorEl = card.querySelector('.wishlist-info .author');
                const imgEl = card.querySelector('.wishlist-thumb');

                title = titleEl ? titleEl.innerText : 'Untitled';
                author = authorEl ? authorEl.innerText : 'Unknown author';
                tag = "Wishlist";
                image = imgEl ? imgEl.src : '';

                const adminBook = findAdminBookByTitle(title);
                if (adminBook) {
                    if (adminBook.imageUrl && imgEl) {
                        image = adminBook.imageUrl;
                        imgEl.src = adminBook.imageUrl;
                    }
                    currentBookId = adminBook.id;
                } else {
                    currentBookId = null;
                }
            }

            // Populate Modal
            currentBookTitle = title;
            // Use already loaded adminBooks (don't reload synchronously - it's async now)
            currentAdminBook = findAdminBookByTitle(title);

            // Fallback: if we have an admin book but currentBookId wasn't set above, set it here
            if (!currentBookId && currentAdminBook && currentAdminBook.id) {
                currentBookId = currentAdminBook.id;
            }
            modalTitle.innerText = title;

            modalAuthor.innerText = author;
            modalTag.innerText = tag;
            modalCover.src = image;

            // Update modal favorite UI
            if (modalFavoriteBtn) {
                const inFav = currentBookId ? isInWishlist(currentBookId) : false;
                if (inFav) modalFavoriteBtn.classList.add('active');
                else modalFavoriteBtn.classList.remove('active');
            }

            const fallback = bookData[title];
            const descText = (currentAdminBook && currentAdminBook.description)
                ? currentAdminBook.description
                : (fallback ? fallback.desc : "No description available for this title.");
            modalDesc.innerText = descText;

            // Load and display rating summary for this book
            if (currentBookId) {
                loadBookRatingSummary(currentBookId);
            } else if (currentAdminBook && currentAdminBook.id) {
                loadBookRatingSummary(currentAdminBook.id);
            } else {
                loadBookRatingSummary(null);
            }

            // Update button states based on book status and user relationship
            updateModalButtonStates(currentAdminBook);

            // Always clear any previously selected reservation date when opening
            const reservationDateInput = document.getElementById('reservation-date-input');
            if (reservationDateInput) {
                reservationDateInput.value = '';
            }

            // Show Modal
            modal.classList.add('active');
        }

        // 2. Handle Renew Button (Due Dates)
        if (e.target.innerText === 'Renew Book' && e.target.classList.contains('btn-primary-small')) {
            const btn = e.target;
            const card = btn.closest('.urgency-card');
            if (!card) return;
            const id = card.dataset.id;

            if (userData && Array.isArray(userData.due)) {
                const entry = userData.due.find(item => String(item.id) === String(id));
                if (entry) {
                    const currentDays = typeof entry.daysRemaining === 'number' ? entry.daysRemaining : 0;
                    entry.daysRemaining = currentDays + 7;
                    saveUserDataForCurrentUser(userData);
                }
            }

            renderDueDatesFromUserData();
        }

        // 3. Handle Cancel Reservation (Reservations)
        if (e.target.innerText === 'Cancel' && e.target.classList.contains('btn-primary-small')) {
            if (confirm('Are you sure you want to cancel this reservation?')) {
                const card = e.target.closest('.ticket-card');
                if (!card) return;
                const id = card.dataset.id;
                cancelReservationById(id);
            }
        }

        // 3b. Handle Pick Up Reservation (Reservations)
        if (e.target.classList.contains('pickup-btn')) {
            const card = e.target.closest('.ticket-card');
            if (!card) return;
            const id = card.dataset.id;
            pickupReservationById(id);
        }

        // 4. Handle Wishlist Actions
        if (e.target.closest('.wishlist-actions')) {
            const btn = e.target.closest('.btn-icon');
            if (!btn) return;

            const card = btn.closest('.wishlist-card');
            if (!card) return;

            const apiBookId = card.dataset.bookId;
            const title = card.querySelector('.wishlist-info h3').innerText;

            // API-backed favorites (dashboard wishlist section)
            if (apiBookId) {
                const numericId = parseInt(apiBookId, 10) || apiBookId;

                if (btn.classList.contains('danger')) {
                    // Remove from server-side wishlist via favorites API
                    toggleWishlist(numericId);
                    // toggleWishlist will reload userWishlist and re-render wishlist + profile favorites
                }
                return;
            }

            // Legacy local wishlist based on userData
            const id = card.dataset.id;

            if (btn.classList.contains('danger')) {
                if (confirm('Remove this book from your wishlist?')) {
                    if (userData && Array.isArray(userData.wishlist)) {
                        userData.wishlist = userData.wishlist.filter(item => {
                            if (item.id && id) return String(item.id) !== String(id);
                            return (item.bookTitle || '') !== title;
                        });
                        saveUserDataForCurrentUser(userData);
                    }
                    renderWishlistFromUserData();
                }
            } else {
                const originalIcon = btn.innerHTML;
                const adminBook = findAdminBookByTitle(title);
                if (adminBook) {
                    const result = createReservationForAdminBook(adminBook, title);
                    if (result) {
                        actionFeedback.className = 'action-feedback success';
                        actionFeedback.innerText = `"${result.bookTitle}" moved to reservations! You are #${result.queue} in line.`;
                        actionFeedback.style.display = 'block';
                    }
                }

                if (userData && Array.isArray(userData.wishlist)) {
                    userData.wishlist = userData.wishlist.filter(item => {
                        if (item.id && id) return String(item.id) !== String(id);
                        return (item.bookTitle || '') !== title;
                    });
                    saveUserDataForCurrentUser(userData);
                }
                renderWishlistFromUserData();

                setTimeout(() => {
                    btn.innerHTML = originalIcon;
                    btn.style.background = '';
                    btn.style.color = '';
                    actionFeedback.style.display = 'none';
                }, 3000);
            }
        }
    });

    function createReservationForAdminBook(adminBook, fallbackTitle) {
        if (!adminBook) return null;

        let userObj = null;
        try {
            const storedUser = sessionStorage.getItem('currentUser');
            userObj = storedUser ? JSON.parse(storedUser) : null;
        } catch (e) {
            userObj = null;
        }

        const bookId = adminBook.id || null;
        const bookTitle = adminBook.title || fallbackTitle || 'Unknown';
        const userId = userObj && userObj.id ? userObj.id : null;
        const userName = userObj && (userObj.fullName || userObj.username)
            ? (userObj.fullName || userObj.username)
            : 'You';

        const today = new Date().toISOString().slice(0, 10);
        const existingForBook = adminReservations.filter(r => r.bookId === bookId && (r.status === 'pending' || r.status === 'ready' || r.status === 'in_transit'));
        const queue = existingForBook.length + 1;

        const newReservation = {
            id: generateReservationId(),
            bookId: bookId,
            bookTitle: bookTitle,
            userId: userId,
            userName: userName,
            status: 'pending',
            date: today,
            queue: queue,
            eta: ''
        };

        adminReservations.push(newReservation);
        saveJSON('admin_reservations', adminReservations);
        usingAdminReservations = true;
        reservations = buildUserReservationsFromAdmin();
        renderReservations();

        return { bookTitle: bookTitle, queue: queue };
    }

    // ===== BORROW BUTTON HANDLER =====
    const btnBorrowEl = document.getElementById('btn-borrow');
    if (btnBorrowEl) {
        btnBorrowEl.addEventListener('click', async () => {
            if (btnBorrowEl.classList.contains('disabled')) return;

            if (!currentAdminBook) {
                showActionFeedback('No book selected', 'error');
                return;
            }

            const success = await borrowBook(currentAdminBook);
            if (success) {
                // Refresh book data and update button states
                adminBooks = await loadAdminBooks();
                currentAdminBook = findAdminBookByTitle(currentBookTitle);
                updateModalButtonStates(currentAdminBook);
            }
        });
    }

    // ===== RETURN BUTTON HANDLER =====
    const btnReturnEl = document.getElementById('btn-return');
    if (btnReturnEl) {
        btnReturnEl.addEventListener('click', async () => {
            if (!currentAdminBook) {
                showActionFeedback('No book selected', 'error');
                return;
            }

            const success = await returnBook(currentAdminBook.id);
            if (success) {
                // Refresh book data and update button states
                adminBooks = await loadAdminBooks();
                currentAdminBook = findAdminBookByTitle(currentBookTitle);
                updateModalButtonStates(currentAdminBook);
            }
        });
    }

    // ===== RENEW BUTTON HANDLER =====
    const btnRenewEl = document.getElementById('btn-renew');
    if (btnRenewEl) {
        btnRenewEl.addEventListener('click', async () => {
            if (btnRenewEl.classList.contains('disabled')) return;

            if (!currentAdminBook) {
                showActionFeedback('No book selected', 'error');
                return;
            }

            const success = await renewBook(currentAdminBook.id);
            if (success) {
                // Update modal display
                updateModalButtonStates(currentAdminBook);
            }
        });
    }

    // ===== RESERVE BUTTON HANDLER (with date picker) =====
    const btnReserveBookEl = document.getElementById('btn-reserve-book');
    if (btnReserveBookEl) {
        btnReserveBookEl.addEventListener('click', () => {
            if (btnReserveBookEl.classList.contains('disabled')) return;

            const reservationDateSection = document.getElementById('reservation-date-section');
            const reservationDateInput = document.getElementById('reservation-date-input');
            const reservationConfirmActionsEl = document.getElementById('reservation-confirm-actions');

            if (reservationDateSection) {
                reservationDateSection.style.display = 'block';
            }
            if (reservationConfirmActionsEl) {
                reservationConfirmActionsEl.style.display = 'flex';
            }
            if (reservationDateInput && !reservationDateInput.value) {
                reservationDateInput.focus();
            }
        });
    }

    // Confirm reservation after user selects a date
    if (btnConfirmReservation) {
        btnConfirmReservation.addEventListener('click', async () => {
            const reservationDateSection = document.getElementById('reservation-date-section');
            const reservationDateInput = document.getElementById('reservation-date-input');
            const reservationConfirmActionsEl = document.getElementById('reservation-confirm-actions');

            if (!currentAdminBook) {
                showActionFeedback('No book selected', 'error');
                return;
            }

            if (!reservationDateInput || !reservationDateInput.value) {
                showActionFeedback('Please select a pickup date first', 'error');
                return;
            }

            const preferredDate = reservationDateInput.value;
            const result = await reserveBookWithDate(currentAdminBook, preferredDate);
            if (result) {
                if (reservationDetails) reservationDetails.classList.remove('active');
                if (reservationDateSection) reservationDateSection.style.display = 'none';
                if (reservationConfirmActionsEl) reservationConfirmActionsEl.style.display = 'none';
                reservationDateInput.value = '';
                updateModalButtonStates(currentAdminBook);
            }
        });
    }

    // Cancel reservation flow (close picker without reserving)
    if (btnCancelReservation) {
        btnCancelReservation.addEventListener('click', () => {
            const reservationDateSection = document.getElementById('reservation-date-section');
            const reservationDateInput = document.getElementById('reservation-date-input');
            const reservationConfirmActionsEl = document.getElementById('reservation-confirm-actions');

            if (reservationDateSection) reservationDateSection.style.display = 'none';
            if (reservationConfirmActionsEl) reservationConfirmActionsEl.style.display = 'none';
            if (reservationDateInput) reservationDateInput.value = '';
        });
    }

    // Legacy Reserve Button Logic (fallback for old btnReserve reference)
    // Only used if there's a separate legacy reserve button element
    if (btnReserve && btnReserve !== btnReserveBookEl) {
        btnReserve.addEventListener('click', async () => {
            if (currentAdminBook) {
                const reservationDateSection = document.getElementById('reservation-date-section');
                const reservationDateInput = document.getElementById('reservation-date-input');

                // First click: show the date picker
                if (reservationDateSection && reservationDateSection.style.display !== 'block') {
                    reservationDateSection.style.display = 'block';
                    if (reservationDateInput && !reservationDateInput.value) {
                        reservationDateInput.focus();
                    }
                    return;
                }

                if (!reservationDateInput || !reservationDateInput.value) {
                    showActionFeedback('Please select a pickup date first', 'error');
                    return;
                }

                // Use new reserve function with date, but confirm first
                const preferredDate = reservationDateInput.value;
                const prettyDate = formatDate(preferredDate);

                const confirmed = window.confirm(`Reserve "${currentAdminBook.title}" for pickup on ${prettyDate}?`);
                if (!confirmed) {
                    return;
                }

                const result = await reserveBookWithDate(currentAdminBook, preferredDate);
                if (result) {
                    if (reservationDetails) reservationDetails.classList.remove('active');
                    updateModalButtonStates(currentAdminBook);
                }
                return;
            }


            const data = bookData[currentBookTitle];

            if (!data) {
                actionFeedback.className = 'action-feedback success';
                actionFeedback.innerText = "Reservation placed successfully!";
                actionFeedback.style.display = 'block';
                return;
            }

            if (data.currentHolders.length > 0) {
                reservationList.innerHTML = '';
                data.currentHolders.forEach(user => {
                    const isOverdue = user.overdue;
                    const card = document.createElement('div');
                    card.className = `user-card ${isOverdue ? 'overdue' : ''}`;

                    let contactHtml = '';
                    if (isOverdue) {
                        contactHtml = `
                        <div class="user-contact">
                            <span class="contact-number">${user.phone}</span>
                            <button class="btn-contact"><i class="fas fa-phone"></i> Contact</button>
                        </div>
                    `;
                    }

                    card.innerHTML = `
                    <div class="user-info-group">
                        <span class="user-name">${user.name}</span>
                        <span class="user-date">Return: ${user.returnDate}</span>
                    </div>
                    ${contactHtml}
                `;
                    reservationList.appendChild(card);
                });
                reservationDetails.classList.add('active');

                actionFeedback.className = 'action-feedback info';
                actionFeedback.innerText = `There are ${data.currentHolders.length} users ahead of you.`;
                actionFeedback.style.display = 'block';
            } else {
                reservationDetails.classList.remove('active');
                actionFeedback.className = 'action-feedback success';
                actionFeedback.innerText = "Reservation placed successfully! You are next in line.";
                actionFeedback.style.display = 'block';
            }
        });
    }

    // Download Button Logic
    btnDownload.addEventListener('click', () => {
        // Check if there's a current book selected
        if (!currentAdminBook && !currentBookTitle) {
            showDownloadFeedback('No book selected', false);
            return;
        }

        // If admin defined a PDF URL for this title, trigger download
        if (currentAdminBook && currentAdminBook.pdfUrl && currentAdminBook.pdfUrl.trim()) {
            // Create download link
            const link = document.createElement('a');
            link.href = currentAdminBook.pdfUrl;
            link.download = (currentAdminBook.title || currentBookTitle || 'book') + '.pdf';
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showDownloadFeedback(`Downloading "${currentBookTitle}"...`, true);
            return;
        }

        // No PDF available - show failure state with "no copy" message
        showDownloadFeedback('No copy of this book available for download', false);
    });

    // Primary Reservation Action (Cancel / Pickup Info)
    if (reservationPrimaryAction) {
        reservationPrimaryAction.addEventListener('click', () => {
            if (!currentReservationId) return;

            const reservation = reservations.find(r => r.id === currentReservationId);
            if (!reservation) return;

            if (reservation.status === 'Ready') {
                actionFeedback.className = 'action-feedback info';
                actionFeedback.innerText = 'This book is ready for pickup at the main branch desk. Please bring your membership ID within 3 days.';
                actionFeedback.style.display = 'block';
            } else {
                if (!confirm('Are you sure you want to cancel this reservation?')) {
                    return;
                }

                cancelReservationById(reservation.id);

                actionFeedback.className = 'action-feedback success';
                actionFeedback.innerText = 'Reservation cancelled.';
                actionFeedback.style.display = 'block';

                reservationPrimaryAction.style.display = 'none';
                if (reservationSummary) {
                    reservationSummary.style.display = 'none';
                }

                modal.classList.remove('active');
            }
        });
    }

    // Close Modal
    modalClose.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Close on Outside Click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
    // --- STATS ANIMATION ---
    function animateStats() {
        // Animate Bars
        const bars = document.querySelectorAll('.bar');
        bars.forEach((bar, index) => {
            const height = bar.getAttribute('data-height');
            // Reset first
            bar.style.height = '0%';

            // Animate
            setTimeout(() => {
                bar.style.height = height;
            }, 300 + (index * 100));
        });

        // Animate Progress Ring
        const circle = document.querySelector('.progress-ring__circle');
        if (circle) {
            const radius = circle.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            const percent = typeof statsGoalPercent === 'number' ? statsGoalPercent : 0;
            const offset = circumference - (percent / 100) * circumference;

            // Reset
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            circle.style.strokeDashoffset = circumference;

            // Animate
            setTimeout(() => {
                circle.style.strokeDashoffset = offset;
            }, 500);
        }
    }

    // Initialize books from API
    initializeBooks();
});
