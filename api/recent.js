const { db, setCorsHeaders } = require('../lib/db');

function addRecentBook(userId, bookId, lastReadPage = 0) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO recently_read_books (user_id, book_id, last_read_page, last_read_date)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, book_id) DO UPDATE SET
    last_read_page = excluded.last_read_page,
    last_read_date = excluded.last_read_date
  `).run(userId, bookId, lastReadPage, now);
  
  return { success: true, message: 'Recent book updated' };
}

function getRecentBooks(userId, limit = 10) {
  const rows = db.prepare(`
    SELECT r.*, b.title, b.author, b.cover, b.category
    FROM recently_read_books r
    JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ?
    ORDER BY r.last_read_date DESC
    LIMIT ?
  `).all(userId, limit);
  
  return rows.map(row => ({
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    lastReadPage: row.last_read_page,
    lastReadDate: row.last_read_date,
    book: {
      title: row.title,
      author: row.author,
      cover: row.cover,
      category: row.category
    }
  }));
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, userId, bookId } = req.query || {};
  const body = req.body || {};

  try {
    switch (action) {
      case 'add':
      case 'update':
        if (!body.userId || !body.bookId) {
          res.status(400).json({ success: false, message: 'User ID and Book ID required' });
          return;
        }
        res.status(200).json(addRecentBook(parseInt(body.userId), parseInt(body.bookId), body.lastReadPage || 0));
        break;

      case 'list':
      case '':
      default:
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        const limit = parseInt(req.query.limit) || 10;
        res.status(200).json({ success: true, data: getRecentBooks(parseInt(userId), limit) });
        break;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
