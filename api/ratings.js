const { db, setCorsHeaders } = require('../lib/db');

function rateBook(userId, bookId, rating, review) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO book_ratings (user_id, book_id, rating, review, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, book_id) DO UPDATE SET
    rating = excluded.rating,
    review = excluded.review,
    updated_at = excluded.updated_at
  `).run(userId, bookId, rating, review || '', now, now);
  
  return { success: true, message: 'Rating saved' };
}

function getBookRatings(bookId) {
  const rows = db.prepare(`
    SELECT r.*, u.username, u.full_name
    FROM book_ratings r
    JOIN users u ON r.user_id = u.id
    WHERE r.book_id = ?
    ORDER BY r.created_at DESC
  `).all(bookId);
  
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    rating: row.rating,
    review: row.review,
    createdAt: row.created_at,
    userName: row.full_name || row.username
  }));
}

function getUserRating(userId, bookId) {
  return db.prepare('SELECT * FROM book_ratings WHERE user_id = ? AND book_id = ?').get(userId, bookId);
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, bookId, userId } = req.query || {};
  const body = req.body || {};

  try {
    switch (action) {
      case 'add':
      case 'update':
        if (!body.userId || !body.bookId || !body.rating) {
          res.status(400).json({ success: false, message: 'User ID, Book ID, and rating required' });
          return;
        }
        if (body.rating < 1 || body.rating > 5) {
          res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
          return;
        }
        res.status(200).json(rateBook(parseInt(body.userId), parseInt(body.bookId), body.rating, body.review));
        break;

      case 'list':
        if (!bookId) {
          res.status(400).json({ success: false, message: 'Book ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getBookRatings(parseInt(bookId)) });
        break;

      case 'get':
        if (!userId || !bookId) {
          res.status(400).json({ success: false, message: 'User ID and Book ID required' });
          return;
        }
        const rating = getUserRating(parseInt(userId), parseInt(bookId));
        res.status(200).json({ success: true, data: rating });
        break;

      default:
        res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
