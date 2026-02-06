// Admin Dashboard - Database Integration
// Uses API endpoints instead of localStorage
const API_BASE = '/library/api';

document.addEventListener("DOMContentLoaded", async function () {
    // --- State (loaded from API) ---
    let books = [];
    let users = [];
    let reservations = [];
    let categories = [];

    // Cached admin-level stats
    let adminStatsUsers = null;
    let adminStatsHistory = null;

    // --- Helpers ---
    function uid(prefix) {
        return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    }

    function readFileAsDataURL(file) {
        return new Promise(function (resolve) {
            try {
                var reader = new FileReader();
                reader.onload = function (e) {
                    resolve(e && e.target && e.target.result ? e.target.result : "");
                };
                reader.onerror = function () { resolve(""); };
                reader.readAsDataURL(file);
            } catch (err) { resolve(""); }
        });
    }

    // --- API Functions ---
    async function loadBooks() {
        try {
            const response = await fetch(`${API_BASE}/books.php`);
            const text = await response.text();
            try {
                const result = JSON.parse(text);
                if (result.success && Array.isArray(result.data)) {
                    books = result.data.map(book => ({
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
                        ratingAverage: (function () {
                            if (typeof book.avg_rating === 'number') return book.avg_rating;
                            var parsed = parseFloat(book.avg_rating || '0');
                            return isNaN(parsed) ? 0 : parsed;
                        })(),
                        ratingCount: (function () {
                            if (typeof book.rating_count === 'number') return book.rating_count;
                            var parsed = parseInt(book.rating_count || '0', 10);
                            return isNaN(parsed) ? 0 : parsed;
                        })()
                    }));
                }
            } catch (parseErr) {
                console.error('Failed to parse books response:', text.substring(0, 200));
            }
        } catch (e) {
            console.error('Failed to load books:', e);
        }
    }

    async function loadUsers() {
        try {
            const response = await fetch(`${API_BASE}/users.php`);
            const text = await response.text();
            try {
                const result = JSON.parse(text);
                if (result.success && Array.isArray(result.data)) {
                    users = result.data.map(user => ({
                        id: user.id,
                        name: user.full_name || user.username,
                        email: user.email,
                        // Only two roles are used in this project: admin and user
                        role: user.role === 'admin' ? 'Admin' : 'User',
                        // Status comes directly from the API (active/limited/banned)
                        status: user.status || 'active',
                        booksThisMonth: user.stats?.borrowedCount || 0,
                        totalBooks: user.stats?.totalBooks || 0,
                        lastActivity: user.stats?.lastActivity || 'Never',
                        isReaderOfMonth: false,
                        history: []
                    }));

                    // Mark Reader of the Month based on total books read
                    markReaderOfMonth();
                }
            } catch (parseErr) {
                console.error('Failed to parse users response:', text.substring(0, 200));
            }
        } catch (e) {
            console.error('Failed to load users:', e);
        }
    }

    async function loadReservations() {
        try {
            // Get all user reservations - we need to iterate users
            reservations = [];
            for (const user of users) {
                const response = await fetch(`${API_BASE}/reserve.php?userId=${user.id}`);
                const result = await response.json();
                if (result.success && Array.isArray(result.data)) {
                    result.data.forEach(r => {
                        reservations.push({
                            id: r.id,
                            bookId: r.bookId,
                            bookTitle: r.book?.title || '',
                            userId: r.userId,
                            userName: user.name,
                            status: r.status,
                            queue: r.queuePosition,
                            eta: r.pickupDate,
                            date: r.pickupDate
                        });
                    });
                }
            }
        } catch (e) {
            console.error('Failed to load reservations:', e);
        }
    }

    async function loadBookBorrowers(bookId) {
        try {
            const response = await fetch(`${API_BASE}/borrow.php?action=bookBorrowers&bookId=${bookId}`);
            const result = await response.json();
            if (result && result.success && Array.isArray(result.data)) {
                return result.data.map(function (item) {
                    return {
                        id: item.id,
                        bookId: item.bookId,
                        userId: item.userId,
                        userName: item.userName || ('User #' + item.userId),
                        userEmail: item.userEmail || '',
                        borrowDate: item.borrowDate || null,
                        dueDate: item.dueDate || null,
                        renewalsLeft: typeof item.renewalsLeft === 'number' ? item.renewalsLeft : null,
                        overdue: !!item.overdue
                    };
                });
            }
        } catch (e) {
            console.error('Failed to load book borrowers:', e);
        }
        return [];
    }

    async function loadCategories() {
        // Extract unique categories from books
        categories = [...new Set(books.map(b => b.category).filter(Boolean))];
    }

    async function loadAdminStats() {
        try {
            const [usersRes, historyRes] = await Promise.all([
                fetch(`${API_BASE}/users.php?action=stats`),
                fetch(`${API_BASE}/history.php?action=adminStats`)
            ]);

            try {
                const usersJson = await usersRes.json();
                if (usersJson && usersJson.success) {
                    adminStatsUsers = usersJson.data || null;
                }
            } catch (e) {
                console.error('Failed to parse users stats response:', e);
            }

            try {
                const historyJson = await historyRes.json();
                if (historyJson && historyJson.success) {
                    adminStatsHistory = historyJson.data || null;
                }
            } catch (e) {
                console.error('Failed to parse history stats response:', e);
            }
        } catch (e) {
            console.error('Failed to load admin stats:', e);
        }
    }

    async function saveBook(bookData, bookId = null) {
        try {
            // Map UI status to backend availability flag
            var isAvailable = !bookData.status || bookData.status === 'available';

            const payload = {
                title: bookData.title,
                author: bookData.author,
                category: bookData.category,
                cover: bookData.imageUrl || bookData.cover || '',
                pdf: bookData.pdfUrl || bookData.pdf || '',
                description: bookData.description || '',
                copies: (function () {
                    var raw = typeof bookData.copies === 'number' ? bookData.copies : parseInt(bookData.copies || '1', 10);
                    if (!raw || isNaN(raw) || raw < 1) raw = 1;
                    return raw;
                })(),
                available: isAvailable ? 1 : 0
            };

            let response;
            if (bookId) {
                payload.id = bookId;
                response = await fetch(`${API_BASE}/books.php?id=${bookId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                response = await fetch(`${API_BASE}/books.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (parseErr) {
                console.error('Failed to parse save response:', text.substring(0, 200));
                return { success: false, message: 'Server returned invalid response' };
            }
        } catch (e) {
            console.error('Failed to save book:', e);
            return { success: false, message: e.message };
        }
    }

    async function deleteBook(bookId) {
        try {
            const response = await fetch(`${API_BASE}/books.php?id=${bookId}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    async function saveUser(userData, userId = null) {
        try {
            const apiRole = userData.role === 'Admin' ? 'admin' : 'user';

            if (userId) {
                // Update existing user, including status
                const payload = {
                    full_name: userData.name,
                    email: userData.email,
                    role: apiRole,
                    status: userData.status || 'active'
                };
                const response = await fetch(`${API_BASE}/users.php?id=${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                return await response.json();
            } else {
                // Create new user via register endpoint (role only)
                const registerResponse = await fetch(`${API_BASE}/register.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: userData.email.split('@')[0],
                        email: userData.email,
                        password: 'temp123456',
                        fullName: userData.name,
                        role: apiRole
                    })
                });
                const registerResult = await registerResponse.json();

                // If a non-active status was chosen, apply it via a follow-up update
                if (registerResult.success && userData.status && userData.status !== 'active') {
                    try {
                        const newId = registerResult.user && registerResult.user.id;
                        if (newId) {
                            await fetch(`${API_BASE}/users.php?id=${newId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: userData.status })
                            });
                        }
                    } catch (err) {
                        console.error('Failed to update new user status:', err);
                    }
                }

                return registerResult;
            }
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    async function deleteUser(userId) {
        try {
            const response = await fetch(`${API_BASE}/users.php?id=${userId}`, {
                method: 'DELETE'
            });
            return await response.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    }

    async function cancelReservation(reservationId) {
        try {
            const response = await fetch(`${API_BASE}/reserve.php?action=cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservationId: reservationId })
            });
            return await response.json();
        } catch (e) {
            return { success: false, message: e.message };
        }
    }


    // --- DOM lookups ---
    var navItems = document.querySelectorAll(".admin-nav-item");
    var sections = document.querySelectorAll(".admin-section");
    var titleEl = document.getElementById("admin-section-title");
    var subtitleEl = document.getElementById("admin-section-subtitle");
    var avatarEl = document.getElementById("adminAvatar");
    var nameEl = document.getElementById("adminUserName");
    var logoutBtn = document.getElementById("adminLogout");
    var searchInputEl = document.querySelector('.admin-search input');

    var subtitles = {
        "admin-books": "Manage the catalog, availability, and inventory.",
        "admin-users": "Oversee member and staff accounts.",
        "admin-stats": "Monitor performance and usage patterns.",
        "admin-reservations": "Track reservations and queue health.",
        "admin-leaderboards": "See top readers and popular titles."
    };

    var currentSectionId = "admin-books";

    // --- Basic navigation & header ---
    navItems.forEach(function (item) {
        item.addEventListener("click", function () {
            var target = item.getAttribute("data-section");
            if (!target) return;

            navItems.forEach(function (btn) { btn.classList.remove("active"); });
            item.classList.add("active");

            currentSectionId = target;

            sections.forEach(function (section) {
                if (section.id === target) {
                    section.classList.add("active");
                } else {
                    section.classList.remove("active");
                }
            });

            var labelSpan = item.querySelector("span");
            if (labelSpan && titleEl) {
                titleEl.textContent = labelSpan.textContent;
            }
            if (subtitleEl && subtitles[target]) {
                subtitleEl.textContent = subtitles[target];
            }
        });
    });

    function filterBooksSection(term) {
        if (!booksTableBody) return;
        var rows = booksTableBody.querySelectorAll('tr');
        rows.forEach(function (row) {
            var cells = row.querySelectorAll('td');
            if (!cells.length) return;
            var text = (cells[0].textContent + ' ' + cells[1].textContent + ' ' + cells[2].textContent).toLowerCase();
            row.style.display = term && !text.includes(term) ? 'none' : '';
        });
    }

    function filterUsersSection(term) {
        if (!userCardsGrid) return;
        var cards = userCardsGrid.querySelectorAll('.user-card');
        cards.forEach(function (card) {
            var name = card.querySelector('.user-card-name')?.textContent.toLowerCase() || '';
            var meta = card.querySelector('.user-card-meta')?.textContent.toLowerCase() || '';
            var match = !term || name.includes(term) || meta.includes(term);
            card.style.display = match ? '' : 'none';
        });
    }

    function filterReservationsSection(term) {
        if (!reservationsTableBody) return;
        var rows = reservationsTableBody.querySelectorAll('tr');
        rows.forEach(function (row) {
            var cells = row.querySelectorAll('td');
            if (!cells.length) return;
            var text = Array.from(cells).map(function (c) { return c.textContent.toLowerCase(); }).join(' ');
            row.style.display = term && !text.includes(term) ? 'none' : '';
        });
    }

    if (searchInputEl) {
        searchInputEl.addEventListener('input', function () {
            var term = searchInputEl.value.trim().toLowerCase();

            if (currentSectionId === 'admin-books') {
                filterBooksSection(term);
            } else if (currentSectionId === 'admin-users') {
                filterUsersSection(term);
            } else if (currentSectionId === 'admin-reservations') {
                filterReservationsSection(term);
            }
        });
    }

    var stored = sessionStorage.getItem("currentUser");
    if (stored) {
        try {
            var user = JSON.parse(stored);
            if (nameEl && user.fullName) {
                nameEl.textContent = user.fullName;
            }
            if (avatarEl) {
                var base = user.fullName || user.username || "Admin";
                var initials = base.split(" ").filter(p => p.length > 0).map(p => p[0]).join("").toUpperCase().slice(0, 2);
                avatarEl.textContent = initials;
            }
        } catch (e) { }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            sessionStorage.removeItem("currentUser");
            window.location.href = "login.html";
        });
    }

    // --- BOOKS: CRUD & rendering ---
    var booksTableBody = document.getElementById("books-table-body");
    var bookModalOverlay = document.getElementById("book-editor-modal");
    var bookOpenModalBtn = document.getElementById("book-open-modal");
    var bookModalTitle = document.getElementById("book-modal-title");
    var bookForm = document.getElementById("book-form");
    var bookTitleInput = document.getElementById("book-title-input");
    var bookAuthorInput = document.getElementById("book-author-input");
    var bookCategoryInput = document.getElementById("book-category-input");
    var bookStatusInput = document.getElementById("book-status-input");
    var bookImageInput = document.getElementById("book-image-input");
    var bookPdfInput = document.getElementById("book-pdf-input");
    var bookCopiesInput = document.getElementById("book-copies-input");
    var bookDescriptionInput = document.getElementById("book-description-input");
    var bookSubmitBtn = document.getElementById("book-submit-btn");
    var bookCancelEditBtn = document.getElementById("book-cancel-edit-btn");

    var currentEditingBookId = null;

    function computeBookReservedCount(bookId) {
        return reservations.filter(r =>
            r.bookId == bookId && ['pending', 'ready', 'waiting', 'in_transit'].includes(r.status)
        ).length;
    }

    function renderBooks() {
        if (!booksTableBody) return;
        booksTableBody.innerHTML = "";

        if (books.length === 0) {
            booksTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-gray);padding:40px;">No books found</td></tr>';
            return;
        }

        books.forEach(function (book) {
            var reserved = computeBookReservedCount(book.id);
            var statusClass = "";
            if (book.status === "available") statusClass = "success";
            else if (book.status === "checked_out") statusClass = "warning";
            else if (book.status === "in_transit") statusClass = "info";
            else if (book.status === "overdue") statusClass = "muted";

            var copiesText = (typeof book.copies === 'number' && !isNaN(book.copies)) ? book.copies : (book.copies || '1');

            var ratingAvg = (typeof book.ratingAverage === 'number' && !isNaN(book.ratingAverage)) ? book.ratingAverage : 0;
            var ratingCount = (typeof book.ratingCount === 'number' && !isNaN(book.ratingCount)) ? book.ratingCount : 0;
            var reviewsLabel;
            if (ratingCount > 0) {
                reviewsLabel = '★ ' + ratingAvg.toFixed(1) + ' (' + ratingCount + ')';
            } else {
                reviewsLabel = '—';
            }

            var tr = document.createElement("tr");
            tr.innerHTML =
                "<td>" + book.title + "</td>" +
                "<td>" + book.author + "</td>" +
                "<td>" + book.category + "</td>" +
                '<td><span class="status-pill ' + statusClass + '">' + book.status.replace("_", " ") + "</span></td>" +
                "<td>" + copiesText + "</td>" +
                "<td>" + reserved + "</td>" +
                "<td>" + reviewsLabel + "</td>" +
                '<td><button class="book-calendar-toggle" type="button" data-book-id="' + book.id + '" data-book-title="' + book.title.replace(/"/g, '&quot;') + '"><i class="fas fa-calendar-alt"></i></button></td>' +
                '<td>' +
                '<button class="admin-table-icon-btn" type="button" data-action="edit-book" data-id="' + book.id + '"><i class="fas fa-pen"></i></button>' +
                '<button class="admin-table-icon-btn danger" type="button" data-action="delete-book" data-id="' + book.id + '"><i class="fas fa-trash"></i></button>' +
                "</td>";
            booksTableBody.appendChild(tr);
        });

        updateBookMetrics();
        populateReservationBookOptions();
        renderLeaderboards();
    }

    function updateBookMetrics() {
        var totalBooksEl = document.getElementById("metric-total-books");
        var checkedOutEl = document.getElementById("metric-books-checked-out");
        var overdueEl = document.getElementById("metric-books-overdue");

        var total = books.length;
        var checkedOut = books.filter(b => b.status === "checked_out").length;
        var overdue = books.filter(b => b.status === "overdue").length;

        if (totalBooksEl) totalBooksEl.textContent = String(total);
        if (checkedOutEl) checkedOutEl.textContent = String(checkedOut);
        if (overdueEl) overdueEl.textContent = String(overdue);
    }

    function populateCategoryDropdown(selectEl) {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="">Select category...</option>';
        categories.forEach(function (cat) {
            var opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            selectEl.appendChild(opt);
        });
        // Add common categories if not present
        ['Fiction', 'Non-Fiction', 'Sci-Fi', 'Fantasy', 'Mystery', 'Biography'].forEach(cat => {
            if (!categories.includes(cat)) {
                var opt = document.createElement('option');
                opt.value = cat;
                opt.innerText = cat;
                selectEl.appendChild(opt);
            }
        });
    }

    function openBookModal(mode, book) {
        if (!bookModalOverlay) return;
        populateCategoryDropdown(bookCategoryInput);
        if (mode === "edit" && book) {
            bookModalTitle.textContent = "Edit book";
            bookSubmitBtn.textContent = "Save changes";
            bookTitleInput.value = book.title || "";
            bookAuthorInput.value = book.author || "";
            bookCategoryInput.value = book.category || "";
            bookStatusInput.value = book.status || "available";
            if (bookDescriptionInput) bookDescriptionInput.value = book.description || "";
            if (bookCopiesInput) {
                var existingCopies = (typeof book.copies === 'number' && !isNaN(book.copies)) ? book.copies : parseInt(book.copies || '1', 10);
                if (!existingCopies || existingCopies < 1) existingCopies = 1;
                bookCopiesInput.value = existingCopies;
            }
        } else {
            bookModalTitle.textContent = "Add book";
            bookSubmitBtn.textContent = "Add book";
            bookForm.reset();
            if (bookCopiesInput) {
                bookCopiesInput.value = 1;
            }
        }
        bookModalOverlay.classList.add("active");
    }

    function closeBookModal() {
        if (!bookModalOverlay) return;
        bookModalOverlay.classList.remove("active");
        currentEditingBookId = null;
    }

    if (bookOpenModalBtn) {
        bookOpenModalBtn.addEventListener("click", function () {
            currentEditingBookId = null;
            openBookModal("add");
        });
    }

    if (bookModalOverlay) {
        bookModalOverlay.addEventListener("click", function (e) {
            if (e.target === bookModalOverlay) closeBookModal();
        });
    }

    var modalCloseButtons = document.querySelectorAll(".admin-modal-close");
    modalCloseButtons.forEach(function (btn) {
        btn.addEventListener("click", function () {
            var targetId = btn.getAttribute("data-close-modal");
            if (!targetId) return;
            var overlay = document.getElementById(targetId);
            if (overlay) overlay.classList.remove("active");
            if (targetId === "book-editor-modal") currentEditingBookId = null;
            if (targetId === "user-editor-modal") currentEditingUserId = null;
            if (targetId === "reservation-editor-modal") currentEditingReservationId = null;
        });
    });

    if (bookForm) {
        bookForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var title = bookTitleInput.value.trim();
            var author = bookAuthorInput.value.trim();
            var category = bookCategoryInput.value.trim();
            var description = bookDescriptionInput ? bookDescriptionInput.value.trim() : "";
            var status = bookStatusInput ? (bookStatusInput.value || 'available') : 'available';
            if (!title || !author || !category) return;

            var existing = currentEditingBookId ? books.find(b => b.id == currentEditingBookId) : null;

            var imageUrl = existing?.imageUrl || "";
            var pdfUrl = existing?.pdfUrl || "";

            if (bookImageInput?.files?.[0]) {
                imageUrl = await readFileAsDataURL(bookImageInput.files[0]);
            }
            if (bookPdfInput?.files?.[0]) {
                pdfUrl = await readFileAsDataURL(bookPdfInput.files[0]);
            }

            var copies = 1;
            if (bookCopiesInput && bookCopiesInput.value !== '') {
                var parsed = parseInt(bookCopiesInput.value, 10);
                if (!isNaN(parsed) && parsed > 0) {
                    copies = parsed;
                }
            }

            const bookData = { title, author, category, description, imageUrl, pdfUrl, status, copies };
            const result = await saveBook(bookData, currentEditingBookId);

            if (result.success) {
                await loadBooks();
                await loadCategories();
                renderBooks();
                closeBookModal();
            } else {
                alert(result.message || 'Failed to save book');
            }
        });
    }

    if (bookCancelEditBtn) {
        bookCancelEditBtn.addEventListener("click", closeBookModal);
    }

    // Category modal
    var categoryModalOverlay = document.getElementById('category-add-modal');
    var categoryForm = document.getElementById('category-form');
    var newCategoryInput = document.getElementById('new-category-input');
    var categoryCancelBtn = document.getElementById('category-cancel-btn');
    var addCategoryBtn = document.getElementById('add-category-btn');

    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (categoryModalOverlay) {
                if (newCategoryInput) newCategoryInput.value = '';
                categoryModalOverlay.classList.add('active');
            }
        });
    }

    if (categoryForm) {
        categoryForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var newCat = newCategoryInput ? newCategoryInput.value.trim() : '';
            if (newCat && !categories.includes(newCat)) {
                categories.push(newCat);
                populateCategoryDropdown(bookCategoryInput);
                bookCategoryInput.value = newCat;
            }
            if (categoryModalOverlay) categoryModalOverlay.classList.remove('active');
        });
    }

    if (categoryCancelBtn) {
        categoryCancelBtn.addEventListener('click', function () {
            if (categoryModalOverlay) categoryModalOverlay.classList.remove('active');
        });
    }

    if (booksTableBody) {
        booksTableBody.addEventListener("click", async function (e) {
            var btn = e.target.closest(".admin-table-icon-btn");
            if (!btn) return;
            var id = btn.getAttribute("data-id");
            var action = btn.getAttribute("data-action");
            if (!id || !action) return;

            if (action === "edit-book") {
                var book = books.find(b => b.id == id);
                if (!book) return;
                currentEditingBookId = book.id;
                openBookModal("edit", book);
            } else if (action === "delete-book") {
                if (!confirm("Delete this book?")) return;
                const result = await deleteBook(id);
                if (result.success) {
                    await loadBooks();
                    renderBooks();
                } else {
                    alert(result.message || 'Failed to delete book');
                }
            }
        });
    }

    // --- Calendar panel for book reservations ---
    var booksSection = document.getElementById("admin-books");
    var calendarPanel = document.getElementById("book-calendar-panel");
    var calendarBookTitle = document.getElementById("calendar-book-title");
    var calendarBookSubtitle = document.getElementById("calendar-book-subtitle");
    var calendarBody = document.getElementById("book-calendar-body");
    var calendarClose = document.getElementById("close-book-calendar");

    function renderBookCalendar(bookId, bookTitle, options) {
        if (!calendarPanel || !calendarBody || !calendarBookTitle) return;

        function buildBorrowersHtml(borrowers) {
            if (!borrowers || !borrowers.length) return '';
            var html = '<div class="book-borrowers-section">';
            html += '<div class="book-borrowers-header">Current borrowers</div>';
            html += '<ul class="book-borrowers-list">';
            borrowers.forEach(function (b) {
                var dueLabel = b.dueDate ? new Date(b.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
                var statusParts = [];
                if (b.overdue) statusParts.push('Overdue');
                if (typeof b.renewalsLeft === 'number') statusParts.push('Renewals left: ' + b.renewalsLeft);
                var meta = statusParts.join(' • ');

                html += '<li class="book-borrower-item">' +
                    '<div class="book-borrower-main"><strong>' + (b.userName || ('User #' + b.userId)) + '</strong>' +
                    (b.userEmail ? '<span class="book-borrower-email">' + b.userEmail + '</span>' : '') +
                    '</div>' +
                    '<div class="book-borrower-meta">Due: ' + dueLabel + (meta ? ' • ' + meta : '') + '</div>' +
                    '</li>';
            });
            html += '</ul></div>';
            return html;
        }

        var borrowers = options && Array.isArray(options.borrowers) ? options.borrowers : [];

        var bookReservations = reservations.filter(function (r) { return r.bookId == bookId; });
        calendarBookTitle.textContent = "Reservations for " + bookTitle;

        var borrowersHtml = buildBorrowersHtml(borrowers);

        if (!bookReservations.length) {
            if (calendarBookSubtitle) calendarBookSubtitle.textContent = "No reservations for this title.";
            var innerEmpty = borrowersHtml || '<p class="calendar-empty">No active borrows for this book.</p>';
            innerEmpty += '<p class="calendar-empty">No reservations recorded for this book.</p>';
            calendarBody.innerHTML = innerEmpty;
            calendarPanel.classList.add("active");
            return;
        }

        var dated = bookReservations
            .map(function (r) {
                var raw = r.date || r.eta || null;
                if (!raw) return null;
                var d = new Date(raw);
                if (isNaN(d.getTime())) return null;
                return {
                    userName: r.userName || "Unknown",
                    status: r.status || "pending",
                    queue: r.queue,
                    date: d
                };
            })
            .filter(function (x) { return x !== null; });

        if (!dated.length) {
            if (calendarBookSubtitle) calendarBookSubtitle.textContent = bookReservations.length + " reservation(s)";
            var fallbackHtml = borrowersHtml || '';
            fallbackHtml += '<ul class="reservation-list">';
            bookReservations.forEach(function (r) {
                fallbackHtml += '<li><strong>' + (r.userName || 'Unknown') + '</strong> - ' + (r.status || 'pending') + ' (Queue: ' + (r.queue || '-') + ')</li>';
            });
            fallbackHtml += '</ul>';
            calendarBody.innerHTML = fallbackHtml;
            calendarPanel.classList.add("active");
            return;
        }

        dated.sort(function (a, b) { return a.date.getTime() - b.date.getTime(); });

        var ref;
        if (options && typeof options.year === 'number' && typeof options.monthIndex === 'number') {
            // Use explicit month/year when navigating
            ref = new Date(options.year, options.monthIndex, 1);
        } else {
            // Default to the month of the earliest reservation
            ref = dated[0].date;
        }

        var year = ref.getFullYear();
        var monthIndex = ref.getMonth();

        var byDay = {};
        dated.forEach(function (entry) {
            if (entry.date.getFullYear() !== year || entry.date.getMonth() !== monthIndex) {
                return;
            }
            var day = entry.date.getDate();
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(entry);
        });

        var daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        var monthLabel = ref.toLocaleDateString('en-US', { month: 'long' });

        if (calendarBookSubtitle) {
            calendarBookSubtitle.textContent = monthLabel + " " + year + " reservations";
        }

        var daysHtml = "";
        for (var d = 1; d <= daysInMonth; d++) {
            var entriesForDay = byDay[d] || [];
            var cellClass = "calendar-cell";
            if (entriesForDay.length) {
                cellClass += " has-reservations";
            }
            var usersLabel = entriesForDay.length
                ? entriesForDay.map(function (e) { return e.userName; }).join(", ")
                : "No reservations";

            daysHtml +=
                '<div class="' +
                cellClass +
                '" data-day="' + d + '">' +
                '<span class="calendar-day-number">' +
                d +
                "</span>" +
                '<span class="calendar-day-users">' +
                usersLabel +
                "</span>" +
                "</div>";
        }

        calendarBody.innerHTML =
            (borrowersHtml || '') +
            '<div class="calendar-meta-row">' +
            '<button type="button" class="calendar-nav-btn prev"><i class="fas fa-chevron-left"></i></button>' +
            '<div class="calendar-meta">' +
            monthLabel +
            " " +
            year +
            "</div>" +
            '<button type="button" class="calendar-nav-btn next"><i class="fas fa-chevron-right"></i></button>' +
            "</div>" +
            '<div class="book-calendar-grid">' +
            daysHtml +
            "</div>" +
            '<div class="calendar-day-details" id="calendar-day-details">' +
            '<p class="calendar-empty">Click a day with reservations to see details.</p>' +
            "</div>";

        // Wire up day click handlers for details view
        var detailsEl = calendarBody.querySelector('#calendar-day-details');
        var cells = calendarBody.querySelectorAll('.calendar-cell');
        cells.forEach(function (cell) {
            cell.addEventListener('click', function () {
                if (!detailsEl) return;
                var day = parseInt(cell.getAttribute('data-day'), 10);
                var entries = dated.filter(function (entry) {
                    return entry.date.getFullYear() === year &&
                        entry.date.getMonth() === monthIndex &&
                        entry.date.getDate() === day;
                });

                cells.forEach(function (c) { c.classList.remove('selected'); });
                cell.classList.add('selected');

                if (!entries.length) {
                    detailsEl.innerHTML = '<p class="calendar-empty">No reservations for this day.</p>';
                    return;
                }

                var labelDate = entries[0].date;
                var dateLabel = labelDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                var listHtml = '<div class="calendar-day-details-header">Reservations on ' + dateLabel + '</div>';
                listHtml += '<ul class="calendar-day-details-list">';
                entries.forEach(function (e) {
                    var meta = e.status || 'pending';
                    if (typeof e.queue === 'number' && e.queue > 0) {
                        meta += ' • Queue #' + e.queue;
                    }
                    listHtml += '<li><strong>' + e.userName + '</strong><span class="calendar-day-details-meta">' + meta + '</span></li>';
                });
                listHtml += '</ul>';
                detailsEl.innerHTML = listHtml;
            });
        });

        // Wire up month navigation
        var prevBtn = calendarBody.querySelector('.calendar-nav-btn.prev');
        var nextBtn = calendarBody.querySelector('.calendar-nav-btn.next');

        if (prevBtn) {
            prevBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var newMonth = monthIndex - 1;
                var newYear = year;
                if (newMonth < 0) {
                    newMonth = 11;
                    newYear--;
                }
                renderBookCalendar(bookId, bookTitle, { year: newYear, monthIndex: newMonth, borrowers: borrowers });
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                var newMonth = monthIndex + 1;
                var newYear = year;
                if (newMonth > 11) {
                    newMonth = 0;
                    newYear++;
                }
                renderBookCalendar(bookId, bookTitle, { year: newYear, monthIndex: newMonth, borrowers: borrowers });
            });
        }

        calendarPanel.classList.add("active");
    }

    if (booksSection) {
        booksSection.addEventListener("click", async function (event) {
            var toggle = event.target.closest(".book-calendar-toggle");
            if (!toggle) return;
            var bookId = toggle.getAttribute("data-book-id");
            var title = toggle.getAttribute("data-book-title") || "Book";
            var borrowers = await loadBookBorrowers(bookId);
            renderBookCalendar(bookId, title, { borrowers: borrowers });
        });
    }

    if (calendarClose && calendarPanel) {
        calendarClose.addEventListener("click", function () {
            calendarPanel.classList.remove("active");
        });
    }

    // --- USERS: CRUD & cards ---
    var userCardsGrid = document.getElementById("user-cards-grid");
    var userModalOverlay = document.getElementById("user-editor-modal");
    var userOpenModalBtn = document.getElementById("user-open-modal");
    var userModalTitle = document.getElementById("user-modal-title");
    var userForm = document.getElementById("user-form");
    var userNameInput = document.getElementById("user-name-input");
    var userEmailInput = document.getElementById("user-email-input");
    var userRoleInput = document.getElementById("user-role-input");
    var userStatusInput = document.getElementById("user-status-input");
    var userSubmitBtn = document.getElementById("user-submit-btn");
    var userCancelEditBtn = document.getElementById("user-cancel-edit-btn");

    var historyPanel = document.getElementById("user-history-panel");
    var historyName = document.getElementById("history-user-name");
    var historySub = document.getElementById("history-user-sub");
    var historyList = document.getElementById("user-history-list");
    var readerBadge = document.getElementById("reader-badge");

    var currentEditingUserId = null;

    function updateUserMetrics() {
        var activeMembersEl = document.getElementById("metric-active-members");
        var adminAccountsEl = document.getElementById("metric-staff-accounts");
        var activeCount = users.filter(u => u.status === 'active').length;
        var adminCount = users.filter(u => u.role === 'Admin').length;

        if (activeMembersEl) activeMembersEl.textContent = String(activeCount);
        if (adminAccountsEl) adminAccountsEl.textContent = String(adminCount);
    }

    function markReaderOfMonth() {
        if (!Array.isArray(users) || users.length === 0) return;

        users.forEach(u => { u.isReaderOfMonth = false; });

        var sorted = users.slice().sort((a, b) => (b.totalBooks || 0) - (a.totalBooks || 0));
        var top = sorted[0];

        if (top && (top.totalBooks || 0) > 0) {
            top.isReaderOfMonth = true;
        }
    }

    function renderUserHistory(user) {
        if (!historyPanel || !historyName || !historySub || !historyList) return;

        if (!user) {
            historyName.textContent = 'Select a user';
            historySub.textContent = 'Click an index card to see their borrowing history.';
            historyList.innerHTML = '<li class="user-history-empty">No user selected yet.</li>';
            if (readerBadge) readerBadge.style.display = 'none';
            return;
        }

        historyName.textContent = user.name || 'User';
        var statusLabel = user.status ? (user.status.charAt(0).toUpperCase() + user.status.slice(1)) : 'Active';
        var subtitleParts = [];
        if (user.email) subtitleParts.push(user.email);
        if (user.role) subtitleParts.push(user.role);
        subtitleParts.push(statusLabel);
        historySub.textContent = subtitleParts.join(' • ');

        if (readerBadge) {
            readerBadge.style.display = user.isReaderOfMonth ? 'inline-flex' : 'none';
        }

        var items = Array.isArray(user.history) ? user.history : [];
        if (!items.length) {
            historyList.innerHTML = '<li class="user-history-empty">No borrowing history recorded for this user yet.</li>';
            return;
        }

        var html = '';
        items.forEach(function (entry) {
            var title = (entry.book && entry.book.title) ? entry.book.title : 'Unknown title';
            var dateLabel = entry.returnDate || entry.borrowDate || '';
            var statusText = entry.overdue ? 'Overdue' : 'Returned';
            var metaParts = [];
            if (dateLabel) metaParts.push(dateLabel);
            metaParts.push(statusText);
            if (entry.book && entry.book.author) metaParts.push(entry.book.author);
            var metaText = metaParts.join(' • ');

            html += '<li>' +
                '<span class="user-history-title">' + title + '</span>' +
                '<span class="user-history-meta">' + metaText + '</span>' +
                '</li>';
        });

        historyList.innerHTML = html;
    }

    async function loadUserHistoryFor(userId) {
        var user = users.find(u => u.id == userId);
        if (!user) return;

        try {
            const response = await fetch(`${API_BASE}/history.php?userId=${userId}`);
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                user.history = result.data;
            } else {
                user.history = [];
            }
        } catch (err) {
            console.error('Failed to load user history:', err);
            user.history = [];
        }

        renderUserHistory(user);
    }

    function renderUserCards() {
        if (!userCardsGrid) return;
        userCardsGrid.innerHTML = "";

        if (users.length === 0) {
            userCardsGrid.innerHTML = '<p style="color:var(--text-gray);padding:40px;text-align:center;">No users found</p>';
            return;
        }

        var readerId = users.find(u => u.isReaderOfMonth)?.id;

        users.forEach(function (u) {
            var initials = (u.name || 'U').split(" ").filter(p => p.length > 0).map(p => p[0]).join("").toUpperCase().slice(0, 2);
            // Admin uses the "staff" styling, regular users use "member"
            var roleClass = u.role === "Admin" ? "staff" : "member";
            // Map status to CSS classes: active / limited / banned
            var statusClass = 'active';
            if (u.status === 'limited') statusClass = 'limited';
            else if (u.status === 'banned') statusClass = 'banned';
            var isReader = readerId && readerId === u.id;

            var card = document.createElement("article");
            card.className = "user-card";
            card.setAttribute("data-user-id", u.id);
            card.innerHTML =
                '<div class="user-card-header">' +
                '  <div class="user-card-avatar">' + initials + '</div>' +
                '  <div class="user-card-meta">' +
                '    <h3 class="user-card-name">' + u.name + '</h3>' +
                '    <div class="user-card-tag-row">' +
                '      <span class="user-role-pill ' + roleClass + '">' + u.role + '</span>' +
                '      <span class="user-status-pill ' + statusClass + '">' + (u.status.charAt(0).toUpperCase() + u.status.slice(1)) + '</span>' +
                '    </div>' +
                '  </div>' +
                (isReader ? '<span class="reader-chip">Reader of the Month</span>' : "") +
                '</div>' +
                '<div class="user-card-body">' +
                '  <div class="user-card-stat"><span>Books borrowed</span><span>' + (u.booksThisMonth || 0) + '</span></div>' +
                '  <div class="user-card-stat"><span>Total read</span><span>' + (u.totalBooks || 0) + '</span></div>' +
                '  <div class="user-card-stat"><span>Last activity</span><span>' + (u.lastActivity || "-") + '</span></div>' +
                '</div>' +
                '<div style="margin-top:6px; display:flex; gap:4px;">' +
                '  <button class="admin-table-icon-btn" type="button" data-action="edit-user" data-id="' + u.id + '"><i class="fas fa-pen"></i></button>' +
                '  <button class="admin-table-icon-btn danger" type="button" data-action="delete-user" data-id="' + u.id + '"><i class="fas fa-trash"></i></button>' +
                '</div>';

            // Clicking a card loads this user's history into the side panel
            card.addEventListener('click', function () {
                var allCards = userCardsGrid.querySelectorAll('.user-card');
                allCards.forEach(function (c) { c.classList.remove('active'); });
                card.classList.add('active');
                loadUserHistoryFor(u.id);
            });

            userCardsGrid.appendChild(card);
        });

        updateUserMetrics();
        populateReservationUserOptions();
        renderLeaderboards();
        wireUserCardClicks();
    }

    function wireUserCardClicks() {
        var actionBtns = userCardsGrid ? userCardsGrid.querySelectorAll(".admin-table-icon-btn") : [];
        actionBtns.forEach(function (btn) {
            btn.addEventListener("click", async function (e) {
                e.stopPropagation();
                var id = btn.getAttribute("data-id");
                var action = btn.getAttribute("data-action");
                if (!id || !action) return;

                if (action === "edit-user") {
                    var u = users.find(x => x.id == id);
                    if (!u) return;
                    currentEditingUserId = u.id;
                    userNameInput.value = u.name;
                    userEmailInput.value = u.email;
                    userRoleInput.value = u.role;
                    userStatusInput.value = u.status;
                    userModalTitle.textContent = "Edit user";
                    userSubmitBtn.textContent = "Save changes";
                    userModalOverlay.classList.add("active");
                } else if (action === "delete-user") {
                    if (!confirm("Delete this user?")) return;
                    const result = await deleteUser(id);
                    if (result.success) {
                        await loadUsers();
                        await loadReservations();
                        renderUserCards();
                        renderReservations();
                    } else {
                        alert(result.message || 'Failed to delete user');
                    }
                }
            });
        });
    }

    function openUserModal(mode, user) {
        if (!userModalOverlay) return;
        if (mode === "edit" && user) {
            userModalTitle.textContent = "Edit user";
            userSubmitBtn.textContent = "Save changes";
            userNameInput.value = user.name || "";
            userEmailInput.value = user.email || "";
            userRoleInput.value = user.role || "Member";
            userStatusInput.value = user.status || "active";
        } else {
            userModalTitle.textContent = "Add user";
            userSubmitBtn.textContent = "Add user";
            userForm.reset();
        }
        userModalOverlay.classList.add("active");
    }

    function closeUserModal() {
        if (!userModalOverlay) return;
        userModalOverlay.classList.remove("active");
        currentEditingUserId = null;
    }

    if (userOpenModalBtn) {
        userOpenModalBtn.addEventListener("click", function () {
            currentEditingUserId = null;
            openUserModal("add");
        });
    }

    if (userModalOverlay) {
        userModalOverlay.addEventListener("click", function (e) {
            if (e.target === userModalOverlay) closeUserModal();
        });
    }

    if (userForm) {
        userForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var name = userNameInput.value.trim();
            var email = userEmailInput.value.trim();
            var role = userRoleInput.value || "User";
            var status = userStatusInput.value || "active";
            if (!name || !email) return;

            const result = await saveUser({ name, email, role, status }, currentEditingUserId);
            if (result.success) {
                await loadUsers();
                renderUserCards();
                closeUserModal();
            } else {
                alert(result.error || result.message || 'Failed to save user');
            }
        });
    }

    if (userCancelEditBtn) {
        userCancelEditBtn.addEventListener("click", closeUserModal);
    }

    // --- RESERVATIONS: table ---
    var reservationsTableBody = document.getElementById("reservations-table-body");
    var reservationModalOverlay = document.getElementById("reservation-editor-modal");
    var reservationOpenModalBtn = document.getElementById("reservation-open-modal");
    var reservationModalTitle = document.getElementById("reservation-modal-title");
    var reservationForm = document.getElementById("reservation-form");
    var reservationBookInput = document.getElementById("reservation-book-input");
    var reservationUserInput = document.getElementById("reservation-user-input");
    var reservationStatusInput = document.getElementById("reservation-status-input");
    var reservationDateInput = document.getElementById("reservation-date-input");
    var reservationSubmitBtn = document.getElementById("reservation-submit-btn");
    var reservationCancelEditBtn = document.getElementById("reservation-cancel-edit-btn");

    var currentEditingReservationId = null;

    function populateReservationBookOptions() {
        if (!reservationBookInput) return;
        reservationBookInput.innerHTML = "";
        books.forEach(function (b) {
            var opt = document.createElement("option");
            opt.value = b.id;
            opt.textContent = b.title;
            reservationBookInput.appendChild(opt);
        });
    }

    function populateReservationUserOptions() {
        if (!reservationUserInput) return;
        reservationUserInput.innerHTML = "";
        users.forEach(function (u) {
            var opt = document.createElement("option");
            opt.value = u.id;
            opt.textContent = u.name;
            reservationUserInput.appendChild(opt);
        });
    }

    function openReservationModal() {
        if (!reservationModalOverlay) return;

        currentEditingReservationId = null;
        reservationModalTitle.textContent = "Add reservation";
        reservationSubmitBtn.textContent = "Add reservation";

        if (reservationForm) {
            reservationForm.reset();
        }

        // Ensure latest options
        populateReservationBookOptions();
        populateReservationUserOptions();

        // Default pickup date to today
        if (reservationDateInput) {
            var today = new Date().toISOString().split('T')[0];
            reservationDateInput.value = today;
        }

        reservationModalOverlay.classList.add("active");
    }

    function closeReservationModal() {
        if (!reservationModalOverlay) return;
        reservationModalOverlay.classList.remove("active");
        currentEditingReservationId = null;
    }

    function renderReservations() {
        if (!reservationsTableBody) return;
        reservationsTableBody.innerHTML = "";

        if (reservations.length === 0) {
            reservationsTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-gray);padding:40px;">No reservations found</td></tr>';
            return;
        }

        reservations.forEach(function (r) {
            var book = books.find(b => b.id == r.bookId);
            var user = users.find(u => u.id == r.userId);
            var statusClass = "";
            if (r.status === "ready") statusClass = "success";
            else if (r.status === "pending" || r.status === "waiting") statusClass = "warning";
            else if (r.status === "in_transit") statusClass = "info";

            var tr = document.createElement("tr");
            tr.innerHTML =
                "<td>" + (book ? book.title : r.bookTitle || "-") + "</td>" +
                "<td>" + (user ? user.name : r.userName || "-") + "</td>" +
                '<td><span class="status-pill ' + statusClass + '">' + (r.status || 'pending').replace("_", " ") + "</span></td>" +
                "<td>" + (typeof r.queue === "number" ? "#" + r.queue : "-") + "</td>" +
                "<td>" + (r.eta || r.date || "-") + "</td>" +
                '<td>' +
                '<button class="admin-table-icon-btn danger" type="button" data-action="cancel-reservation" data-id="' + r.id + '" data-user="' + r.userId + '"><i class="fas fa-times"></i></button>' +
                "</td>";
            reservationsTableBody.appendChild(tr);
        });

        updateStatsFromData();
        renderLeaderboards();
    }

    if (reservationOpenModalBtn) {
        reservationOpenModalBtn.addEventListener("click", function () {
            openReservationModal();
        });
    }

    if (reservationModalOverlay) {
        reservationModalOverlay.addEventListener("click", function (e) {
            if (e.target === reservationModalOverlay) {
                closeReservationModal();
            }
        });
    }

    if (reservationCancelEditBtn) {
        reservationCancelEditBtn.addEventListener("click", function () {
            closeReservationModal();
        });
    }

    if (reservationForm) {
        reservationForm.addEventListener("submit", async function (e) {
            e.preventDefault();

            if (!reservationBookInput || !reservationUserInput) return;

            var bookId = reservationBookInput.value;
            var userId = reservationUserInput.value;
            var pickupDate = reservationDateInput ? reservationDateInput.value : "";

            if (!bookId || !userId) return;

            try {
                var payload = {
                    bookId: parseInt(bookId, 10),
                    userId: parseInt(userId, 10)
                };
                if (pickupDate) {
                    payload.pickupDate = pickupDate;
                }

                const response = await fetch(`${API_BASE}/reserve.php?action=reserve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (result.success) {
                    await loadReservations();
                    renderReservations();
                    renderBooks();
                    closeReservationModal();
                } else {
                    alert(result.message || 'Failed to create reservation');
                }
            } catch (err) {
                console.error('Failed to create reservation:', err);
                alert('Failed to create reservation');
            }
        });
    }

    if (reservationsTableBody) {
        reservationsTableBody.addEventListener("click", async function (e) {
            var btn = e.target.closest(".admin-table-icon-btn");
            if (!btn) return;
            var action = btn.getAttribute("data-action");
            var resId = btn.getAttribute("data-id");
            var userId = btn.getAttribute("data-user");

            if (action === "cancel-reservation" && resId && userId) {
                if (!confirm("Cancel this reservation?")) return;
                try {
                    const response = await fetch(`${API_BASE}/reserve.php?action=cancel`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ reservationId: resId, userId: userId })
                    });
                    const result = await response.json();
                    if (result.success) {
                        await loadReservations();
                        renderReservations();
                        renderBooks();
                    }
                } catch (e) {
                    console.error('Failed to cancel reservation:', e);
                }
            }
        });
    }

    // --- Statistics & Leaderboards ---
    function updateStatsFromData() {
        var loansMonthEl = document.getElementById("stat-loans-month");
        var returnsMonthEl = document.getElementById("stat-returns-month");
        var newMembersEl = document.getElementById("stat-new-members");
        var activeCatEl = document.getElementById("stat-most-active-category");
        var idleTitlesEl = document.getElementById("stat-idle-titles");

        var heroLoansEl = document.getElementById("stat-hero-loans");
        var heroMembersEl = document.getElementById("stat-hero-members");
        var heroCategoryEl = document.getElementById("stat-hero-category");
        var heroSubtitleEl = document.getElementById("stat-hero-subtitle");

        var loansThisMonth = 0;
        var returnsThisMonth = 0;
        var newMembers = users.length;
        var mostActiveCategory = "-";
        var monthlyLoans = [];

        // Use aggregated history stats when available
        if (adminStatsHistory) {
            monthlyLoans = Array.isArray(adminStatsHistory.monthlyLoans) ? adminStatsHistory.monthlyLoans : [];
            if (monthlyLoans.length > 0) {
                var currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                var current = monthlyLoans.find(m => m.month === currentMonth) || monthlyLoans[0];
                loansThisMonth = current && typeof current.count === 'number' ? current.count : 0;
                returnsThisMonth = loansThisMonth;
            }

            var topCats = Array.isArray(adminStatsHistory.topCategories) ? adminStatsHistory.topCategories : [];
            if (topCats.length > 0) {
                mostActiveCategory = topCats[0].category || mostActiveCategory;
            }
        }

        // Fallback: build monthly trend from reservations if history is missing
        if ((!monthlyLoans || !monthlyLoans.length) && reservations && reservations.length) {
            var buckets = {};
            reservations.forEach(function (r) {
                var rawDate = r.date || r.borrowDate || r.created_at || r.eta || "";
                if (!rawDate || typeof rawDate !== 'string') return;
                var monthKey = rawDate.slice(0, 7); // assume YYYY-MM[-DD]
                if (monthKey.length !== 7) return;
                buckets[monthKey] = (buckets[monthKey] || 0) + 1;
            });

            var monthKeys = Object.keys(buckets).sort();
            monthlyLoans = monthKeys.map(function (key) {
                return { month: key, count: buckets[key] };
            });

            if (monthlyLoans.length > 0 && loansThisMonth === 0) {
                var currentMonthKey = new Date().toISOString().slice(0, 7);
                var currentEntry = monthlyLoans.find(function (m) { return m.month === currentMonthKey; }) || monthlyLoans[monthlyLoans.length - 1];
                if (currentEntry && typeof currentEntry.count === 'number') {
                    loansThisMonth = currentEntry.count;
                    returnsThisMonth = loansThisMonth;
                }
            }
        }

        // Use aggregated user stats for member counts
        if (adminStatsUsers && typeof adminStatsUsers.totalUsers === 'number') {
            newMembers = adminStatsUsers.totalUsers;
        }

        // Idle titles: books that never appear in any active reservation
        var idleTitles = books.filter(function (b) {
            return !reservations.some(r => r.bookId == b.id);
        }).length;

        if (loansMonthEl) loansMonthEl.textContent = String(loansThisMonth);
        if (returnsMonthEl) returnsMonthEl.textContent = String(returnsThisMonth);
        if (newMembersEl) newMembersEl.textContent = String(newMembers);
        if (activeCatEl) activeCatEl.textContent = mostActiveCategory;
        if (idleTitlesEl) idleTitlesEl.textContent = String(idleTitles);

        var activeMembersCount = users.filter(u => u.status === 'active').length;

        if (heroLoansEl) heroLoansEl.textContent = String(loansThisMonth);
        if (heroMembersEl) heroMembersEl.textContent = String(activeMembersCount || newMembers);
        if (heroCategoryEl) heroCategoryEl.textContent = mostActiveCategory;
        if (heroSubtitleEl) {
            heroSubtitleEl.textContent = String(loansThisMonth) + ' loans • ' +
                String(returnsThisMonth) + ' returns • ' +
                String(newMembers) + ' members';
        }

        // Update detailed circulation chart in Circulation panel (current snapshot)
        renderReadingTrendChart({
            loansThisMonth: loansThisMonth,
            returnsThisMonth: returnsThisMonth,
            members: newMembers,
            totalBooks: books.length,
            activeReservations: reservations.length,
            idleTitles: idleTitles
        });

        var sparklineBarsEl = document.getElementById("hero-loans-sparkline-bars");
        var sparklineLabelEl = document.getElementById("hero-loans-sparkline-label");
        if (sparklineBarsEl) {
            if (!monthlyLoans || !monthlyLoans.length) {
                sparklineBarsEl.innerHTML = "";
                if (sparklineLabelEl) sparklineLabelEl.textContent = 'Loans trend (no data yet)';
            } else {
                var recent = monthlyLoans.slice(-6);
                var max = Math.max.apply(null, recent.map(function (m) {
                    return typeof m.count === 'number' ? m.count : 0;
                }));
                if (!max || max <= 0) max = 1;

                var barsHtml = '';
                recent.forEach(function (m, index) {
                    var value = typeof m.count === 'number' ? m.count : 0;
                    var height = Math.round((value / max) * 100);
                    if (height < 8) height = 8;
                    var isLast = index === recent.length - 1;
                    var monthLabel = m.month || '';
                    barsHtml += '<div class="hero-sparkline-bar' + (isLast ? ' active' : '') + '" style="height:' + height + '%" title="' + monthLabel + '"></div>';
                });
                sparklineBarsEl.innerHTML = barsHtml;
                if (sparklineLabelEl) {
                    sparklineLabelEl.textContent = 'Loans trend (last ' + recent.length + ' months)';
                }
            }
        }
    }

    function renderReadingTrendChart(metrics) {
        var container = document.querySelector("#admin-stats .placeholder-chart");
        if (!container) return;
        var values = metrics && typeof metrics === 'object' ? metrics : null;
        if (!values) {
            container.classList.remove("trend-chart-ready");
            container.textContent = "Circulation breakdown (no data)";
            return;
        }

        var items = [
            { key: "loansThisMonth", label: "Loans", className: "metric-loans" },
            { key: "returnsThisMonth", label: "Returns", className: "metric-returns" },
            { key: "members", label: "Members", className: "metric-members" },
            { key: "totalBooks", label: "Books", className: "metric-books" },
            { key: "activeReservations", label: "Reservations", className: "metric-reservations" },
            { key: "idleTitles", label: "Idle titles", className: "metric-idle" }
        ];

        var series = items.map(function (item) {
            var v = values[item.key];
            return {
                label: item.label,
                className: item.className,
                value: typeof v === 'number' && !isNaN(v) ? v : 0
            };
        });

        var max = Math.max.apply(null, series.map(function (s) { return s.value; }));
        if (!max || max <= 0) {
            max = 1;
        }

        container.classList.add("trend-chart-ready");
        container.innerHTML = "";

        var chartEl = document.createElement("div");
        chartEl.className = "trend-chart";

        var barsEl = document.createElement("div");
        barsEl.className = "trend-chart-bars";

        series.forEach(function (s) {
            var heightPct = Math.round((s.value / max) * 100);
            if (s.value > 0 && heightPct < 8) heightPct = 8;
            if (s.value === 0) heightPct = 3;

            var wrapper = document.createElement("div");
            wrapper.className = "trend-chart-bar-wrapper";

            var valueEl = document.createElement("div");
            valueEl.className = "trend-chart-bar-value";
            valueEl.textContent = String(s.value);

            var bar = document.createElement("div");
            bar.className = "trend-chart-bar " + s.className;
            bar.style.height = heightPct + "%";
            bar.title = s.label + ": " + s.value;

            var label = document.createElement("div");
            label.className = "trend-chart-bar-label";
            label.textContent = s.label;

            wrapper.appendChild(valueEl);
            wrapper.appendChild(bar);
            wrapper.appendChild(label);
            barsEl.appendChild(wrapper);
        });

        chartEl.appendChild(barsEl);
        container.appendChild(chartEl);
    }

    function renderLeaderboards() {
        var topReadersList = document.getElementById("top-readers-list");
        var topBooksList = document.getElementById("top-books-list");
        var topReaderFeature = document.getElementById("top-reader-feature");
        var topBookFeature = document.getElementById("top-book-feature");
        if (!topReadersList && !topBooksList) return;

        // Readers by totalBooks
        var readersSorted = users.slice().sort((a, b) => (b.totalBooks || 0) - (a.totalBooks || 0)).slice(0, 5);

        if (topReaderFeature) {
            if (readersSorted.length === 0) {
                topReaderFeature.innerHTML = '<p class="leaderboard-feature-empty">No readers yet.</p>';
            } else {
                var topReader = readersSorted[0];
                var total = topReader.totalBooks || 0;
                var monthly = topReader.booksThisMonth || 0;
                var initials = (topReader.name || 'U').split(' ').filter(function (p) { return p.length > 0; }).map(function (p) { return p[0]; }).join('').toUpperCase().slice(0, 2);
                topReaderFeature.innerHTML =
                    '<div class="leaderboard-feature-badge">Top reader</div>' +
                    '<div class="leaderboard-feature-content">' +
                    '<div class="leaderboard-feature-avatar">' + initials + '</div>' +
                    '<div class="leaderboard-feature-text">' +
                    '<div class="leaderboard-feature-title">' + topReader.name + '</div>' +
                    '<div class="leaderboard-feature-meta">' + total + ' books read • ' + monthly + ' this month</div>' +
                    '</div>' +
                    '</div>';
            }
        }

        if (topReadersList) {
            topReadersList.innerHTML = "";
            if (readersSorted.length === 0) {
                topReadersList.innerHTML = '<li style="color:var(--text-gray)">No readers yet</li>';
            } else {
                readersSorted.forEach(function (u, index) {
                    var li = document.createElement("li");
                    li.innerHTML = '<span>' + (index + 1) + '. ' + u.name + '</span><span>' + (u.totalBooks || 0) + ' books</span>';
                    topReadersList.appendChild(li);
                });
            }
        }

        // Books by reservation count
        var bookLoanCounts = {};
        reservations.forEach(function (r) {
            var key = r.bookId;
            if (!key) return;
            bookLoanCounts[key] = (bookLoanCounts[key] || 0) + 1;
        });

        var bookEntries = Object.keys(bookLoanCounts).map(function (key) {
            var book = books.find(b => b.id == key);
            var cover = '';
            if (book) {
                cover = book.cover || book.imageUrl || '';
            }
            return {
                id: key,
                title: book ? book.title : key,
                count: bookLoanCounts[key],
                cover: cover
            };
        }).sort((a, b) => b.count - a.count).slice(0, 5);

        if (topBookFeature) {
            if (bookEntries.length === 0) {
                topBookFeature.innerHTML = '<p class="leaderboard-feature-empty">No loans yet.</p>';
            } else {
                var topBook = bookEntries[0];
                var coverUrl = topBook.cover || 'https://images.unsplash.com/photo-1544939630-1d3db332bf41?auto=format&fit=crop&q=80&w=400';
                topBookFeature.innerHTML =
                    '<div class="leaderboard-feature-badge">Top title</div>' +
                    '<div class="leaderboard-feature-content">' +
                    '<div class="leaderboard-feature-cover" style="background-image:url(' + JSON.stringify(coverUrl) + ');"></div>' +
                    '<div class="leaderboard-feature-text">' +
                    '<div class="leaderboard-feature-title">' + topBook.title + '</div>' +
                    '<div class="leaderboard-feature-meta">' + topBook.count + ' active reservations</div>' +
                    '</div>' +
                    '</div>';
            }
        }

        if (topBooksList) {
            topBooksList.innerHTML = "";
            if (bookEntries.length === 0) {
                topBooksList.innerHTML = '<li style="color:var(--text-gray)">No loans yet</li>';
            } else {
                bookEntries.forEach(function (entry, index) {
                    var li = document.createElement("li");
                    li.innerHTML = '<span>' + (index + 1) + '. ' + entry.title + '</span><span>' + entry.count + ' loans</span>';
                    topBooksList.appendChild(li);
                });
            }
        }
    }

    // --- Initial load ---
    async function initialize() {
        await loadBooks();
        await loadCategories();
        await loadUsers();
        await loadReservations();
        await loadAdminStats();

        populateReservationBookOptions();
        populateReservationUserOptions();
        renderBooks();
        renderUserCards();
        renderReservations();
        updateStatsFromData();
        renderLeaderboards();
    }

    initialize();
});
