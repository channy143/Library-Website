<?php
// History API - SQLite
require_once 'config.php';
$db = getDB();

function getUserHistory($userId) {
    global $db;
    $stmt = $db->prepare("
        SELECT h.*, b.title, b.author, b.cover, b.category, r.rating AS user_rating
        FROM history h
        JOIN books b ON h.book_id = b.id
        LEFT JOIN book_ratings r ON r.book_id = h.book_id AND r.user_id = h.user_id
        WHERE h.user_id = :uid
        ORDER BY h.return_date DESC
    ");
    $stmt->bindValue(':uid', $userId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    
    $data = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $data[] = [
            'id' => $row['id'],
            'bookId' => $row['book_id'],
            'userId' => $row['user_id'],
            'borrowDate' => $row['borrow_date'],
            'returnDate' => $row['return_date'],
            'overdue' => (bool)$row['overdue'],
            'rating' => isset($row['user_rating']) ? (int)$row['user_rating'] : null,
            'book' => [
                'title' => $row['title'],
                'author' => $row['author'],
                'cover' => $row['cover'],
                'category' => $row['category']
            ]
        ];
    }
    return $data;
}

function getUserStats($userId) {
    global $db;
    
    // Total Books
    $total = $db->querySingle("SELECT COUNT(*) FROM history WHERE user_id = $userId");
    
    // Overdue count
    $overdue = $db->querySingle("SELECT COUNT(*) FROM history WHERE user_id = $userId AND overdue = 1");
    
    // Most read category
    $catResult = $db->query("
        SELECT k.category, COUNT(*) as count 
        FROM history h 
        JOIN books k ON h.book_id = k.id 
        WHERE h.user_id = $userId 
        GROUP BY k.category 
        ORDER BY count DESC
    ");
    
    $categories = [];
    $mostRead = '-';
    while ($row = $catResult->fetchArray(SQLITE3_ASSOC)) {
        $categories[$row['category']] = $row['count'];
        if ($mostRead === '-') $mostRead = $row['category'];
    }
    
    return [
        'totalBooks' => $total ?: 0,
        'overdueCount' => $overdue ?: 0,
        'mostReadCategory' => $mostRead,
        'categories' => $categories
    ];
}

function getFullStats($userId) {
    global $db;
    
    $basicStats = getUserStats($userId);
    
    // Monthly reading stats (last 12 months)
    $monthlyResult = $db->query("
        SELECT strftime('%Y-%m', return_date) as month, COUNT(*) as count
        FROM history
        WHERE user_id = $userId
        AND return_date >= date('now', '-12 months')
        GROUP BY strftime('%Y-%m', return_date)
        ORDER BY month DESC
    ");
    
    $monthlyReading = [];
    while ($row = $monthlyResult->fetchArray(SQLITE3_ASSOC)) {
        $monthlyReading[] = [
            'month' => $row['month'],
            'count' => (int)$row['count']
        ];
    }
    
    // Average reading time (days between borrow and return)
    $avgDays = $db->querySingle("
        SELECT AVG(julianday(return_date) - julianday(borrow_date)) 
        FROM history 
        WHERE user_id = $userId
    ");
    
    // Overdue percentage
    $total = $basicStats['totalBooks'];
    $overduePercent = $total > 0 ? round(($basicStats['overdueCount'] / $total) * 100, 1) : 0;
    
    // Currently borrowed count
    $currentBorrowed = $db->querySingle("SELECT COUNT(*) FROM borrowed WHERE user_id = $userId");
    
    // Active reservations
    $reservations = $db->querySingle("SELECT COUNT(*) FROM reservations WHERE user_id = $userId AND status IN ('waiting', 'ready')");
    
    return [
        'totalBooks' => $basicStats['totalBooks'],
        'overdueCount' => $basicStats['overdueCount'],
        'overduePercentage' => $overduePercent,
        'mostReadCategory' => $basicStats['mostReadCategory'],
        'categories' => $basicStats['categories'],
        'monthlyReading' => $monthlyReading,
        'avgReadingDays' => $avgDays ? round($avgDays, 1) : 0,
        'currentBorrowed' => $currentBorrowed ?: 0,
        'activeReservations' => $reservations ?: 0
    ];
}

function getAdminStats() {
    global $db;
    
    // Overall library stats
    $totalBooks = $db->querySingle("SELECT COUNT(*) FROM books");
    $totalUsers = $db->querySingle("SELECT COUNT(*) FROM users");
    $totalLoans = $db->querySingle("SELECT COUNT(*) FROM history");
    $activeBorrows = $db->querySingle("SELECT COUNT(*) FROM borrowed");
    $activeReservations = $db->querySingle("SELECT COUNT(*) FROM reservations WHERE status IN ('waiting', 'ready')");
    
    // Monthly loans (last 6 months)
    $monthlyResult = $db->query("
        SELECT strftime('%Y-%m', return_date) as month, COUNT(*) as count
        FROM history
        WHERE return_date >= date('now', '-6 months')
        GROUP BY strftime('%Y-%m', return_date)
        ORDER BY month DESC
    ");
    
    $monthlyLoans = [];
    while ($row = $monthlyResult->fetchArray(SQLITE3_ASSOC)) {
        $monthlyLoans[] = ['month' => $row['month'], 'count' => (int)$row['count']];
    }
    
    // Top categories
    $catResult = $db->query("
        SELECT b.category, COUNT(*) as count
        FROM history h
        JOIN books b ON h.book_id = b.id
        GROUP BY b.category
        ORDER BY count DESC
        LIMIT 5
    ");
    
    $topCategories = [];
    while ($row = $catResult->fetchArray(SQLITE3_ASSOC)) {
        $topCategories[] = ['category' => $row['category'], 'count' => (int)$row['count']];
    }
    
    // Most borrowed books
    $topBooksResult = $db->query("
        SELECT b.title, b.author, COUNT(*) as count
        FROM history h
        JOIN books b ON h.book_id = b.id
        GROUP BY h.book_id
        ORDER BY count DESC
        LIMIT 5
    ");
    
    $topBooks = [];
    while ($row = $topBooksResult->fetchArray(SQLITE3_ASSOC)) {
        $topBooks[] = ['title' => $row['title'], 'author' => $row['author'], 'count' => (int)$row['count']];
    }
    
    return [
        'totalBooks' => $totalBooks ?: 0,
        'totalUsers' => $totalUsers ?: 0,
        'totalLoans' => $totalLoans ?: 0,
        'activeBorrows' => $activeBorrows ?: 0,
        'activeReservations' => $activeReservations ?: 0,
        'monthlyLoans' => $monthlyLoans,
        'topCategories' => $topCategories,
        'topBooks' => $topBooks
    ];
}

setCorsHeaders();
$action = $_GET['action'] ?? '';
$userId = $_GET['userId'] ?? null;

try {
    switch ($action) {
        case 'stats':
            if (!$userId) {
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                exit;
            }
            echo json_encode(['success' => true, 'data' => getUserStats($userId)]);
            break;
            
        case 'fullStats':
            if (!$userId) {
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                exit;
            }
            echo json_encode(['success' => true, 'data' => getFullStats($userId)]);
            break;
            
        case 'adminStats':
            echo json_encode(['success' => true, 'data' => getAdminStats()]);
            break;
            
        default:
            if (!$userId) {
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                exit;
            }
            echo json_encode(['success' => true, 'data' => getUserHistory($userId)]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>

