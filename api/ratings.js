const { loadData, setCorsHeaders, saveData } = require('../lib/db');

function rateBook(userId, bookId, rating, review, data) {
  const now = new Date().toISOString();
  if (!data.book_ratings) data.book_ratings = [];
  const existingIndex = data.book_ratings.findIndex(r => r.user_id === userId && r.book_id === bookId);
  if (existingIndex >= 0) {
    data.book_ratings[existingIndex].rating = rating;
    data.book_ratings[existingIndex].review = review || '';
    data.book_ratings[existingIndex].updated_at = now;
  } else {
    data.book_ratings.push({ id: Date.now(), user_id: userId, book_id: bookId, rating, review: review || '', created_at: now, updated_at: now });
  }
  saveData(data);
  return { success: true, message: 'Rating saved' };
}

function getBookRatings(bookId, data) {
  const ratings = data.book_ratings?.filter(r => r.book_id === bookId) || [];
  return ratings.map(r => {
    const user = data.users?.find(u => u.id === r.user_id);
    return { id: r.id, userId: r.user_id, bookId: r.book_id, rating: r.rating, review: r.review, createdAt: r.created_at, userName: user?.full_name || user?.username };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function getUserRating(userId, bookId, data) {
  return data.book_ratings?.find(r => r.user_id === userId && r.book_id === bookId) || null;
}

module.exports = (req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const data = loadData();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  const bookId = url.searchParams.get('bookId');
  const userId = url.searchParams.get('userId');
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
        res.status(200).json(rateBook(parseInt(body.userId), parseInt(body.bookId), body.rating, body.review, data));
        break;
      case 'list':
        if (!bookId) {
          res.status(400).json({ success: false, message: 'Book ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getBookRatings(parseInt(bookId), data) });
        break;
      case 'get':
        if (!userId || !bookId) {
          res.status(400).json({ success: false, message: 'User ID and Book ID required' });
          return;
        }
        const rating = getUserRating(parseInt(userId), parseInt(bookId), data);
        res.status(200).json({ success: true, data: rating });
        break;
      default:
        res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
