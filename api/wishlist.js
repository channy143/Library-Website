const { db, setCorsHeaders } = require('../lib/db');

function addToWishlist(userId, bookId) {
  try {
    db.prepare('INSERT INTO wishlist (user_id, book_id) VALUES (?, ?)').run(userId, bookId);
    return { success: true, message: 'Added to wishlist' };
  } catch (error) {
    return { success: false, message: 'Already in wishlist' };
  }
}

function removeFromWishlist(userId, bookId) {
  db.prepare('DELETE FROM wishlist WHERE user_id = ? AND book_id = ?').run(userId, bookId);
  return { success: true, message: 'Removed from wishlist' };
}

function getWishlist(userId) {
  return db.prepare(`
    SELECT b.* FROM wishlist w
    JOIN books b ON w.book_id = b.id
    WHERE w.user_id = ?
    ORDER BY w.created_at DESC
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
        res.status(200).json(addToWishlist(parseInt(userId), parseInt(bookId)));
        break;

      case 'remove':
        if (!userId || !bookId) {
          res.status(400).json({ success: false, message: 'User ID and Book ID required' });
          return;
        }
        res.status(200).json(removeFromWishlist(parseInt(userId), parseInt(bookId)));
        break;

      case 'list':
      case '':
      default:
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getWishlist(parseInt(userId)) });
        break;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
