<?php
// Reserve API - SQLite
require_once 'config.php';
define('MAX_RESERVATIONS', 3);
$db = getDB();

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

function refreshBookAvailability($bookId) {
    global $db;

    $inv = getBookInventory($bookId);
    if (!$inv) return;

    $free = $inv['free'];

    $waitingCount = (int)$db->querySingle("SELECT COUNT(*) FROM reservations WHERE book_id = $bookId AND status = 'waiting'");
    $readyCount   = (int)$db->querySingle("SELECT COUNT(*) FROM reservations WHERE book_id = $bookId AND status = 'ready'");

    $available = ($free > 0 && $waitingCount === 0 && $readyCount === 0) ? 1 : 0;

    $stmt = $db->prepare("UPDATE books SET available = :avail WHERE id = :bid");
    $stmt->bindValue(':avail', $available, SQLITE3_INTEGER);
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $stmt->execute();
}

function cleanupExpiredReservations() {
    global $db;

    $today = date('Y-m-d');

    $stmt = $db->prepare("SELECT id, book_id FROM reservations WHERE status = 'ready' AND pickup_date < :today");
    $stmt->bindValue(':today', $today, SQLITE3_TEXT);
    $result = $stmt->execute();

    $expired = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $expired[] = $row;
    }

    foreach ($expired as $row) {
        $id = (int)$row['id'];
        $bookId = (int)$row['book_id'];
        $db->exec("UPDATE reservations SET status = 'expired' WHERE id = $id");
        refreshBookAvailability($bookId);
    }
}

function getQueuePosition($bookId) {
    global $db;
    $res = $db->querySingle("SELECT COUNT(*) FROM reservations WHERE book_id = $bookId AND status IN ('waiting', 'ready')");
    return $res + 1;
}

function reserveBook($bookId, $userId, $pickupDate) {
    global $db;
    
    // Checks
    $count = $db->querySingle("SELECT COUNT(*) FROM reservations WHERE user_id = $userId AND status IN ('waiting', 'ready')");
    if ($count >= MAX_RESERVATIONS) return ['success' => false, 'message' => 'Max reservations reached'];
    
    $exists = $db->querySingle("SELECT COUNT(*) FROM reservations WHERE book_id = $bookId AND user_id = $userId AND status IN ('waiting', 'ready')");
    if ($exists) return ['success' => false, 'message' => 'Already reserved'];
    
    // Create
    $queuePos = getQueuePosition($bookId);
    $pickupDate = $pickupDate ?: date('Y-m-d', strtotime('+7 days'));
    
    $stmt = $db->prepare("INSERT INTO reservations (book_id, user_id, pickup_date, queue_position, status) VALUES (:bid, :uid, :pd, :qp, 'waiting')");
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $stmt->bindValue(':pd', $pickupDate, SQLITE3_TEXT);
    $stmt->bindValue(':qp', $queuePos, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        return ['success' => true, 'message' => 'Reserved successfully', 'data' => ['queuePosition' => $queuePos]];
    }
    return ['success' => false, 'message' => 'Failed to reserve'];
}

function cancelReservation($resId, $userId) {
    global $db;
    $db->exec("UPDATE reservations SET status = 'cancelled' WHERE id = $resId AND user_id = $userId");
    // Could reorder queue here but simplified for now
    return ['success' => true, 'message' => 'Cancelled'];
}

function getUserReservations($userId) {
    global $db;
    $stmt = $db->prepare("
        SELECT r.*, b.title, b.author, b.cover 
        FROM reservations r 
        JOIN books b ON r.book_id = b.id 
        WHERE r.user_id = :uid AND r.status IN ('waiting', 'ready')
    ");
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    
    $data = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $data[] = [
            'id' => $row['id'],
            'bookId' => $row['book_id'],
            'userId' => $row['user_id'],
            'pickupDate' => $row['pickup_date'],
            'queuePosition' => $row['queue_position'],
            'status' => $row['status'],
            'book' => [
                'id' => $row['book_id'],
                'title' => $row['title'],
                'author' => $row['author'],
                'cover' => $row['cover']
            ]
        ];
    }
    return $data;
}

function getUserExpiredReservations($userId) {
    global $db;
    $stmt = $db->prepare("
        SELECT r.*, b.title, b.author, b.cover 
        FROM reservations r 
        JOIN books b ON r.book_id = b.id 
        WHERE r.user_id = :uid AND r.status = 'expired'
        ORDER BY r.pickup_date DESC, r.id DESC
    ");
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $result = $stmt->execute();

    $data = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $data[] = [
            'id' => $row['id'],
            'bookId' => $row['book_id'],
            'userId' => $row['user_id'],
            'pickupDate' => $row['pickup_date'],
            'queuePosition' => $row['queue_position'],
            'status' => $row['status'],
            'book' => [
                'id' => $row['book_id'],
                'title' => $row['title'],
                'author' => $row['author'],
                'cover' => $row['cover']
            ]
        ];
    }
    return $data;
}

setCorsHeaders();
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$userId = $input['userId'] ?? $_GET['userId'] ?? null;

cleanupExpiredReservations();

switch ($action) {
    case 'reserve':
        $bookId = $input['bookId'] ?? null;
        $pickup = $input['pickupDate'] ?? null;
        if (!$bookId || !$userId) die(json_encode(['success'=>false, 'message'=>'Missing IDs']));
        echo json_encode(reserveBook($bookId, $userId, $pickup));
        break;
    case 'cancel':
        $resId = $input['reservationId'] ?? null;
        if (!$resId || !$userId) die(json_encode(['success'=>false, 'message'=>'Missing IDs']));
        echo json_encode(cancelReservation($resId, $userId));
        break;
    case 'user':
    case '':
        if (!$userId) die(json_encode(['success'=>false, 'message'=>'User ID required']));
        echo json_encode(['success'=>true, 'data'=>getUserReservations($userId)]);
        break;
    case 'expired':
        if (!$userId) die(json_encode(['success'=>false, 'message'=>'User ID required']));
        echo json_encode(['success'=>true, 'data'=>getUserExpiredReservations($userId)]);
        break;
    default: echo json_encode(['success'=>false, 'message'=>'Invalid action']);
}
?>
