<?php
// Notifications API - uses admin_notifications table for simple user-facing alerts
require_once 'config.php';

$db = getDB();
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: [];

$userId = $input['userId'] ?? ($_GET['userId'] ?? null);
$targetUserId = $input['targetUserId'] ?? ($_GET['targetUserId'] ?? null);
$requesterUserId = $input['requesterUserId'] ?? ($_GET['requesterUserId'] ?? null);
$bookId = $input['bookId'] ?? ($_GET['bookId'] ?? null);
$bookTitleOverride = $input['bookTitle'] ?? null;
$notificationId = $input['id'] ?? ($_GET['id'] ?? null);

function createBorrowerNudge($targetUserId, $requesterUserId, $bookId, $bookTitleOverride = null)
{
    global $db;

    $targetUserId = (int)$targetUserId;
    $requesterUserId = (int)$requesterUserId;
    $bookId = (int)$bookId;

    // Look up requester name
    $reqStmt = $db->prepare('SELECT full_name, username FROM users WHERE id = :id');
    $reqStmt->bindValue(':id', $requesterUserId, SQLITE3_INTEGER);
    $reqRow = $reqStmt->execute()->fetchArray(SQLITE3_ASSOC) ?: null;
    $requesterName = $reqRow && ($reqRow['full_name'] ?? '') !== ''
        ? $reqRow['full_name']
        : ($reqRow['username'] ?? ('User #' . $requesterUserId));

    // Look up book title (unless caller already provided one)
    $title = $bookTitleOverride;
    if (!$title && $bookId) {
        $bStmt = $db->prepare('SELECT title FROM books WHERE id = :bid');
        $bStmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
        $bRow = $bStmt->execute()->fetchArray(SQLITE3_ASSOC) ?: null;
        if ($bRow && isset($bRow['title'])) {
            $title = $bRow['title'];
        }
    }

    if (!$title) {
        $title = 'a book you borrowed';
    }

    $message = sprintf(
        '%s has requested that you return "%s" so they can borrow it. Your loan is already overdue.',
        $requesterName,
        $title
    );

    $stmt = $db->prepare('INSERT INTO admin_notifications (user_id, book_id, notification_type, message, is_read) VALUES (:uid, :bid, :type, :msg, 0)');
    $stmt->bindValue(':uid', $targetUserId, SQLITE3_INTEGER);
    $stmt->bindValue(':bid', $bookId, SQLITE3_INTEGER);
    $stmt->bindValue(':type', 'borrower_nudge', SQLITE3_TEXT);
    $stmt->bindValue(':msg', $message, SQLITE3_TEXT);
    $stmt->execute();

    return ['success' => true, 'message' => 'Notification created'];
}

function listNotificationsForUser($userId)
{
    global $db;
    $stmt = $db->prepare('SELECT n.id, n.book_id, n.notification_type, n.message, n.created_at, b.title
        FROM admin_notifications n
        LEFT JOIN books b ON b.id = n.book_id
        WHERE n.user_id = :uid AND n.is_read = 0
        ORDER BY n.created_at DESC');
    $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
    $result = $stmt->execute();

    $rows = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $rows[] = $row;
    }
    return $rows;
}

function markNotificationRead($notificationId, $userId)
{
    global $db;
    $stmt = $db->prepare('UPDATE admin_notifications SET is_read = 1 WHERE id = :id AND user_id = :uid');
    $stmt->bindValue(':id', (int)$notificationId, SQLITE3_INTEGER);
    $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
    $stmt->execute();
    return ['success' => true];
}

try {
    switch ($action) {
        case 'borrowerNudge':
            if (!$targetUserId || !$requesterUserId || !$bookId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'targetUserId, requesterUserId and bookId are required']);
                break;
            }
            echo json_encode(createBorrowerNudge($targetUserId, $requesterUserId, $bookId, $bookTitleOverride));
            break;

        case 'listForUser':
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                break;
            }
            echo json_encode(['success' => true, 'data' => listNotificationsForUser($userId)]);
            break;

        case 'markRead':
            if (!$notificationId || !$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Notification ID and User ID required']);
                break;
            }
            echo json_encode(markNotificationRead($notificationId, $userId));
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
