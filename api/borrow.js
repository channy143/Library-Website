const { db, setCorsHeaders } = require('../lib/db');

const LOAN_DAYS = 14;
const RENEW_DAYS = 7;
const MAX_RENEWALS = 2;
const MAX_BORROWED = 5;

function hasOverdueBooks(userId) {
  const today = new Date().toISOString().split('T')[0];
  const result = db.prepare('SELECT COUNT(*) as count FROM borrowed WHERE user_id = ? AND due_date < ?').get(userId, today);
  return result.count > 0;
}

function countBorrowedBooks(userId) {
  const result = db.prepare('SELECT COUNT(*) as count FROM borrowed WHERE user_id = ?').get(userId);
  return result.count;
}

function getBorrowedEntry(bookId, userId) {
  return db.prepare('SELECT * FROM borrowed WHERE book_id = ? AND user_id = ?').get(bookId, userId);
}

function isReservedByOthers(bookId, userId) {
  const result = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND user_id != ? AND status = 'waiting'").get(bookId, userId);
  return result.count > 0;
}

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
  
  const free = inv.free;
  const waitingCount = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status = 'waiting'").get(bookId).count;
  const readyCount = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status = 'ready'").get(bookId).count;
  
  const available = (free > 0 && waitingCount === 0 && readyCount === 0) ? 1 : 0;
  db.prepare('UPDATE books SET available = ? WHERE id = ?').run(available, bookId);
}

function borrowBook(bookId, userId) {
  if (hasOverdueBooks(userId)) return { success: false, message: 'Cannot borrow: You have overdue books' };
  if (countBorrowedBooks(userId) >= MAX_BORROWED) return { success: false, message: 'Cannot borrow: Maximum limit reached' };
  if (getBorrowedEntry(bookId, userId)) return { success: false, message: 'You already have this book borrowed' };
  
  const inv = getBookInventory(bookId);
  if (!inv) return { success: false, message: 'Book not found' };
  
  const readyForOthers = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND user_id != ? AND status = 'ready'").get(bookId, userId).count;
  if (readyForOthers > 0) return { success: false, message: 'This book is reserved for another user' };
  
  if (inv.free <= 0) return { success: false, message: 'No copies available' };
  
  const today = new Date();
  const borrowDate = today.toISOString().split('T')[0];
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + LOAN_DAYS);
  const dueDateStr = dueDate.toISOString().split('T')[0];
  
  try {
    db.prepare('INSERT INTO borrowed (book_id, user_id, borrow_date, due_date, renewals_left) VALUES (?, ?, ?, ?, ?)')
      .run(bookId, userId, borrowDate, dueDateStr, MAX_RENEWALS);
    refreshBookAvailability(bookId);
    
    return { success: true, message: 'Book borrowed successfully', data: { dueDate: dueDateStr, renewalsLeft: MAX_RENEWALS } };
  } catch (error) {
    return { success: false, message: 'Database error' };
  }
}

function returnBook(bookId, userId) {
  const entry = getBorrowedEntry(bookId, userId);
  if (!entry) return { success: false, message: 'Borrow record not found' };
  
  const today = new Date().toISOString().split('T')[0];
  const overdue = entry.due_date < today;
  
  try {
    db.prepare('INSERT INTO history (book_id, user_id, borrow_date, return_date, overdue) VALUES (?, ?, ?, ?, ?)')
      .run(bookId, userId, entry.borrow_date, today, overdue ? 1 : 0);
    db.prepare('DELETE FROM borrowed WHERE id = ?').run(entry.id);
    
    const res = db.prepare("SELECT id FROM reservations WHERE book_id = ? AND status = 'waiting' ORDER BY created_at ASC LIMIT 1").get(bookId);
    if (res) {
      db.prepare("UPDATE reservations SET status = 'ready' WHERE id = ?").run(res.id);
    }
    
    refreshBookAvailability(bookId);
    return { success: true, message: 'Book returned' + (overdue ? ' (Overdue)' : ''), data: { overdue } };
  } catch (error) {
    return { success: false, message: 'Database error: ' + error.message };
  }
}

function renewBook(bookId, userId) {
  const entry = getBorrowedEntry(bookId, userId);
  if (!entry) return { success: false, message: 'Borrow record not found' };
  if (entry.renewals_left <= 0) return { success: false, message: 'No renewals left' };
  if (isReservedByOthers(bookId, userId)) return { success: false, message: 'Cannot renew: Reserved by another user' };
  
  const currentDue = new Date(entry.due_date);
  currentDue.setDate(currentDue.getDate() + RENEW_DAYS);
  const newDueDate = currentDue.toISOString().split('T')[0];
  const newRenewals = entry.renewals_left - 1;
  
  db.prepare('UPDATE borrowed SET due_date = ?, renewals_left = ? WHERE id = ?').run(newDueDate, newRenewals, entry.id);
  return { success: true, message: 'Book renewed', data: { newDueDate, renewalsLeft: newRenewals } };
}

function getBookBorrowers(bookId) {
  const today = new Date().toISOString().split('T')[0];
  const rows = db.prepare(`
    SELECT b.*, u.full_name, u.username, u.email
    FROM borrowed b
    JOIN users u ON b.user_id = u.id
    WHERE b.book_id = ?
  `).all(bookId);
  
  return rows.map(row => ({
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    userName: row.full_name || row.username,
    userEmail: row.email,
    borrowDate: row.borrow_date,
    dueDate: row.due_date,
    renewalsLeft: row.renewals_left,
    overdue: row.due_date < today
  }));
}

function getUserBorrowed(userId) {
  const rows = db.prepare(`
    SELECT b.*, k.title, k.author, k.cover, k.category
    FROM borrowed b
    JOIN books k ON b.book_id = k.id
    WHERE b.user_id = ?
  `).all(userId);
  
  return rows.map(row => ({
    id: row.id,
    bookId: row.book_id,
    userId: row.user_id,
    borrowDate: row.borrow_date,
    dueDate: row.due_date,
    renewalsLeft: row.renewals_left,
    book: {
      id: row.book_id,
      title: row.title,
      author: row.author,
      cover: row.cover,
      category: row.category
    }
  }));
}

function pickupReservation(reservationId, userId) {
  const today = new Date().toISOString().split('T')[0];
  const row = db.prepare('SELECT * FROM reservations WHERE id = ? AND user_id = ?').get(reservationId, userId);
  
  if (!row) return { success: false, message: 'Reservation not found' };
  if (row.status.toLowerCase() !== 'ready') return { success: false, message: 'Reservation is not ready for pickup' };
  if (row.pickup_date && row.pickup_date < today) {
    db.prepare("UPDATE reservations SET status = 'expired' WHERE id = ?").run(row.id);
    refreshBookAvailability(row.book_id);
    return { success: false, message: 'Reservation has expired' };
  }
  
  const borrowResult = borrowBook(row.book_id, userId);
  if (!borrowResult.success) return borrowResult;
  
  db.prepare("UPDATE reservations SET status = 'completed' WHERE id = ?").run(reservationId);
  return { success: true, message: 'Book picked up successfully', data: borrowResult.data };
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action } = req.query || {};
  const body = req.body || {};
  const bookId = body.bookId || req.query.bookId;
  const userId = body.userId || req.query.userId;
  const reservationId = body.reservationId || req.query.reservationId;

  try {
    let result;
    switch (action) {
      case 'borrow':
        if (!bookId || !userId) {
          res.status(400).json({ success: false, message: 'Missing IDs' });
          return;
        }
        result = borrowBook(parseInt(bookId), parseInt(userId));
        break;
      case 'return':
        if (!bookId || !userId) {
          res.status(400).json({ success: false, message: 'Missing IDs' });
          return;
        }
        result = returnBook(parseInt(bookId), parseInt(userId));
        break;
      case 'renew':
        if (!bookId || !userId) {
          res.status(400).json({ success: false, message: 'Missing IDs' });
          return;
        }
        result = renewBook(parseInt(bookId), parseInt(userId));
        break;
      case 'pickup':
        if (!reservationId || !userId) {
          res.status(400).json({ success: false, message: 'Missing IDs' });
          return;
        }
        result = pickupReservation(parseInt(reservationId), parseInt(userId));
        break;
      case 'bookBorrowers':
        if (!bookId) {
          res.status(400).json({ success: false, message: 'Book ID required' });
          return;
        }
        result = { success: true, data: getBookBorrowers(parseInt(bookId)) };
        break;
      case 'list':
      case '':
      default:
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        result = { success: true, data: getUserBorrowed(parseInt(userId)) };
        break;
    }
    
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
