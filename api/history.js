const { db, setCorsHeaders } = require('../lib/db');

function getUserHistory(userId) {
  const rows = db.prepare(`
    SELECT h.*, b.title, b.author, b.cover, b.category, r.rating as user_rating
    FROM history h
    JOIN books b ON h.book_id = b.id
    LEFT JOIN book_ratings r ON r.book_id = h.book_id AND r.user_id = h.user_id
    WHERE h.user_id = ?
    ORDER BY h.return_date DESC
  `).all(userId);
  
  return rows.map(row => ({
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    borrowDate: row.borrow_date,
    returnDate: row.return_date,
    overdue: !!row.overdue,
    rating: row.user_rating || null,
    book: {
      title: row.title,
      author: row.author,
      cover: row.cover,
      category: row.category
    }
  }));
}

function getUserStats(userId) {
  const total = db.prepare('SELECT COUNT(*) as count FROM history WHERE user_id = ?').get(userId).count;
  const overdue = db.prepare('SELECT COUNT(*) as count FROM history WHERE user_id = ? AND overdue = 1').get(userId).count;
  
  const catResult = db.prepare(`
    SELECT k.category, COUNT(*) as count
    FROM history h
    JOIN books k ON h.book_id = k.id
    WHERE h.user_id = ?
    GROUP BY k.category
    ORDER BY count DESC
  `).all(userId);
  
  const categories = {};
  let mostRead = '-';
  catResult.forEach(row => {
    categories[row.category] = row.count;
    if (mostRead === '-') mostRead = row.category;
  });
  
  return {
    totalBooks: total || 0,
    overdueCount: overdue || 0,
    mostReadCategory: mostRead,
    categories
  };
}

function getFullStats(userId) {
  const basicStats = getUserStats(userId);
  
  // Monthly reading stats (last 12 months)
  const monthlyResult = db.prepare(`
    SELECT strftime('%Y-%m', return_date) as month, COUNT(*) as count
    FROM history
    WHERE user_id = ?
    AND return_date >= date('now', '-12 months')
    GROUP BY strftime('%Y-%m', return_date)
    ORDER BY month DESC
  `).all(userId);
  
  const monthlyReading = monthlyResult.map(row => ({
    month: row.month,
    count: row.count
  }));
  
  // Average reading time
  const avgDays = db.prepare(`
    SELECT AVG(julianday(return_date) - julianday(borrow_date)) as avg_days
    FROM history
    WHERE user_id = ?
  `).get(userId).avg_days;
  
  const overduePercent = basicStats.totalBooks > 0 ? Math.round((basicStats.overdueCount / basicStats.totalBooks) * 100 * 10) / 10 : 0;
  const currentBorrowed = db.prepare('SELECT COUNT(*) as count FROM borrowed WHERE user_id = ?').get(userId).count;
  const reservations = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE user_id = ? AND status IN ('waiting', 'ready')").get(userId).count;
  
  return {
    totalBooks: basicStats.totalBooks,
    overdueCount: basicStats.overdueCount,
    overduePercentage: overduePercent,
    mostReadCategory: basicStats.mostReadCategory,
    categories: basicStats.categories,
    monthlyReading,
    avgReadingDays: avgDays ? Math.round(avgDays * 10) / 10 : 0,
    currentBorrowed: currentBorrowed || 0,
    activeReservations: reservations || 0
  };
}

function getAdminStats() {
  const totalBooks = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const totalLoans = db.prepare('SELECT COUNT(*) as count FROM history').get().count;
  const activeBorrows = db.prepare('SELECT COUNT(*) as count FROM borrowed').get().count;
  const activeReservations = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status IN ('waiting', 'ready')").get().count;
  
  const monthlyResult = db.prepare(`
    SELECT strftime('%Y-%m', return_date) as month, COUNT(*) as count
    FROM history
    WHERE return_date >= date('now', '-6 months')
    GROUP BY strftime('%Y-%m', return_date)
    ORDER BY month DESC
  `).all();
  
  const monthlyLoans = monthlyResult.map(row => ({ month: row.month, count: row.count }));
  
  const catResult = db.prepare(`
    SELECT b.category, COUNT(*) as count
    FROM history h
    JOIN books b ON h.book_id = b.id
    GROUP BY b.category
    ORDER BY count DESC
    LIMIT 5
  `).all();
  
  const topCategories = catResult.map(row => ({ category: row.category, count: row.count }));
  
  const topBooksResult = db.prepare(`
    SELECT b.title, b.author, COUNT(*) as count
    FROM history h
    JOIN books b ON h.book_id = b.id
    GROUP BY h.book_id
    ORDER BY count DESC
    LIMIT 5
  `).all();
  
  const topBooks = topBooksResult.map(row => ({ title: row.title, author: row.author, count: row.count }));
  
  return {
    totalBooks: totalBooks || 0,
    totalUsers: totalUsers || 0,
    totalLoans: totalLoans || 0,
    activeBorrows: activeBorrows || 0,
    activeReservations: activeReservations || 0,
    monthlyLoans,
    topCategories,
    topBooks
  };
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, userId } = req.query || {};

  try {
    switch (action) {
      case 'stats':
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getUserStats(parseInt(userId)) });
        break;
        
      case 'fullStats':
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getFullStats(parseInt(userId)) });
        break;
        
      case 'adminStats':
        res.status(200).json({ success: true, data: getAdminStats() });
        break;
        
      default:
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getUserHistory(parseInt(userId)) });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
