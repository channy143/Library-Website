<?php
// SQLite Database Configuration
// Uses SQLite instead of MySQL - no XAMPP needed!

// Suppress HTML errors - always return JSON
error_reporting(0);
ini_set('display_errors', 0);

define('DATA_DIR', __DIR__ . '/../data');
define('DB_FILE', DATA_DIR . '/library.db');
define('ERROR_LOG_FILE', DATA_DIR . '/php-error.log');

// Global exception handler to return JSON and log details
set_exception_handler(function($e) {
    if (!file_exists(DATA_DIR)) {
        mkdir(DATA_DIR, 0755, true);
    }
    @file_put_contents(
        ERROR_LOG_FILE,
        date('c') . " EXCEPTION: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n\n",
        FILE_APPEND
    );

    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
    exit;
});

// Handle fatal errors (parse/runtime) that are not thrown as exceptions
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!file_exists(DATA_DIR)) {
            mkdir(DATA_DIR, 0755, true);
        }
        @file_put_contents(
            ERROR_LOG_FILE,
            date('c') . " FATAL: " . print_r($error, true) . "\n\n",
            FILE_APPEND
        );

        // Try to send a JSON error (may fail if headers already sent)
        if (!headers_sent()) {
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Fatal error: ' . $error['message']]);
        }
    }
});

// Initialize database
function initDatabase() {
    // Create data directory if it doesn't exist
    if (!file_exists(DATA_DIR)) {
        mkdir(DATA_DIR, 0755, true);
    }
    
    $db = getDB();
    
    // Create tables if they don't exist
    $db->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            full_name TEXT,
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT 'active',
            account_balance REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            category TEXT DEFAULT 'General',
            cover TEXT,
            pdf TEXT,
            description TEXT,
            copies INTEGER DEFAULT 1,
            available INTEGER DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
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
        
        CREATE TABLE IF NOT EXISTS wishlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (book_id) REFERENCES books(id),
            UNIQUE(user_id, book_id)
        );
        
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id INTEGER PRIMARY KEY,
            profile_picture TEXT,
            phone TEXT,
            address TEXT,
            bio TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        
        CREATE TABLE IF NOT EXISTS favorite_books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            added_date TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (book_id) REFERENCES books(id),
            UNIQUE(user_id, book_id)
        );
        
        CREATE TABLE IF NOT EXISTS recently_read_books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            last_read_page INTEGER DEFAULT 0,
            last_read_date TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (book_id) REFERENCES books(id)
        );
        
        CREATE TABLE IF NOT EXISTS admin_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            book_id INTEGER,
            notification_type TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (book_id) REFERENCES books(id)
        );
        
        CREATE TABLE IF NOT EXISTS penalties (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            book_id INTEGER,
            borrowed_id INTEGER,
            days_overdue INTEGER DEFAULT 0,
            penalty_type TEXT NOT NULL,
            fee_amount REAL DEFAULT 0,
            is_resolved INTEGER DEFAULT 0,
            admin_notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            resolved_at TEXT,
            resolved_by_admin_id INTEGER,
            payment_reference TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (book_id) REFERENCES books(id)
        );
        
        CREATE TABLE IF NOT EXISTS payment_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            transaction_type TEXT NOT NULL,
            penalty_id INTEGER,
            status TEXT DEFAULT 'pending',
            reference_number TEXT,
            transaction_date TEXT DEFAULT CURRENT_TIMESTAMP,
            processed_by_admin_id INTEGER,
            processed_date TEXT,
            notes TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (penalty_id) REFERENCES penalties(id)
        );
        
        CREATE TABLE IF NOT EXISTS book_holds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'waiting',
            position INTEGER DEFAULT 1,
            notification_sent INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (book_id) REFERENCES books(id)
        );
        
        CREATE TABLE IF NOT EXISTS book_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            rating INTEGER NOT NULL,
            review TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (book_id) REFERENCES books(id),
            UNIQUE(user_id, book_id)
        );
    ");
    
    // Ensure status and account_balance columns exist on users table for older databases
    $result = $db->query("PRAGMA table_info(users)");
    $hasStatus = false;
    $hasBalance = false;
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        if (isset($row['name']) && $row['name'] === 'status') {
            $hasStatus = true;
        }
        if (isset($row['name']) && $row['name'] === 'account_balance') {
            $hasBalance = true;
        }
    }
    if (!$hasStatus) {
        $db->exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
    }
    if (!$hasBalance) {
        $db->exec("ALTER TABLE users ADD COLUMN account_balance REAL DEFAULT 0");
    }

    // Ensure copies column exists on books table for older databases
    $result = $db->query("PRAGMA table_info(books)");
    $hasCopies = false;
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        if (isset($row['name']) && $row['name'] === 'copies') {
            $hasCopies = true;
        }
    }
    if (!$hasCopies) {
        $db->exec("ALTER TABLE books ADD COLUMN copies INTEGER DEFAULT 1");
    }

    // Seed sample books if empty
    $count = $db->querySingle("SELECT COUNT(*) FROM books");
    if ($count == 0) {
        $db->exec("
            INSERT INTO books (title, author, category, cover, pdf, description, copies, available) VALUES
            ('The Great Gatsby', 'F. Scott Fitzgerald', 'Fiction', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800', NULL, 'A story of decadence and excess in the Jazz Age.', 3, 1),
            ('1984', 'George Orwell', 'Sci-Fi', 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=800', NULL, 'Dystopian social science fiction novel.', 4, 1),
            ('To Kill a Mockingbird', 'Harper Lee', 'Fiction', 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=800', NULL, 'A novel about racial injustice in the Deep South.', 2, 1),
            ('A Brief History of Time', 'Stephen Hawking', 'Non-Fiction', 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800', 'brief_history.pdf', 'Modern physics for general readers.', 2, 1),
            ('Dune', 'Frank Herbert', 'Sci-Fi', 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=800', NULL, 'Epic science fiction set on the desert planet Arrakis.', 3, 1)
        ");
    }
    
    return $db;
}

// Get database connection
function getDB() {
    static $db = null;
    if ($db === null) {
        if (!file_exists(DATA_DIR)) {
            mkdir(DATA_DIR, 0755, true);
        }
        $db = new SQLite3(DB_FILE);
        $db->enableExceptions(true);
        // Best-effort tuning: guard against older PHP/SQLite builds
        if (method_exists($db, 'busyTimeout')) {
            $db->busyTimeout(5000);
        }
        // These PRAGMAs may fail on some environments; ignore errors
        @$db->exec('PRAGMA journal_mode = WAL');
        @$db->exec('PRAGMA foreign_keys = ON');
    }
    return $db;
}

// User functions
function getUsers() {
    $db = getDB();
    $result = $db->query("SELECT * FROM users");
    $users = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $users[] = $row;
    }
    return $users;
}

function findUser($usernameOrEmail) {
    $db = getDB();
    $stmt = $db->prepare("SELECT * FROM users WHERE username = :val OR email = :val LIMIT 1");
    $stmt->bindValue(':val', $usernameOrEmail, SQLITE3_TEXT);
    $result = $stmt->execute();
    return $result->fetchArray(SQLITE3_ASSOC) ?: null;
}

function userExists($username, $email) {
    $db = getDB();
    $stmt = $db->prepare("SELECT COUNT(*) FROM users WHERE username = :username OR email = :email");
    $stmt->bindValue(':username', $username, SQLITE3_TEXT);
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $result = $stmt->execute();
    return $result->fetchArray()[0] > 0;
}

function addUser($userData) {
    $db = getDB();
    $stmt = $db->prepare("
        INSERT INTO users (username, email, password, full_name, role, created_at, updated_at) 
        VALUES (:username, :email, :password, :full_name, :role, :created_at, :updated_at)
    ");
    $now = date('Y-m-d H:i:s');
    $stmt->bindValue(':username', $userData['username'], SQLITE3_TEXT);
    $stmt->bindValue(':email', $userData['email'], SQLITE3_TEXT);
    $stmt->bindValue(':password', $userData['password'], SQLITE3_TEXT);
    $stmt->bindValue(':full_name', $userData['full_name'] ?? '', SQLITE3_TEXT);
    $stmt->bindValue(':role', $userData['role'] ?? 'user', SQLITE3_TEXT);
    $stmt->bindValue(':created_at', $now, SQLITE3_TEXT);
    $stmt->bindValue(':updated_at', $now, SQLITE3_TEXT);
    $stmt->execute();
    return $db->lastInsertRowID();
}

// Set CORS headers for local development
function setCorsHeaders() {
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: POST, GET, OPTIONS, PUT, DELETE');
    header('Access-Control-Allow-Headers: Content-Type');
    
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// Initialize database on include
initDatabase();
?>
