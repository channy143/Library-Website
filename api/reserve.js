const { db, setCorsHeaders } = require('../lib/db');

const MAX_RESERVATIONS = 3;

function getBookInventory(bookId) {
  const book = db.prepare('SELECT id, copies, available FROM books WHERE id = ?').get(bookId);
  if (!book) return null;
  
  const copies = book.copies || 1;
  const borrowedCount = db.prepare('SELECT COUNT(*) as count FROM borrowed WHERE book_id = ?').get(bookId).count;
  const freeCopies = Math.max(0, copies - borrowedCount);
  
  return { book, copies, borrowed: borrowedCount, free: freeCopies };
}

function refreshBookAvailability(bookId) {
  const inv = getBookInventory(bookId);
  if (!inv) return;
  
  const waitingCount = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status = 'waiting'").get(bookId).count;
  const readyCount = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status = 'ready'").get(bookId).count;
  
  const available = (inv.free > 0 && waitingCount === 0 && readyCount === 0) ? 1 : 0;
  db.prepare('UPDATE books SET available = ? WHERE id = ?').run(available, bookId);
}

function cleanupExpiredReservations() {
  const today = new Date().toISOString().split('T')[0];
  const expired = db.prepare("SELECT id, book_id FROM reservations WHERE status = 'ready' AND pickup_date < ?").all(today);
  
  expired.forEach(row => {
    db.prepare("UPDATE reservations SET status = 'expired' WHERE id = ?").run(row.id);
    refreshBookAvailability(row.book_id);
  });
}

function getQueuePosition(bookId) {
  const count = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status IN ('waiting', 'ready')").get(bookId).count;
  return count + 1;
}

function reserveBook(bookId, userId, pickupDate) {
  const count = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE user_id = ? AND status IN ('waiting', 'ready')").get(userId).count;
  if (count >= MAX_RESERVATIONS) return { success: false, message: 'Max reservations reached' };
  
  const exists = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND user_id = ? AND status IN ('waiting', 'ready')").get(bookId, userId).count;
  if (exists) return { success: false, message: 'Already reserved' };
  
  const queuePos = getQueuePosition(bookId);
  const pickup = pickupDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  db.prepare("INSERT INTO reservations (book_id, user_id, pickup_date, queue_position, status) VALUES (?, ?, ?, ?, 'waiting')").run(bookId, userId, pickup, queuePos);
  
  return { success: true, message: 'Reserved successfully', data: { queuePosition: queuePos } };
}

function cancelReservation(resId, userId) {
  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ? AND user_id = ?").run(resId, userId);
  return { success: true, message: 'Cancelled' };
}

function getUserReservations(userId) {
  const rows = db.prepare(`
    SELECT r.*, b.title, b.author, b.cover
    FROM reservations r
    JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.status IN ('waiting', 'ready')
  `).all(userId);
  
  return rows.map(row => ({
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    pickupDate: row.pickup_date,
    queuePosition: row.queue_position,
    status: row.status,
    book: {
      id: row.book_id,
      title: row.title,
      author: row.author,
      cover: row.cover
    }
  }));
}

function getUserExpiredReservations(userId) {
  const rows = db.prepare(`
    SELECT r.*, b.title, b.author, b.cover
    FROM reservations r
    JOIN books b ON r.book_id = b.id
    WHERE r.user_id = ? AND r.status = 'expired'
    ORDER BY r.pickup_date DESC, r.id DESC
  `).all(userId);
  
  return rows.map(row => ({
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    pickupDate: row.pickup_date,
    queuePosition: row.queue_position,
    status: row.status,
    book: {
      id: row.book_id,
      title: row.title,
      author: row.author,
      cover: row.cover
    }
  }));
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  cleanupExpiredReservations();

  const { action } = req.query || {};
  const body = req.body || {};
  const userId = body.userId || req.query.userId;

  try {
    switch (action) {
      case 'reserve':
        const bookId = body.bookId;
        const pickup = body.pickupDate;
        if (!bookId || !userId) {
          res.status(400).json({ success: false, message: 'Missing IDs' });
          return;
        }
        res.status(200).json(reserveBook(parseInt(bookId), parseInt(userId), pickup));
        break;
      case 'cancel':
        const resId = body.reservationId;
        if (!resId || !userId) {
          res.status(400).json({ success: false, message: 'Missing IDs' });
          return;
        }
        res.status(200).json(cancelReservation(parseInt(resId), parseInt(userId)));
        break;
      case 'expired':
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getUserExpiredReservations(parseInt(userId)) });
        break;
      case 'user':
      case '':
      default:
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getUserReservations(parseInt(userId)) });
        break;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
