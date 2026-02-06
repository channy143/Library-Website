<?php
// Favorites API - SQLite
require_once 'config.php';

$db = getDB();
setCorsHeaders();

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$userId = $input['userId'] ?? $_GET['userId'] ?? null;
$bookId = $input['bookId'] ?? $_GET['bookId'] ?? null;

function addFavorite($userId, $bookId) {
    global $db;
    $stmt = $db->prepare("INSERT OR IGNORE INTO favorite_books (user_id, book_id) VALUES (:uid, :bid)");
    $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
    $stmt->bindValue(':bid', (int)$bookId, SQLITE3_INTEGER);
    $stmt->execute();
    return ['success' => true, 'message' => 'Added to favorites'];
}

function removeFavorite($userId, $bookId) {
    global $db;
    $stmt = $db->prepare("DELETE FROM favorite_books WHERE user_id = :uid AND book_id = :bid");
    $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
    $stmt->bindValue(':bid', (int)$bookId, SQLITE3_INTEGER);
    $stmt->execute();
    return ['success' => true, 'message' => 'Removed from favorites'];
}

function listFavorites($userId) {
    global $db;
    $stmt = $db->prepare("SELECT b.* FROM favorite_books f JOIN books b ON f.book_id = b.id WHERE f.user_id = :uid ORDER BY f.added_date DESC");
    $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
    $result = $stmt->execute();

    $books = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $books[] = $row;
    }
    return $books;
}

try {
    switch ($action) {
        case 'add':
            if (!$userId || !$bookId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID and Book ID required']);
                break;
            }
            echo json_encode(addFavorite($userId, $bookId));
            break;

        case 'remove':
            if (!$userId || !$bookId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID and Book ID required']);
                break;
            }
            echo json_encode(removeFavorite($userId, $bookId));
            break;

        case 'list':
        case '':
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                break;
            }
            echo json_encode(['success' => true, 'data' => listFavorites($userId)]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
