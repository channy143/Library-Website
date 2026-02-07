const { loadData, setCorsHeaders, saveData } = require('../lib/db');

const MAX_RESERVATIONS = 3;

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

function cleanupExpiredReservations(data) {
  const today = new Date().toISOString().split('T')[0];
  const expired = data.reservations?.filter(r => r.status === 'ready' && r.pickup_date < today) || [];
  expired.forEach(row => { row.status = 'expired'; refreshBookAvailability(row.book_id, data); });
}

function getQueuePosition(bookId, data) {
  return (data.reservations?.filter(r => r.book_id === bookId && ['waiting', 'ready'].includes(r.status)).length || 0) + 1;
}

function reserveBook(bookId, userId, pickupDate, data) {
  const count = data.reservations?.filter(r => r.user_id === userId && ['waiting', 'ready'].includes(r.status)).length || 0;
  if (count >= MAX_RESERVATIONS) return { success: false, message: 'Max reservations reached' };
  const exists = data.reservations?.some(r => r.book_id === bookId && r.user_id === userId && ['waiting', 'ready'].includes(r.status));
  if (exists) return { success: false, message: 'Already reserved' };
  const queuePos = getQueuePosition(bookId, data);
  const pickup = pickupDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  if (!data.reservations) data.reservations = [];
  data.reservations.push({ id: Date.now(), book_id: bookId, user_id: userId, pickup_date: pickup, queue_position: queuePos, status: 'waiting', created_at: new Date().toISOString() });
  saveData(data);
  return { success: true, message: 'Reserved successfully', data: { queuePosition: queuePos } };
}

function cancelReservation(resId, userId, data) {
  const res = data.reservations?.find(r => r.id === resId && r.user_id === userId);
  if (!res) return { success: false, message: 'Reservation not found' };
  res.status = 'cancelled';
  saveData(data);
  return { success: true, message: 'Cancelled' };
}

function getUserReservations(userId, data) {
  return (data.reservations?.filter(r => r.user_id === userId && ['waiting', 'ready'].includes(r.status)) || []).map(r => {
    const book = data.books?.find(b => b.id === r.book_id);
    return { id: r.id, bookId: r.book_id, userId: r.user_id, pickupDate: r.pickup_date, queuePosition: r.queue_position, status: r.status, book: book ? { id: book.id, title: book.title, author: book.author, cover: book.cover } : null };
  });
}

function getUserExpiredReservations(userId, data) {
  const userRes = data.reservations?.filter(r => r.user_id === userId && r.status === 'expired') || [];
  return userRes.sort((a, b) => new Date(b.pickup_date) - new Date(a.pickup_date)).map(r => {
    const book = data.books?.find(b => b.id === r.book_id);
    return { id: r.id, bookId: r.book_id, userId: r.user_id, pickupDate: r.pickup_date, queuePosition: r.queue_position, status: r.status, book: book ? { id: book.id, title: book.title, author: book.author, cover: book.cover } : null };
  });
}

module.exports = (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const data = loadData();
  cleanupExpiredReservations(data);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  const body = req.body || {};
  const userId = body.userId || url.searchParams.get('userId');
  try {
    switch (action) {
      case 'reserve':
        const bookId = body.bookId;
        const pickup = body.pickupDate;
        if (!bookId || !userId) { res.status(400).json({ success: false, message: 'Missing IDs' }); return; }
        res.status(200).json(reserveBook(parseInt(bookId), parseInt(userId), pickup, data));
        break;
      case 'cancel':
        const resId = body.reservationId;
        if (!resId || !userId) { res.status(400).json({ success: false, message: 'Missing IDs' }); return; }
        res.status(200).json(cancelReservation(parseInt(resId), parseInt(userId), data));
        break;
      case 'expired':
        if (!userId) { res.status(400).json({ success: false, message: 'User ID required' }); return; }
        res.status(200).json({ success: true, data: getUserExpiredReservations(parseInt(userId), data) });
        break;
      case 'user':
      case '':
      default:
        if (!userId) { res.status(400).json({ success: false, message: 'User ID required' }); return; }
        res.status(200).json({ success: true, data: getUserReservations(parseInt(userId), data) });
        break;
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
