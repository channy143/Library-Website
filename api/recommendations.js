const { db, setCorsHeaders } = require('../lib/db');

function getRecommendations(userId, limit = 5) {
  // Get user's favorite categories based on history
  const userCategories = db.prepare(`
    SELECT b.category, COUNT(*) as count
    FROM history h
    JOIN books b ON h.book_id = b.id
    WHERE h.user_id = ?
    GROUP BY b.category
    ORDER BY count DESC
  `).all(userId);
  
  // Get user's favorite books
  const favoriteBooks = db.prepare(`
    SELECT book_id FROM favorite_books WHERE user_id = ?
  `).all(userId).map(r => r.book_id);
  
  // Get user's already borrowed/read books
  const readBooks = db.prepare(`
    SELECT book_id FROM history WHERE user_id = ?
    UNION
    SELECT book_id FROM borrowed WHERE user_id = ?
  `).all(userId, userId).map(r => r.book_id);
  
  // Get user's wishlist
  const wishlistBooks = db.prepare(`
    SELECT book_id FROM wishlist WHERE user_id = ?
  `).all(userId).map(r => r.book_id);
  
  // Books to exclude
  const excludeIds = [...new Set([...readBooks, ...wishlistBooks])];
  
  let recommendedBooks = [];
  
  if (userCategories.length > 0) {
    // Get books from user's favorite categories
    const topCategories = userCategories.slice(0, 3).map(c => c.category);
    const placeholders = topCategories.map(() => '?').join(',');
    
    let query = `
      SELECT b.*, AVG(r.rating) as avg_rating
      FROM books b
      LEFT JOIN book_ratings r ON b.id = r.book_id
      WHERE b.category IN (${placeholders})
      ${excludeIds.length > 0 ? `AND b.id NOT IN (${excludeIds.map(() => '?').join(',')})` : ''}
      GROUP BY b.id
      ORDER BY avg_rating DESC, b.created_at DESC
      LIMIT ?
    `;
    
    const params = [...topCategories, ...(excludeIds.length > 0 ? excludeIds : []), limit];
    recommendedBooks = db.prepare(query).all(...params);
  }
  
  // If not enough recommendations, add popular books
  if (recommendedBooks.length < limit) {
    const needed = limit - recommendedBooks.length;
    const existingIds = recommendedBooks.map(b => b.id);
    const allExcludeIds = [...new Set([...excludeIds, ...existingIds])];
    
    let query = `
      SELECT b.*, AVG(r.rating) as avg_rating, COUNT(h.id) as borrow_count
      FROM books b
      LEFT JOIN book_ratings r ON b.id = r.book_id
      LEFT JOIN history h ON b.id = h.book_id
      ${allExcludeIds.length > 0 ? `WHERE b.id NOT IN (${allExcludeIds.map(() => '?').join(',')})` : ''}
      GROUP BY b.id
      ORDER BY borrow_count DESC, avg_rating DESC
      LIMIT ?
    `;
    
    const params = allExcludeIds.length > 0 ? [...allExcludeIds, needed] : [needed];
    const popularBooks = db.prepare(query).all(...params);
    recommendedBooks = [...recommendedBooks, ...popularBooks];
  }
  
  return recommendedBooks.map(row => ({
    ...row,
    avg_rating: row.avg_rating ? Math.round(row.avg_rating * 10) / 10 : 0
  }));
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { userId } = req.query || {};

  try {
    if (!userId) {
      res.status(400).json({ success: false, message: 'User ID required' });
      return;
    }
    
    const limit = parseInt(req.query.limit) || 5;
    const recommendations = getRecommendations(parseInt(userId), limit);
    res.status(200).json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
