const { loadData, setCorsHeaders } = require('../lib/db');

function getUserHistory(userId, data) {
  const userHistory = data.history?.filter(h => h.user_id === userId) || [];
  return userHistory.map(h => {
    const book = data.books?.find(b => b.id === h.book_id);
    const rating = data.book_ratings?.find(r => r.book_id === h.book_id && r.user_id === userId);
    return { id: h.id, bookId: h.book_id, userId: h.user_id, borrowDate: h.borrow_date, returnDate: h.return_date, overdue: !!h.overdue, rating: rating?.rating || null, book: book ? { title: book.title, author: book.author, cover: book.cover, category: book.category } : null };
  }).sort((a, b) => new Date(b.returnDate) - new Date(a.returnDate));
}

function getUserStats(userId, data) {
  const userHistory = data.history?.filter(h => h.user_id === userId) || [];
  const total = userHistory.length;
  const overdue = userHistory.filter(h => h.overdue).length;
  const categories = {};
  userHistory.forEach(h => {
    const book = data.books?.find(b => b.id === h.book_id);
    if (book?.category) {
      categories[book.category] = (categories[book.category] || 0) + 1;
    }
  });
  const mostRead = Object.keys(categories).sort((a, b) => categories[b] - categories[a])[0] || '-';
  return { totalBooks: total, overdueCount: overdue, mostReadCategory: mostRead, categories };
}

function getFullStats(userId, data) {
  const basicStats = getUserStats(userId, data);
  const now = new Date();
  const monthlyReading = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const count = data.history?.filter(h => h.user_id === userId && h.return_date?.startsWith(month)).length || 0;
    if (count > 0) monthlyReading.push({ month, count });
  }
  const currentBorrowed = data.borrowed?.filter(b => b.user_id === userId).length || 0;
  const reservations = data.reservations?.filter(r => r.user_id === userId && ['waiting', 'ready'].includes(r.status)).length || 0;
  const overduePercent = basicStats.totalBooks > 0 ? Math.round((basicStats.overdueCount / basicStats.totalBooks) * 100 * 10) / 10 : 0;
  return { totalBooks: basicStats.totalBooks, overdueCount: basicStats.overdueCount, overduePercentage: overduePercent, mostReadCategory: basicStats.mostReadCategory, categories: basicStats.categories, monthlyReading, avgReadingDays: 0, currentBorrowed, activeReservations: reservations };
}

function getAdminStats(data) {
  const totalBooks = data.books?.length || 0;
  const totalUsers = data.users?.length || 0;
  const totalLoans = data.history?.length || 0;
  const activeBorrows = data.borrowed?.length || 0;
  const activeReservations = data.reservations?.filter(r => ['waiting', 'ready'].includes(r.status)).length || 0;
  const catCounts = {};
  data.history?.forEach(h => {
    const book = data.books?.find(b => b.id === h.book_id);
    if (book?.category) catCounts[book.category] = (catCounts[book.category] || 0) + 1;
  });
  const topCategories = Object.entries(catCounts).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  const bookCounts = {};
  data.history?.forEach(h => {
    const book = data.books?.find(b => b.id === h.book_id);
    if (book) {
      const key = book.title + '|' + book.author;
      bookCounts[key] = (bookCounts[key] || 0) + 1;
    }
  });
  const topBooks = Object.entries(bookCounts).map(([key, count]) => {
    const [title, author] = key.split('|');
    return { title, author, count };
  }).sort((a, b) => b.count - a.count).slice(0, 5);
  return { totalBooks, totalUsers, totalLoans, activeBorrows, activeReservations, monthlyLoans: [], topCategories, topBooks };
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
  const userId = url.searchParams.get('userId');

  try {
    switch (action) {
      case 'stats':
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getUserStats(parseInt(userId), data) });
        break;
        
      case 'fullStats':
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getFullStats(parseInt(userId), data) });
        break;
        
      case 'adminStats':
        res.status(200).json({ success: true, data: getAdminStats(data) });
        break;
        
      default:
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: getUserHistory(parseInt(userId), data) });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
