<?php
// Borrow API - SQLite
require_once 'config.php';

// Configuration
define('LOAN_DAYS', 14);
define('RENEW_DAYS', 7);
define('MAX_RENEWALS', 2);
define('MAX_BORROWED', 5);

$db = getDB();

function hasOverdueBooks($userId) {
    global $db;
    $today = date('Y-m-d');
    $stmt = $db->prepare("SELECT COUNT(*) FROM borrowed WHERE user_id = :uid AND due_date < :today");
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $stmt->bindValue(':today', $today, SQLITE3_TEXT);
    return $stmt->execute()->fetchArray()[0] > 0;
}

function countBorrowedBooks($userId) {
    global $db;
    $stmt = $db->prepare("SELECT COUNT(*) FROM borrowed WHERE user_id = :uid");
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    return $stmt->execute()->fetchArray()[0];
}

function getBorrowedEntry($bookId, $userId) {
    global $db;
    $stmt = $db->prepare("SELECT * FROM borrowed WHERE book_id = :bid AND user_id = :uid");
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    return $stmt->execute()->fetchArray(SQLITE3_ASSOC);
}

function isReservedByOthers($bookId, $userId) {
    global $db;
    $stmt = $db->prepare("SELECT COUNT(*) FROM reservations WHERE book_id = :bid AND user_id != :uid AND status = 'waiting'");
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    return $stmt->execute()->fetchArray()[0] > 0;
}

// Get inventory snapshot for a book (copies, borrowed count, free copies)
function getBookInventory($bookId) {
    global $db;

    $book = $db->querySingle("SELECT id, copies, available FROM books WHERE id = $bookId", true);
    if (!$book) return null;

    $copies = isset($book['copies']) ? (int)$book['copies'] : 1;
    if ($copies < 1) $copies = 1;

    $borrowedCount = (int)$db->querySingle("SELECT COUNT(*) FROM borrowed WHERE book_id = $bookId");
    $freeCopies = $copies - $borrowedCount;
    if ($freeCopies < 0) $freeCopies = 0;

    return [
        'book'     => $book,
        'copies'   => $copies,
        'borrowed' => $borrowedCount,
        'free'     => $freeCopies,
    ];
}

// Recompute books.available based on copies, current borrows, and reservations
function refreshBookAvailability($bookId) {
    global $db;

    $inv = getBookInventory($bookId);
    if (!$inv) return;

    $free = $inv['free'];

    // Any pending or ready reservations will hold available copies for the queue
    $waitingCount = (int)$db->querySingle("SELECT COUNT(*) FROM reservations WHERE book_id = $bookId AND status = 'waiting'");
    $readyCount   = (int)$db->querySingle("SELECT COUNT(*) FROM reservations WHERE book_id = $bookId AND status = 'ready'");

    $available = ($free > 0 && $waitingCount === 0 && $readyCount === 0) ? 1 : 0;

    $stmt = $db->prepare("UPDATE books SET available = :avail WHERE id = :bid");
    $stmt->bindValue(':avail', $available, SQLITE3_INTEGER);
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $stmt->execute();
}

function borrowBook($bookId, $userId) {
    global $db;
    
    // Validations
    if (hasOverdueBooks($userId)) return ['success' => false, 'message' => 'Cannot borrow: You have overdue books'];
    if (countBorrowedBooks($userId) >= MAX_BORROWED) return ['success' => false, 'message' => 'Cannot borrow: Maximum limit reached'];
    if (getBorrowedEntry($bookId, $userId)) return ['success' => false, 'message' => 'You already have this book borrowed'];
    
    // Check inventory (copies and current borrows)
    $inv = getBookInventory($bookId);
    if (!$inv) return ['success' => false, 'message' => 'Book not found'];

    $freeCopies = $inv['free'];

    // If a copy is marked READY for another user, block borrowing by others
    $stmt = $db->prepare("SELECT COUNT(*) FROM reservations WHERE book_id = :bid AND user_id != :uid AND status = 'ready'");
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $readyForOthers = (int)$stmt->execute()->fetchArray()[0];

    if ($readyForOthers > 0) {
        return ['success' => false, 'message' => 'This book is reserved for another user'];
    }

    if ($freeCopies <= 0) {
        return ['success' => false, 'message' => 'No copies available'];
    }
    
    $borrowDate = date('Y-m-d');
    $dueDate = date('Y-m-d', strtotime("+".LOAN_DAYS." days"));
    
    // Transaction
    $db->exec('BEGIN');
    try {
        // Insert borrow record
        $stmt = $db->prepare("INSERT INTO borrowed (book_id, user_id, borrow_date, due_date, renewals_left) VALUES (:bid, :uid, :bdate, :ddate, :renews)");
        $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
        $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
        $stmt->bindValue(':bdate', $borrowDate, SQLITE3_TEXT);
        $stmt->bindValue(':ddate', $dueDate, SQLITE3_TEXT);
        $stmt->bindValue(':renews', MAX_RENEWALS, SQLITE3_INTEGER);
        $stmt->execute();

        // Recalculate availability based on copies, borrows, and reservations
        refreshBookAvailability($bookId);

        $db->exec('COMMIT');
        return [
            'success' => true, 
            'message' => 'Book borrowed successfully',
            'data' => ['dueDate' => $dueDate, 'renewalsLeft' => MAX_RENEWALS]
        ];
    } catch (Exception $e) {
        $db->exec('ROLLBACK');
        return ['success' => false, 'message' => 'Database error'];
    }
}

function returnBook($bookId, $userId) {
    global $db;
    
    $entry = getBorrowedEntry($bookId, $userId);
    if (!$entry) return ['success' => false, 'message' => 'Borrow record not found'];
    
    $today = date('Y-m-d');
    $overdue = $entry['due_date'] < $today;
    
    $db->exec('BEGIN');
    try {
        // Move to history
        $stmt = $db->prepare("INSERT INTO history (book_id, user_id, borrow_date, return_date, overdue) VALUES (:bid, :uid, :bdate, :rdate, :over)");
        $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
        $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
        $stmt->bindValue(':bdate', $entry['borrow_date'], SQLITE3_TEXT);
        $stmt->bindValue(':rdate', $today, SQLITE3_TEXT);
        $stmt->bindValue(':over', $overdue ? 1 : 0, SQLITE3_INTEGER);
        $stmt->execute();
        
        // Delete from borrowed
        $db->exec("DELETE FROM borrowed WHERE id = {$entry['id']}");

        // Handle reservations: move oldest waiting reservation (if any) to READY
        $res = $db->querySingle("SELECT id FROM reservations WHERE book_id = $bookId AND status = 'waiting' ORDER BY created_at ASC LIMIT 1", true);

        if ($res) {
            $db->exec("UPDATE reservations SET status = 'ready' WHERE id = {$res['id']}");
        }

        // Recalculate availability after return and any reservation updates
        refreshBookAvailability($bookId);

        $db->exec('COMMIT');
        return ['success' => true, 'message' => 'Book returned' . ($overdue ? ' (Overdue)' : ''), 'data' => ['overdue' => $overdue]];
    } catch (Exception $e) {
        $db->exec('ROLLBACK');
        return ['success' => false, 'message' => 'Database error: ' . $e->getMessage()];
    }
}

function renewBook($bookId, $userId) {
    global $db;
    
    $entry = getBorrowedEntry($bookId, $userId);
    if (!$entry) return ['success' => false, 'message' => 'Borrow record not found'];
    if ($entry['renewals_left'] <= 0) return ['success' => false, 'message' => 'No renewals left'];
    
    if (isReservedByOthers($bookId, $userId)) return ['success' => false, 'message' => 'Cannot renew: Reserved by another user'];
    
    $newDueDate = date('Y-m-d', strtotime($entry['due_date'] . " +".RENEW_DAYS." days"));
    $newRenewals = $entry['renewals_left'] - 1;
    
    $stmt = $db->prepare("UPDATE borrowed SET due_date = :dd, renewals_left = :rn WHERE id = :id");
    $stmt->bindValue(':dd', $newDueDate, SQLITE3_TEXT);
    $stmt->bindValue(':rn', $newRenewals, SQLITE3_INTEGER);
    $stmt->bindValue(':id', $entry['id'], SQLITE3_INTEGER);
    $stmt->execute();
    
    return ['success' => true, 'message' => 'Book renewed', 'data' => ['newDueDate' => $newDueDate, 'renewalsLeft' => $newRenewals]];
}

function getBookBorrowers($bookId) {
    global $db;

    $stmt = $db->prepare("
        SELECT b.*, u.full_name, u.username, u.email
        FROM borrowed b
        JOIN users u ON b.user_id = u.id
        WHERE b.book_id = :bid
    ");
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $result = $stmt->execute();

    $today = date('Y-m-d');
    $data = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $overdue = $row['due_date'] < $today;
        $data[] = [
            'id' => (int)$row['id'],
            'bookId' => (int)$row['book_id'],
            'userId' => (int)$row['user_id'],
            'userName' => $row['full_name'] ?: $row['username'],
            'userEmail' => $row['email'],
            'borrowDate' => $row['borrow_date'],
            'dueDate' => $row['due_date'],
            'renewalsLeft' => isset($row['renewals_left']) ? (int)$row['renewals_left'] : null,
            'overdue' => $overdue
        ];
    }
    return $data;
}

function getUserBorrowed($userId) {
    global $db;
    $stmt = $db->prepare("
        SELECT b.*, k.title, k.author, k.cover, k.category 
        FROM borrowed b 
        JOIN books k ON b.book_id = k.id 
        WHERE b.user_id = :uid
    ");
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    
    $data = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        // Structure to match frontend expectation
        $item = [
            'id' => $row['id'],
            'bookId' => $row['book_id'],
            'userId' => $row['user_id'],
            'borrowDate' => $row['borrow_date'],
            'dueDate' => $row['due_date'],
            'renewalsLeft' => $row['renewals_left'],
            'book' => [
                'id' => $row['book_id'],
                'title' => $row['title'],
                'author' => $row['author'],
                'cover' => $row['cover'],
                'category' => $row['category']
            ]
        ];
        $data[] = $item;
    }
    return $data;
}

function pickupReservation($reservationId, $userId) {
    global $db;

    $today = date('Y-m-d');

    $stmt = $db->prepare("SELECT * FROM reservations WHERE id = :id AND user_id = :uid");
    $stmt->bindValue(':id', $reservationId, SQLITE3_INTEGER);
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $row = $stmt->execute()->fetchArray(SQLITE3_ASSOC);

    if (!$row) {
        return ['success' => false, 'message' => 'Reservation not found'];
    }

    if (strtolower($row['status']) !== 'ready') {
        return ['success' => false, 'message' => 'Reservation is not ready for pickup'];
    }

    if (!empty($row['pickup_date']) && $row['pickup_date'] < $today) {
        // Mark as expired and block pickup
        $db->exec("UPDATE reservations SET status = 'expired' WHERE id = {$row['id']}");
        refreshBookAvailability((int)$row['book_id']);
        return ['success' => false, 'message' => 'Reservation has expired'];
    }

    $bookId = (int)$row['book_id'];

    // Use the existing borrowBook logic so all validations apply
    $borrowResult = borrowBook($bookId, $userId);
    if (!$borrowResult['success']) {
        return $borrowResult;
    }

    // Mark reservation as completed so it no longer counts toward quotas or queues
    $db->exec("UPDATE reservations SET status = 'completed' WHERE id = {$row['id']}");

    return [
        'success' => true,
        'message' => 'Book picked up successfully',
        'data' => $borrowResult['data'] ?? null
    ];
}

// Handle Requests
setCorsHeaders();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$bookId = $input['bookId'] ?? $_GET['bookId'] ?? null;
$userId = $input['userId'] ?? $_GET['userId'] ?? null;
$reservationId = $input['reservationId'] ?? $_GET['reservationId'] ?? null;

try {
    switch ($action) {
        case 'borrow':
            if (!$bookId || !$userId) die(json_encode(['success' => false, 'message' => 'Missing IDs']));
            echo json_encode(borrowBook($bookId, $userId));
            break;
        case 'return':
            if (!$bookId || !$userId) die(json_encode(['success' => false, 'message' => 'Missing IDs']));
            echo json_encode(returnBook($bookId, $userId));
            break;
        case 'renew':
            if (!$bookId || !$userId) die(json_encode(['success' => false, 'message' => 'Missing IDs']));
            echo json_encode(renewBook($bookId, $userId));
            break;
        case 'pickup':
            if (!$reservationId || !$userId) die(json_encode(['success' => false, 'message' => 'Missing IDs']));
            echo json_encode(pickupReservation($reservationId, $userId));
            break;
        case 'bookBorrowers':
            if (!$bookId) die(json_encode(['success' => false, 'message' => 'Book ID required']));
            echo json_encode(['success' => true, 'data' => getBookBorrowers($bookId)]);
            break;
        case 'list':
        case '':
            if (!$userId) die(json_encode(['success' => false, 'message' => 'User ID required']));
            echo json_encode(['success' => true, 'data' => getUserBorrowed($userId)]);
            break;
        default: echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
