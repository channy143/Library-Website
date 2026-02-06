<?php
// Books API - SQLite
require_once 'config.php';

// Get database connection
$db = getDB();

// Handle API requests
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    switch ($method) {
        case 'GET':
            if (isset($_GET['id'])) {
                $stmt = $db->prepare("SELECT * FROM books WHERE id = :id");
                $stmt->bindValue(':id', $_GET['id'], SQLITE3_INTEGER);
                $result = $stmt->execute();
                $book = $result->fetchArray(SQLITE3_ASSOC);
                
                if ($book) {
                    // Attach rating summary
                    $ratingRow = $db->querySingle(
                        "SELECT AVG(rating) AS avg_rating, COUNT(*) AS rating_count FROM book_ratings WHERE book_id = " . (int)$book['id'],
                        true
                    );
                    $book['avg_rating'] = isset($ratingRow['avg_rating']) && $ratingRow['avg_rating'] !== null
                        ? round((float)$ratingRow['avg_rating'], 1)
                        : 0.0;
                    $book['rating_count'] = isset($ratingRow['rating_count'])
                        ? (int)$ratingRow['rating_count']
                        : 0;

                    // Normalize types for frontend compatibility
                    $book['available'] = (bool)$book['available'];
                    if (!isset($book['copies'])) {
                        $book['copies'] = 1;
                    } else {
                        $book['copies'] = (int)$book['copies'];
                    }
                    echo json_encode(['success' => true, 'data' => $book]);
                } else {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'Book not found']);
                }
            } else {
                // Include rating aggregates for catalog and admin dashboards
                $result = $db->query("
                    SELECT b.*, 
                           AVG(r.rating) AS avg_rating, 
                           COUNT(r.id) AS rating_count
                    FROM books b
                    LEFT JOIN book_ratings r ON r.book_id = b.id
                    GROUP BY b.id
                    ORDER BY b.id DESC
                ");
                $books = [];
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $row['available'] = (bool)$row['available'];
                    if (!isset($row['copies'])) {
                        $row['copies'] = 1;
                    } else {
                        $row['copies'] = (int)$row['copies'];
                    }

                    $row['avg_rating'] = isset($row['avg_rating']) && $row['avg_rating'] !== null
                        ? round((float)$row['avg_rating'], 1)
                        : 0.0;
                    $row['rating_count'] = isset($row['rating_count'])
                        ? (int)$row['rating_count']
                        : 0;

                    $books[] = $row;
                }
                echo json_encode(['success' => true, 'data' => $books]);
            }
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            
            if ($action === 'add' || !$action) {
                if (empty($input['title']) || empty($input['author'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Title and author required']);
                    exit;
                }
                
                $stmt = $db->prepare("
                    INSERT INTO books (title, author, category, cover, pdf, description, copies, available)
                    VALUES (:title, :author, :category, :cover, :pdf, :description, :copies, 1)
                ");
                
                $stmt->bindValue(':title', $input['title'], SQLITE3_TEXT);
                $stmt->bindValue(':author', $input['author'], SQLITE3_TEXT);
                $stmt->bindValue(':category', $input['category'] ?? 'General', SQLITE3_TEXT);
                $stmt->bindValue(':cover', $input['cover'] ?? '', SQLITE3_TEXT);
                $stmt->bindValue(':pdf', $input['pdf'] ?? null, SQLITE3_TEXT);
                $stmt->bindValue(':description', $input['description'] ?? '', SQLITE3_TEXT);
                $stmt->bindValue(':copies', isset($input['copies']) ? (int)$input['copies'] : 1, SQLITE3_INTEGER);
                
                $stmt->execute();
                $id = $db->lastInsertRowID();
                
                // Fetch the created book
                $created = $db->querySingle("SELECT * FROM books WHERE id = $id", true);
                $created['available'] = true;
                if (!isset($created['copies'])) {
                    $created['copies'] = 1;
                } else {
                    $created['copies'] = (int)$created['copies'];
                }
                
                echo json_encode(['success' => true, 'message' => 'Book added', 'data' => $created]);
            }
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = $_GET['id'] ?? $input['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Book ID required']);
                exit;
            }
            
            // Build dynamic update query (including availability flag and copies)
            $fields = [];
            $values = [];
            foreach (['title', 'author', 'category', 'cover', 'pdf', 'description', 'copies', 'available'] as $field) {
                if (isset($input[$field])) {
                    $fields[] = "$field = :$field";
                    $values[":$field"] = $input[$field];
                }
            }
            
            if (empty($fields)) {
                echo json_encode(['success' => true, 'message' => 'No changes made']);
                exit;
            }
            
            $query = "UPDATE books SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
            foreach ($values as $param => $val) {
                // 'available' and 'copies' are stored as INTEGER, other fields as TEXT
                if ($param === ':available' || $param === ':copies') {
                    $stmt->bindValue($param, (int)$val, SQLITE3_INTEGER);
                } else {
                    $stmt->bindValue($param, $val, SQLITE3_TEXT);
                }
            }
            
            $stmt->execute();
            
            if ($db->changes() > 0) {
                echo json_encode(['success' => true, 'message' => 'Book updated']);
            } else {
                // Check if book exists
                $exists = $db->querySingle("SELECT COUNT(*) FROM books WHERE id = $id");
                if ($exists) {
                    echo json_encode(['success' => true, 'message' => 'No changes made']);
                } else {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'Book not found']);
                }
            }
            break;
            
        case 'DELETE':
            $id = $_GET['id'] ?? null;
            
            if (!$id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Book ID required']);
                exit;
            }
            
            $stmt = $db->prepare("DELETE FROM books WHERE id = :id");
            $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
            $stmt->execute();
            
            if ($db->changes() > 0) {
                echo json_encode(['success' => true, 'message' => 'Book deleted']);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Book not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
