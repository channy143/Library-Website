<?php
// Users API - SQLite
// Admin user management endpoint
require_once 'config.php';

$db = getDB();
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = $_GET['id'] ?? null;

// Get user stats (borrowed count, history count, etc.)
function getUserStats($userId) {
    global $db;
    
    $borrowed = $db->querySingle("SELECT COUNT(*) FROM borrowed WHERE user_id = $userId");
    $historyCount = $db->querySingle("SELECT COUNT(*) FROM history WHERE user_id = $userId");
    $overdueCount = $db->querySingle("SELECT COUNT(*) FROM history WHERE user_id = $userId AND overdue = 1");
    $reservations = $db->querySingle("SELECT COUNT(*) FROM reservations WHERE user_id = $userId AND status IN ('waiting', 'ready')");
    
    // Get latest activity from history or borrowed
    $latestHistory = $db->querySingle("SELECT return_date FROM history WHERE user_id = $userId ORDER BY return_date DESC LIMIT 1");
    $latestBorrow = $db->querySingle("SELECT borrow_date FROM borrowed WHERE user_id = $userId ORDER BY borrow_date DESC LIMIT 1");
    
    $lastActivity = null;
    if ($latestHistory && $latestBorrow) {
        $lastActivity = max($latestHistory, $latestBorrow);
    } else {
        $lastActivity = $latestHistory ?: $latestBorrow;
    }
    
    return [
        'borrowedCount' => $borrowed ?: 0,
        'totalBooks' => $historyCount ?: 0,
        'overdueCount' => $overdueCount ?: 0,
        'reservationCount' => $reservations ?: 0,
        'lastActivity' => $lastActivity
    ];
}

// Get admin statistics
function getAdminStats() {
    global $db;
    
    $totalUsers = $db->querySingle("SELECT COUNT(*) FROM users");
    // Active users are those with explicit active status
    $activeUsers = $db->querySingle("SELECT COUNT(*) FROM users WHERE status = 'active'");
    // Only two roles are used in this project: admin and user
    $adminCount = $db->querySingle("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    $totalBooks = $db->querySingle("SELECT COUNT(*) FROM books");
    $checkedOut = $db->querySingle("SELECT COUNT(*) FROM borrowed");
    $totalReservations = $db->querySingle("SELECT COUNT(*) FROM reservations WHERE status IN ('waiting', 'ready')");
    
    // Books by category
    $catResult = $db->query("SELECT category, COUNT(*) as count FROM books GROUP BY category");
    $categories = [];
    while ($row = $catResult->fetchArray(SQLITE3_ASSOC)) {
        $categories[$row['category']] = $row['count'];
    }
    
    return [
        'totalUsers' => $totalUsers ?: 0,
        'activeUsers' => $activeUsers ?: 0,
        'adminCount' => $adminCount ?: 0,
        'totalBooks' => $totalBooks ?: 0,
        'checkedOut' => $checkedOut ?: 0,
        'reservations' => $totalReservations ?: 0,
        'categories' => $categories
    ];
}

try {
    switch ($method) {
        case 'GET':
            if ($action === 'stats') {
                // Admin stats endpoint
                echo json_encode(['success' => true, 'data' => getAdminStats()]);
            } elseif ($id) {
                // Get single user
                $stmt = $db->prepare("SELECT id, username, email, full_name, role, status, created_at FROM users WHERE id = :id");
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
                $result = $stmt->execute();
                $user = $result->fetchArray(SQLITE3_ASSOC);
                
                if ($user) {
                    $stats = getUserStats($user['id']);
                    $user['stats'] = $stats;
                    echo json_encode(['success' => true, 'data' => $user]);
                } else {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'User not found']);
                }
            } else {
                // List all users
                $result = $db->query("SELECT id, username, email, full_name, role, status, created_at FROM users ORDER BY created_at DESC");
                $users = [];
                while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
                    $stats = getUserStats($row['id']);
                    $row['stats'] = $stats;
                    // Default to active if status is missing
                    if (!isset($row['status']) || $row['status'] === '') {
                        $row['status'] = 'active';
                    }
                    $users[] = $row;
                }
                echo json_encode(['success' => true, 'data' => $users]);
            }
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $updateId = $id ?: ($input['id'] ?? null);
            
            if (!$updateId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                exit;
            }
            
            // Build dynamic update
            $fields = [];
            $values = [];
            
            if (isset($input['full_name'])) {
                $fields[] = "full_name = :full_name";
                $values[':full_name'] = $input['full_name'];
            }
            if (isset($input['email'])) {
                $fields[] = "email = :email";
                $values[':email'] = $input['email'];
            }
            if (isset($input['role'])) {
                $fields[] = "role = :role";
                $values[':role'] = $input['role'];
            }
            if (isset($input['status'])) {
                $fields[] = "status = :status";
                $values[':status'] = $input['status'];
            }
            if (isset($input['username'])) {
                $fields[] = "username = :username";
                $values[':username'] = $input['username'];
            }
            
            if (empty($fields)) {
                echo json_encode(['success' => true, 'message' => 'No changes made']);
                exit;
            }
            
            $fields[] = "updated_at = :updated_at";
            $values[':updated_at'] = date('Y-m-d H:i:s');
            
            $query = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = :id";
            $stmt = $db->prepare($query);
            $stmt->bindValue(':id', $updateId, SQLITE3_INTEGER);
            foreach ($values as $param => $val) {
                $stmt->bindValue($param, $val, SQLITE3_TEXT);
            }
            
            $stmt->execute();
            
            if ($db->changes() > 0) {
                echo json_encode(['success' => true, 'message' => 'User updated']);
            } else {
                echo json_encode(['success' => true, 'message' => 'No changes made']);
            }
            break;
            
        case 'DELETE':
            if (!$id) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                exit;
            }
            
            // Delete related records first (borrowed, reservations, wishlist, history)
            $db->exec('BEGIN');
            try {
                $db->exec("DELETE FROM borrowed WHERE user_id = $id");
                $db->exec("DELETE FROM reservations WHERE user_id = $id");
                $db->exec("DELETE FROM wishlist WHERE user_id = $id");
                $db->exec("DELETE FROM history WHERE user_id = $id");
                
                $stmt = $db->prepare("DELETE FROM users WHERE id = :id");
                $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
                $stmt->execute();
                
                $db->exec('COMMIT');
                
                if ($db->changes() > 0) {
                    echo json_encode(['success' => true, 'message' => 'User deleted']);
                } else {
                    http_response_code(404);
                    echo json_encode(['success' => false, 'message' => 'User not found']);
                }
            } catch (Exception $e) {
                $db->exec('ROLLBACK');
                throw $e;
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
