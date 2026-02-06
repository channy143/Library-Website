const { db, setCorsHeaders } = require('../lib/db');

function addFavorite(userId, bookId) {
  db.prepare('INSERT OR IGNORE INTO favorite_books (user_id, book_id) VALUES (?, ?)').run(userId, bookId);
  return { success: true, message: 'Added to favorites' };
}

function removeFavorite(userId, bookId) {
  db.prepare('DELETE FROM favorite_books WHERE user_id = ? AND book_id = ?').run(userId, bookId);
  return { success: true, message: 'Removed from favorites' };
}

function listFavorites(userId) {
  return db.prepare(`
    SELECT b.* FROM favorite_books f
    JOIN books b ON f.book_id = b.id
    WHERE f.user_id = ?
    ORDER BY f.added_date DESC
  `).all(userId);
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action } = req.query || {};
  const body = req.body || {};
  const userId = body.userId || req.query.userId;
  const bookId = body.bookId || req.query.bookId;

  try {
    switch (action) {
      case 'add':
        if (!userId || !bookId) {
          res.status(400).json({ success: false, message: 'User ID and Book ID required' });
          return;
        }
        res.status(200).json(addFavorite(parseInt(userId), parseInt(bookId)));
        break;

      case 'remove':
        if (!userId || !bookId) {
          res.status(400).json({ success: false, message: 'User ID and Book ID required' });
          return;
        }
        res.status(200).json(removeFavorite(parseInt(userId), parseInt(bookId)));
        break;

      case 'list':
      case '':
      default:
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: listFavorites(parseInt(userId)) });
        break;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
