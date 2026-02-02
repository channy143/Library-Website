<?php
// Wishlist API - SQLite
require_once 'config.php';
$db = getDB();

function addToWishlist($bookId, $userId) {
    global $db;
    try {
        $stmt = $db->prepare("INSERT OR IGNORE INTO wishlist (user_id, book_id) VALUES (:uid, :bid)");
        $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
        $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
        $stmt->execute();
        return ['success' => true, 'message' => 'Added to wishlist'];
    } catch (Exception $e) {
        return ['success' => false, 'message' => 'Error adding to wishlist'];
    }
}

function removeFromWishlist($bookId, $userId) {
    global $db;
    $stmt = $db->prepare("DELETE FROM wishlist WHERE user_id = :uid AND book_id = :bid");
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $stmt->execute();
    return ['success' => true, 'message' => 'Removed from wishlist'];
}

function getWishlist($userId) {
    global $db;
    $stmt = $db->prepare("
        SELECT b.* 
        FROM wishlist w 
        JOIN books b ON w.book_id = b.id 
        WHERE w.user_id = :uid
    ");
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    
    $books = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $books[] = $row;
    }
    return $books;
}

setCorsHeaders();
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$userId = $input['userId'] ?? $_GET['userId'] ?? null;
$bookId = $input['bookId'] ?? $_GET['bookId'] ?? null;

switch ($action) {
    case 'add':
        if (!$bookId || !$userId) die(json_encode(['success'=>false]));
        echo json_encode(addToWishlist($bookId, $userId));
        break;
    case 'remove':
        if (!$bookId || !$userId) die(json_encode(['success'=>false]));
        echo json_encode(removeFromWishlist($bookId, $userId));
        break;
    case 'list':
    case '':
        if (!$userId) die(json_encode(['success'=>false]));
        echo json_encode(['success'=>true, 'data'=>getWishlist($userId)]);
        break;
    default: echo json_encode(['success'=>false]);
}
?>
