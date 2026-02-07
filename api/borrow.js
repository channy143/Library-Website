const { loadData, setCorsHeaders, saveData } = require('../lib/db');

const LOAN_DAYS = 14;
const RENEW_DAYS = 7;
const MAX_RENEWALS = 2;
const MAX_BORROWED = 5;

function hasOverdueBooks(userId, data) {
  const today = new Date().toISOString().split('T')[0];
  const userBorrowed = data.borrowed?.filter(b => b.user_id === userId) || [];
  return userBorrowed.some(b => b.due_date < today);
}

function countBorrowedBooks(userId, data) {
  return data.borrowed?.filter(b => b.user_id === userId).length || 0;
}

function getBorrowedEntry(bookId, userId, data) {
  return data.borrowed?.find(b => b.book_id === bookId && b.user_id === userId);
}

function isReservedByOthers(bookId, userId, data) {
  return data.reservations?.some(r => r.book_id === bookId && r.user_id !== userId && r.status === 'waiting') || false;
}

function getBookInventory(bookId, data) {
  const book = data.books?.find(b => b.id === bookId);
  if (!book) return null;
  const copies = book.copies || 1;
  const borrowedCount = data.borrowed?.filter(b => b.book_id === bookId).length || 0;
  const freeCopies = Math.max(0, copies - borrowedCount);
  return { book, copies, borrowed: borrowedCount, free: freeCopies };
}

function refreshBookAvailability(bookId, data) {
  const inv = getBookInventory(bookId, data);
  if (!inv) return;
  const waitingCount = data.reservations?.filter(r => r.book_id === bookId && r.status === 'waiting').length || 0;
  const readyCount = data.reservations?.filter(r => r.book_id === bookId && r.status === 'ready').length || 0;
  const available = (inv.free > 0 && waitingCount === 0 && readyCount === 0) ? 1 : 0;
  const book = data.books?.find(b => b.id === bookId);
  if (book) book.available = available;
}

function borrowBook(bookId, userId, data) {
  if (hasOverdueBooks(userId, data)) return { success: false, message: 'Cannot borrow: You have overdue books' };
  if (countBorrowedBooks(userId, data) >= MAX_BORROWED) return { success: false, message: 'Cannot borrow: Maximum limit reached' };
  if (getBorrowedEntry(bookId, userId, data)) return { success: false, message: 'You already have this book borrowed' };
  const inv = getBookInventory(bookId, data);
  if (!inv) return { success: false, message: 'Book not found' };
  const readyForOthers = data.reservations?.some(r => r.book_id === bookId && r.user_id !== userId && r.status === 'ready') || false;
  if (readyForOthers) return { success: false, message: 'This book is reserved for another user' };
  if (inv.free <= 0) return { success: false, message: 'No copies available' };
  const today = new Date();
  const borrowDate = today.toISOString().split('T')[0];
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + LOAN_DAYS);
  const dueDateStr = dueDate.toISOString().split('T')[0];
  if (!data.borrowed) data.borrowed = [];
  data.borrowed.push({ id: Date.now(), book_id: bookId, user_id: userId, borrow_date: borrowDate, due_date: dueDateStr, renewals_left: MAX_RENEWALS });
  refreshBookAvailability(bookId, data);
  saveData(data);
  return { success: true, message: 'Book borrowed successfully', data: { dueDate: dueDateStr, renewalsLeft: MAX_RENEWALS } };
}

function returnBook(bookId, userId, data) {
  const entry = getBorrowedEntry(bookId, userId, data);
  if (!entry) return { success: false, message: 'Borrow record not found' };
  const today = new Date().toISOString().split('T')[0];
  const overdue = entry.due_date < today;
  if (!data.history) data.history = [];
  data.history.push({ id: Date.now(), book_id: bookId, user_id: userId, borrow_date: entry.borrow_date, return_date: today, overdue: overdue ? 1 : 0 });
  data.borrowed = data.borrowed.filter(b => !(b.book_id === bookId && b.user_id === userId));
  const waiting = data.reservations?.filter(r => r.book_id === bookId && r.status === 'waiting').sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
  if (waiting) waiting.status = 'ready';
  refreshBookAvailability(bookId, data);
  saveData(data);
  return { success: true, message: 'Book returned' + (overdue ? ' (Overdue)' : ''), data: { overdue } };
}

function renewBook(bookId, userId, data) {
  const entry = getBorrowedEntry(bookId, userId, data);
  if (!entry) return { success: false, message: 'Borrow record not found' };
  if (entry.renewals_left <= 0) return { success: false, message: 'No renewals left' };
  if (isReservedByOthers(bookId, userId, data)) return { success: false, message: 'Cannot renew: Reserved by another user' };
  const currentDue = new Date(entry.due_date);
  currentDue.setDate(currentDue.getDate() + RENEW_DAYS);
  const newDueDate = currentDue.toISOString().split('T')[0];
  entry.due_date = newDueDate;
  entry.renewals_left = entry.renewals_left - 1;
  saveData(data);
  return { success: true, message: 'Book renewed', data: { newDueDate, renewalsLeft: entry.renewals_left } };
}

function getBookBorrowers(bookId, data) {
  const today = new Date().toISOString().split('T')[0];
  const bookBorrowed = data.borrowed?.filter(b => b.book_id === bookId) || [];
  return bookBorrowed.map(b => {
    const user = data.users?.find(u => u.id === b.user_id);
    return { id: b.id, bookId: b.book_id, userId: b.user_id, userName: user?.full_name || user?.username, userEmail: user?.email, borrowDate: b.borrow_date, dueDate: b.due_date, renewalsLeft: b.renewals_left, overdue: b.due_date < today };
  });
}

function getUserBorrowed(userId, data) {
  const userBorrowed = data.borrowed?.filter(b => b.user_id === userId) || [];
  return userBorrowed.map(b => {
    const book = data.books?.find(k => k.id === b.book_id);
    return { id: b.id, bookId: b.book_id, userId: b.user_id, borrowDate: b.borrow_date, dueDate: b.due_date, renewalsLeft: b.renewals_left, book: book ? { id: book.id, title: book.title, author: book.author, cover: book.cover, category: book.category } : null };
  });
}

function pickupReservation(reservationId, userId, data) {
  const today = new Date().toISOString().split('T')[0];
  const res = data.reservations?.find(r => r.id === reservationId && r.user_id === userId);
  if (!res) return { success: false, message: 'Reservation not found' };
  if (res.status.toLowerCase() !== 'ready') return { success: false, message: 'Reservation is not ready for pickup' };
  if (res.pickup_date && res.pickup_date < today) {
    res.status = 'expired';
    refreshBookAvailability(res.book_id, data);
    saveData(data);
    return { success: false, message: 'Reservation has expired' };
  }
  const borrowResult = borrowBook(res.book_id, userId, data);
  if (!borrowResult.success) return borrowResult;
  res.status = 'completed';
  saveData(data);
  return { success: true, message: 'Book picked up successfully', data: borrowResult.data };
}

module.exports = (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  const data = loadData();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  const body = req.body || {};
  const bookId = body.bookId || url.searchParams.get('bookId');
  const userId = body.userId || url.searchParams.get('userId');
  const reservationId = body.reservationId || url.searchParams.get('reservationId');

  try {
    let result;
    switch (action) {
      case 'borrow':
        if (!bookId || !userId) { res.status(400).json({ success: false, message: 'Missing IDs' }); return; }
        result = borrowBook(parseInt(bookId), parseInt(userId), data);
        break;
      case 'return':
        if (!bookId || !userId) { res.status(400).json({ success: false, message: 'Missing IDs' }); return; }
        result = returnBook(parseInt(bookId), parseInt(userId), data);
        break;
      case 'renew':
        if (!bookId || !userId) { res.status(400).json({ success: false, message: 'Missing IDs' }); return; }
        result = renewBook(parseInt(bookId), parseInt(userId), data);
        break;
      case 'pickup':
        if (!reservationId || !userId) { res.status(400).json({ success: false, message: 'Missing IDs' }); return; }
        result = pickupReservation(parseInt(reservationId), parseInt(userId), data);
        break;
      case 'bookBorrowers':
        if (!bookId) { res.status(400).json({ success: false, message: 'Book ID required' }); return; }
        result = { success: true, data: getBookBorrowers(parseInt(bookId), data) };
        break;
      case 'list':
      case '':
      default:
        if (!userId) { res.status(400).json({ success: false, message: 'User ID required' }); return; }
        result = { success: true, data: getUserBorrowed(parseInt(userId), data) };
        break;
    }
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
