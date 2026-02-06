-- Gravity Library SQLite Schema
-- SQLite database file: library.db

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Books Table
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    cover TEXT,
    pdf TEXT,
    description TEXT,
    available INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Borrowed Books Table
CREATE TABLE IF NOT EXISTS borrowed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    borrow_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    renewals_left INTEGER DEFAULT 2,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Reservations Table
CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    pickup_date TEXT,
    queue_position INTEGER DEFAULT 1,
    status TEXT DEFAULT 'waiting',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- History Table
CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    borrow_date TEXT NOT NULL,
    return_date TEXT NOT NULL,
    overdue INTEGER DEFAULT 0,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Wishlist Table
CREATE TABLE IF NOT EXISTS wishlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    UNIQUE(user_id, book_id)
);

-- Insert sample books
INSERT OR IGNORE INTO books (id, title, author, category, cover, pdf, description, available) VALUES
(1, 'The Great Gatsby', 'F. Scott Fitzgerald', 'Fiction', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800', NULL, 'A story of decadence and excess in the Jazz Age.', 1),
(2, '1984', 'George Orwell', 'Sci-Fi', 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=800', NULL, 'Dystopian social science fiction novel.', 1),
(3, 'To Kill a Mockingbird', 'Harper Lee', 'Fiction', 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=800', NULL, 'A novel about racial injustice in the Deep South.', 1),
(4, 'A Brief History of Time', 'Stephen Hawking', 'Non-Fiction', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800', 'brief_history.pdf', 'Modern physics for general readers.', 1),
(5, 'Dune', 'Frank Herbert', 'Sci-Fi', 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=800', NULL, 'Epic science fiction set on the desert planet Arrakis.', 1);
