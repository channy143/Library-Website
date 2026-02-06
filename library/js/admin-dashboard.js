document.addEventListener("DOMContentLoaded", function () {
    var navItems = document.querySelectorAll(".admin-nav-item");
    var sections = document.querySelectorAll(".admin-section");
    var titleEl = document.getElementById("admin-section-title");
    var subtitleEl = document.getElementById("admin-section-subtitle");
    var avatarEl = document.getElementById("adminAvatar");
    var nameEl = document.getElementById("adminUserName");
    var logoutBtn = document.getElementById("adminLogout");

    var subtitles = {
        "admin-books": "Manage the catalog, availability, and inventory.",
        "admin-users": "Oversee member and staff accounts.",
        "admin-stats": "Monitor performance and usage patterns.",
        "admin-reservations": "Track reservations and queue health.",
        "admin-leaderboards": "See top readers and popular titles."
    };

    navItems.forEach(function (item) {
        item.addEventListener("click", function () {
            var target = item.getAttribute("data-section");
            if (!target) return;

            navItems.forEach(function (btn) {
                btn.classList.remove("active");
            });
            item.classList.add("active");

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

    var stored = sessionStorage.getItem("currentUser");
    if (stored) {
        try {
            var user = JSON.parse(stored);
            if (nameEl && user.fullName) {
                nameEl.textContent = user.fullName;
            }
            if (avatarEl) {
                var base = user.fullName || user.username || "Admin";
                var initials = base
                    .split(" ")
                    .filter(function (p) { return p.length > 0; })
                    .map(function (p) { return p[0]; })
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);
                avatarEl.textContent = initials;
            }
        } catch (e) {
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            sessionStorage.removeItem("currentUser");
            window.location.href = "login.html";
        });
    }

    // --- Books reservations calendar (admin) ---
    var bookReservations = {
        "Dune": {
            monthLabel: "December",
            year: 2025,
            daysInMonth: 30,
            reservations: [
                { day: 2, user: "Alex Rivera" },
                { day: 5, user: "Jordan Lee" },
                { day: 12, user: "Riya Sharma" },
                { day: 18, user: "Chris Young" }
            ]
        },
        "1984": {
            monthLabel: "December",
            year: 2025,
            daysInMonth: 30,
            reservations: [
                { day: 3, user: "Sam Patel" },
                { day: 9, user: "Taylor Gray" }
            ]
        },
        "The Hobbit": {
            monthLabel: "December",
            year: 2025,
            daysInMonth: 30,
            reservations: [
                { day: 4, user: "Mia Chen" },
                { day: 14, user: "Liam Torres" },
                { day: 27, user: "Noah Smith" }
            ]
        }
    };

    var booksSection = document.getElementById("admin-books");
    var calendarPanel = document.getElementById("book-calendar-panel");
    var calendarBookTitle = document.getElementById("calendar-book-title");
    var calendarBookSubtitle = document.getElementById("calendar-book-subtitle");
    var calendarBody = document.getElementById("book-calendar-body");
    var calendarClose = document.getElementById("close-book-calendar");

    function renderBookCalendar(bookTitle) {
        if (!calendarPanel || !calendarBody || !calendarBookTitle) {
            return;
        }

        var config = bookReservations[bookTitle];
        calendarBookTitle.textContent = "Reservations for " + bookTitle;

        if (!config || !config.reservations || !config.reservations.length) {
            if (calendarBookSubtitle) {
                calendarBookSubtitle.textContent = "No reservation data available for this title yet.";
            }
            calendarBody.innerHTML = '<p class="calendar-empty">No reservations recorded for this book.</p>';
            calendarPanel.classList.add("active");
            return;
        }

        if (calendarBookSubtitle) {
            calendarBookSubtitle.textContent =
                config.monthLabel + " " + config.year + " reservation overview";
        }

        var byDay = {};
        config.reservations.forEach(function (entry) {
            if (!byDay[entry.day]) {
                byDay[entry.day] = [];
            }
            byDay[entry.day].push(entry.user);
        });

        var totalDays = config.daysInMonth || 30;
        var daysHtml = "";
        for (var d = 1; d <= totalDays; d++) {
            var users = byDay[d] || [];
            var cellClass = "calendar-cell";
            if (users.length) {
                cellClass += " has-reservations";
            }

            var usersLabel = users.length
                ? users.join(", ")
                : "No reservations";

            daysHtml +=
                '<div class="' +
                cellClass +
                '">' +
                '<span class="calendar-day-number">' +
                d +
                "</span>" +
                '<span class="calendar-day-users">' +
                usersLabel +
                "</span>" +
                "</div>";
        }

        calendarBody.innerHTML =
            '<div class="calendar-meta">' +
            config.monthLabel +
            " " +
            config.year +
            "</div>" +
            '<div class="book-calendar-grid">' +
            daysHtml +
            "</div>";

        calendarPanel.classList.add("active");
    }

    if (booksSection) {
        booksSection.addEventListener("click", function (event) {
            var toggle = event.target.closest(".book-calendar-toggle");
            if (!toggle) return;
            var bookTitle = toggle.getAttribute("data-book-title");
            if (bookTitle) {
                renderBookCalendar(bookTitle);
            }
        });
    }

    if (calendarClose && calendarPanel) {
        calendarClose.addEventListener("click", function () {
            calendarPanel.classList.remove("active");
        });
    }

    // --- User management index cards & borrowing history ---
    var adminUsersData = {
        christian: {
            name: "Christian Salinas",
            email: "christian@example.com",
            role: "Member",
            isReaderOfMonth: true,
            history: [
                { title: "Dune", date: "Nov 28, 2025", status: "Returned", notes: "Finished in 4 days" },
                { title: "1984", date: "Nov 15, 2025", status: "Returned", notes: "5/5 rating" },
                { title: "The Hobbit", date: "Oct 20, 2025", status: "Returned", notes: "Re-read" }
            ]
        },
        maria: {
            name: "Maria Lopez",
            email: "maria.lopez@example.com",
            role: "Staff",
            isReaderOfMonth: false,
            history: [
                { title: "The Great Gatsby", date: "Nov 10, 2025", status: "Returned", notes: "For class display" },
                { title: "Project Hail Mary", date: "Oct 12, 2025", status: "Returned", notes: "" }
            ]
        },
        john: {
            name: "John Carter",
            email: "john.carter@example.com",
            role: "Member",
            isReaderOfMonth: false,
            history: [
                { title: "1984", date: "Aug 3, 2025", status: "Overdue", notes: "Returned late" }
            ]
        }
    };

    var userCards = document.querySelectorAll(".user-card");
    var historyPanel = document.getElementById("user-history-panel");
    var historyName = document.getElementById("history-user-name");
    var historySub = document.getElementById("history-user-sub");
    var historyList = document.getElementById("user-history-list");
    var readerBadge = document.getElementById("reader-badge");

    function renderUserHistory(userId) {
        if (!historyPanel || !historyList || !historyName || !historySub) return;
        var data = adminUsersData[userId];
        if (!data) return;

        historyName.textContent = data.name;
        historySub.textContent = data.email + " • " + data.role;

        if (readerBadge) {
            readerBadge.style.display = data.isReaderOfMonth ? "inline-flex" : "none";
        }

        if (!data.history || !data.history.length) {
            historyList.innerHTML =
                '<li class="user-history-empty">No borrowing history recorded for this user yet.</li>';
            return;
        }

        var itemsHtml = "";
        data.history.forEach(function (entry) {
            itemsHtml +=
                '<li>' +
                '<span class="user-history-title">' +
                entry.title +
                "</span>" +
                '<span class="user-history-meta">' +
                entry.date +
                " • " +
                entry.status +
                (entry.notes ? " • " + entry.notes : "") +
                "</span>" +
                "</li>";
        });

        historyList.innerHTML = itemsHtml;
    }

    if (userCards.length) {
        userCards.forEach(function (card) {
            card.addEventListener("click", function () {
                var userId = card.getAttribute("data-user-id");
                if (!userId) return;

                userCards.forEach(function (c) {
                    c.classList.remove("active");
                });
                card.classList.add("active");

                renderUserHistory(userId);
            });
        });
    }
});
