<?php
// Ratings API - SQLite
require_once 'config.php';

$db = getDB();
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$input  = json_decode(file_get_contents('php://input'), true) ?: [];
$userId = $input['userId'] ?? ($_GET['userId'] ?? null);
$bookId = $input['bookId'] ?? ($_GET['bookId'] ?? null);

function getBookRatingSummary($bookId, $userId = null) {
    global $db;

    $stmt = $db->prepare("SELECT AVG(rating) AS avg_rating, COUNT(*) AS rating_count FROM book_ratings WHERE book_id = :bid");
    $stmt->bindValue(':bid', (int)$bookId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC) ?: ['avg_rating' => null, 'rating_count' => 0];

    $avg   = $row['avg_rating'] !== null ? round((float)$row['avg_rating'], 1) : 0.0;
    $count = (int)($row['rating_count'] ?? 0);

    $userRating = null;
    $userReview = null;

    if ($userId) {
        $userStmt = $db->prepare("SELECT rating, review FROM book_ratings WHERE book_id = :bid AND user_id = :uid LIMIT 1");
        $userStmt->bindValue(':bid', (int)$bookId, SQLITE3_INTEGER);
        $userStmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
        $userResult = $userStmt->execute();
        if ($userRow = $userResult->fetchArray(SQLITE3_ASSOC)) {
            $userRating = isset($userRow['rating']) ? (int)$userRow['rating'] : null;
            $userReview = $userRow['review'] ?? null;
        }
    }

    return [
        'bookId'        => (int)$bookId,
        'averageRating' => $avg,
        'ratingCount'   => $count,
        'userRating'    => $userRating,
        'userReview'    => $userReview,
    ];
}

try {
    switch ($action) {
        case 'rate':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['success' => false, 'message' => 'Method not allowed']);
                break;
            }

            if (!$userId || !$bookId || !isset($input['rating'])) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID, Book ID and rating are required']);
                break;
            }

            $rating = (int)$input['rating'];
            if ($rating < 1 || $rating > 5) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Rating must be between 1 and 5']);
                break;
            }

            $review = isset($input['review']) ? trim($input['review']) : null;
            if ($review !== null && $review !== '') {
                // Keep reviews reasonably short
                $review = mb_substr($review, 0, 1000);
            } else {
                $review = null;
            }

            $stmt = $db->prepare("
                INSERT INTO book_ratings (user_id, book_id, rating, review, created_at, updated_at)
                VALUES (:uid, :bid, :rating, :review, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, book_id) DO UPDATE SET
                    rating = excluded.rating,
                    review = excluded.review,
                    updated_at = CURRENT_TIMESTAMP
            ");
            $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
            $stmt->bindValue(':bid', (int)$bookId, SQLITE3_INTEGER);
            $stmt->bindValue(':rating', $rating, SQLITE3_INTEGER);
            $stmt->bindValue(':review', $review, SQLITE3_TEXT);
            $stmt->execute();

            $summary = getBookRatingSummary($bookId, $userId);
            echo json_encode(['success' => true, 'message' => 'Rating saved', 'data' => $summary]);
            break;

        case 'book':
            if (!$bookId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Book ID required']);
                break;
            }
            $summary = getBookRatingSummary($bookId, $userId);
            echo json_encode(['success' => true, 'data' => $summary]);
            break;

        case 'user':
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                break;
            }

            $stmt = $db->prepare("
                SELECT r.*, b.title, b.author, b.cover, b.category
                FROM book_ratings r
                JOIN books b ON r.book_id = b.id
                WHERE r.user_id = :uid
                ORDER BY r.updated_at DESC
            ");
            $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
            $result = $stmt->execute();

            $ratings = [];
            while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                $ratings[] = [
                    'id'           => $row['id'],
                    'bookId'       => $row['book_id'],
                    'userId'       => $row['user_id'],
                    'rating'       => (int)$row['rating'],
                    'review'       => $row['review'],
                    'updatedAt'    => $row['updated_at'],
                    'book'         => [
                        'title'    => $row['title'],
                        'author'   => $row['author'],
                        'cover'    => $row['cover'],
                        'category' => $row['category']
                    ]
                ];
            }

            echo json_encode(['success' => true, 'data' => $ratings]);
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
