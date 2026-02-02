<?php
// Recently Read API - SQLite
require_once 'config.php';

$db = getDB();
setCorsHeaders();

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$userId = $input['userId'] ?? $_GET['userId'] ?? null;
$bookId = $input['bookId'] ?? $_GET['bookId'] ?? null;

function trackRecent($userId, $bookId, $lastPage = null) {
    global $db;

    $check = $db->prepare('SELECT id FROM recently_read_books WHERE user_id = :uid AND book_id = :bid LIMIT 1');
    $check->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
    $check->bindValue(':bid', (int)$bookId, SQLITE3_INTEGER);
    $row = $check->execute()->fetchArray(SQLITE3_ASSOC);

    $now = date('Y-m-d H:i:s');

    if ($row && isset($row['id'])) {
        $stmt = $db->prepare('UPDATE recently_read_books SET last_read_page = :page, last_read_date = :dt WHERE id = :id');
        $stmt->bindValue(':id', (int)$row['id'], SQLITE3_INTEGER);
    } else {
        $stmt = $db->prepare('INSERT INTO recently_read_books (user_id, book_id, last_read_page, last_read_date) VALUES (:uid, :bid, :page, :dt)');
        $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
        $stmt->bindValue(':bid', (int)$bookId, SQLITE3_INTEGER);
    }

    $pageVal = $lastPage !== null ? (int)$lastPage : 0;
    $stmt->bindValue(':page', $pageVal, SQLITE3_INTEGER);
    $stmt->bindValue(':dt', $now, SQLITE3_TEXT);
    $stmt->execute();

    return ['success' => true, 'message' => 'Reading progress saved'];
}

function listRecent($userId) {
    global $db;
    $stmt = $db->prepare('SELECT r.*, b.title, b.author, b.category, b.cover FROM recently_read_books r JOIN books b ON r.book_id = b.id WHERE r.user_id = :uid ORDER BY r.last_read_date DESC LIMIT 50');
    $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
    $result = $stmt->execute();

    $items = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $items[] = $row;
    }
    return $items;
}

function removeRecent($userId, $bookId) {
    global $db;
    $stmt = $db->prepare('DELETE FROM recently_read_books WHERE user_id = :uid AND book_id = :bid');
    $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
    $stmt->bindValue(':bid', (int)$bookId, SQLITE3_INTEGER);
    $stmt->execute();
    return ['success' => true, 'message' => 'Removed from recently read'];
}

try {
    switch ($action) {
        case 'track':
            if (!$userId || !$bookId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID and Book ID required']);
                break;
            }
            $page = $input['lastPage'] ?? $input['last_read_page'] ?? null;
            echo json_encode(trackRecent($userId, $bookId, $page));
            break;

        case 'remove':
            if (!$userId || !$bookId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID and Book ID required']);
                break;
            }
            echo json_encode(removeRecent($userId, $bookId));
            break;

        case 'list':
        case '':
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                break;
            }
            echo json_encode(['success' => true, 'data' => listRecent($userId)]);
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
