<?php
// Recommendations API - SQLite
// Generates personalized book recommendations for users
require_once 'config.php';

$db = getDB();
setCorsHeaders();

$userId = $_GET['userId'] ?? null;

if (!$userId) {
    echo json_encode(['success' => false, 'message' => 'User ID required']);
    exit;
}

try {
    // Get user's favorite categories from history
    $favCatResult = $db->query("
        SELECT b.category, COUNT(*) as count
        FROM history h
        JOIN books b ON h.book_id = b.id
        WHERE h.user_id = $userId
        GROUP BY b.category
        ORDER BY count DESC
        LIMIT 3
    ");
    
    $favoriteCategories = [];
    while ($row = $favCatResult->fetchArray(SQLITE3_ASSOC)) {
        $favoriteCategories[] = $row['category'];
    }
    
    // Get books user has already read or borrowed
    $readBooks = [];
    $readResult = $db->query("SELECT book_id FROM history WHERE user_id = $userId");
    while ($row = $readResult->fetchArray(SQLITE3_ASSOC)) {
        $readBooks[] = $row['book_id'];
    }
    $borrowedResult = $db->query("SELECT book_id FROM borrowed WHERE user_id = $userId");
    while ($row = $borrowedResult->fetchArray(SQLITE3_ASSOC)) {
        $readBooks[] = $row['book_id'];
    }
    $readBooks = array_unique($readBooks);
    $excludeIds = empty($readBooks) ? '0' : implode(',', $readBooks);
    
    // 1. Based on reading history (same category as favorites)
    $basedOnHistory = [];
    if (!empty($favoriteCategories)) {
        $categories = "'" . implode("','", $favoriteCategories) . "'";
        $historyResult = $db->query("
            SELECT id, title, author, category, cover, available
            FROM books
            WHERE category IN ($categories)
            AND id NOT IN ($excludeIds)
            ORDER BY RANDOM()
            LIMIT 4
        ");
        while ($row = $historyResult->fetchArray(SQLITE3_ASSOC)) {
            $basedOnHistory[] = [
                'id' => $row['id'],
                'title' => $row['title'],
                'author' => $row['author'],
                'category' => $row['category'],
                'cover' => $row['cover'],
                'available' => (bool)$row['available']
            ];
        }
    }
    
    // 2. From wishlist - get wishlist categories and recommend similar
    $wishlistCats = [];
    $wishlistResult = $db->query("
        SELECT DISTINCT b.category
        FROM wishlist w
        JOIN books b ON w.book_id = b.id
        WHERE w.user_id = $userId
    ");
    while ($row = $wishlistResult->fetchArray(SQLITE3_ASSOC)) {
        $wishlistCats[] = $row['category'];
    }
    
    $fromWishlist = [];
    if (!empty($wishlistCats)) {
        $categories = "'" . implode("','", $wishlistCats) . "'";
        $wishResult = $db->query("
            SELECT b.id, b.title, b.author, b.category, b.cover, b.available
            FROM books b
            LEFT JOIN wishlist w ON b.id = w.book_id AND w.user_id = $userId
            WHERE b.category IN ($categories)
            AND b.id NOT IN ($excludeIds)
            AND w.id IS NULL
            ORDER BY RANDOM()
            LIMIT 4
        ");
        while ($row = $wishResult->fetchArray(SQLITE3_ASSOC)) {
            $fromWishlist[] = [
                'id' => $row['id'],
                'title' => $row['title'],
                'author' => $row['author'],
                'category' => $row['category'],
                'cover' => $row['cover'],
                'available' => (bool)$row['available']
            ];
        }
    }
    
    // 3. Trending books (most borrowed in last 30 days)
    $trendingResult = $db->query("
        SELECT b.id, b.title, b.author, b.category, b.cover, b.available, COUNT(*) as borrow_count
        FROM history h
        JOIN books b ON h.book_id = b.id
        WHERE h.return_date >= date('now', '-30 days')
        AND b.id NOT IN ($excludeIds)
        GROUP BY h.book_id
        ORDER BY borrow_count DESC
        LIMIT 4
    ");
    
    $trending = [];
    while ($row = $trendingResult->fetchArray(SQLITE3_ASSOC)) {
        $trending[] = [
            'id' => $row['id'],
            'title' => $row['title'],
            'author' => $row['author'],
            'category' => $row['category'],
            'cover' => $row['cover'],
            'available' => (bool)$row['available'],
            'borrowCount' => $row['borrow_count']
        ];
    }
    
    // If no trending, get popular all-time
    if (empty($trending)) {
        $trendingResult = $db->query("
            SELECT b.id, b.title, b.author, b.category, b.cover, b.available, COUNT(*) as borrow_count
            FROM history h
            JOIN books b ON h.book_id = b.id
            WHERE b.id NOT IN ($excludeIds)
            GROUP BY h.book_id
            ORDER BY borrow_count DESC
            LIMIT 4
        ");
        while ($row = $trendingResult->fetchArray(SQLITE3_ASSOC)) {
            $trending[] = [
                'id' => $row['id'],
                'title' => $row['title'],
                'author' => $row['author'],
                'category' => $row['category'],
                'cover' => $row['cover'],
                'available' => (bool)$row['available'],
                'borrowCount' => $row['borrow_count']
            ];
        }
    }
    
    // 4. New arrivals (recently added books)
    $newArrivalsResult = $db->query("
        SELECT id, title, author, category, cover, available, created_at
        FROM books
        WHERE id NOT IN ($excludeIds)
        ORDER BY created_at DESC
        LIMIT 4
    ");
    
    $newArrivals = [];
    while ($row = $newArrivalsResult->fetchArray(SQLITE3_ASSOC)) {
        $newArrivals[] = [
            'id' => $row['id'],
            'title' => $row['title'],
            'author' => $row['author'],
            'category' => $row['category'],
            'cover' => $row['cover'],
            'available' => (bool)$row['available']
        ];
    }
    
    // If user has no history, fill basedOnHistory with random available books
    if (empty($basedOnHistory)) {
        $randomResult = $db->query("
            SELECT id, title, author, category, cover, available
            FROM books
            WHERE available = 1
            AND id NOT IN ($excludeIds)
            ORDER BY RANDOM()
            LIMIT 4
        ");
        while ($row = $randomResult->fetchArray(SQLITE3_ASSOC)) {
            $basedOnHistory[] = [
                'id' => $row['id'],
                'title' => $row['title'],
                'author' => $row['author'],
                'category' => $row['category'],
                'cover' => $row['cover'],
                'available' => true
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'data' => [
            'basedOnHistory' => $basedOnHistory,
            'fromWishlist' => $fromWishlist,
            'trending' => $trending,
            'newArrivals' => $newArrivals,
            'favoriteCategories' => $favoriteCategories
        ]
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
