const { setCorsHeaders, loadData, saveData } = require('../lib/db');

module.exports = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || 'recent';
  
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const data = loadData();
  const userId = parseInt(url.searchParams.get('userId') || req.body?.userId);

  // GET /api/discover?action=recent&userId=X
  if (req.method === 'GET' && action === 'recent') {
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId required' });
      return;
    }
    
    const recent = data.recently_read_books?.filter(item => item.user_id === userId || item.userId === userId) || [];
    recent.sort((a, b) => new Date(b.read_date) - new Date(a.read_date));
    res.json({ success: true, data: recent.slice(0, 10) });
    return;
  }

  // GET /api/discover?action=recommendations&userId=X
  if (req.method === 'GET' && action === 'recommendations') {
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId required' });
      return;
    }
    
    // Get user's borrowed/wishlist history
    const userHistory = data.history?.filter(h => h.user_id === userId) || [];
    const userWishlist = data.wishlist?.filter(w => w.user_id === userId) || [];
    const borrowedIds = userHistory.map(h => h.book_id);
    const wishlistIds = userWishlist.map(w => w.book_id);
    
    // Simple recommendation: books not borrowed and in similar categories
    const categories = new Set();
    [...userHistory, ...userWishlist].forEach(item => {
      const book = data.books.find(b => b.id === item.book_id);
      if (book) categories.add(book.category);
    });
    
    let recommendations = data.books.filter(b => 
      !borrowedIds.includes(b.id) && 
      !wishlistIds.includes(b.id) &&
      categories.has(b.category)
    );
    
    if (recommendations.length < 5) {
      // Add random books if not enough category matches
      const moreBooks = data.books.filter(b => 
        !borrowedIds.includes(b.id) && 
        !wishlistIds.includes(b.id) &&
        !recommendations.includes(b)
      ).slice(0, 5 - recommendations.length);
      recommendations = [...recommendations, ...moreBooks];
    }
    
    res.json({ success: true, data: recommendations.slice(0, 8) });
    return;
  }

  // POST /api/discover?action=track - Track recently read
  if (req.method === 'POST' && action === 'track') {
    const body = req.body;
    const uid = body.userId;
    const bookId = body.bookId;
    
    if (!uid || !bookId) {
      res.status(400).json({ success: false, error: 'userId and bookId required' });
      return;
    }

    if (!data.recently_read_books) data.recently_read_books = [];
    
    // Remove if already exists (to move to top)
    data.recently_read_books = data.recently_read_books.filter(
      item => !(item.user_id === uid && item.book_id === bookId)
    );
    
    const book = data.books.find(b => b.id === parseInt(bookId));
    if (!book) {
      res.status(404).json({ success: false, error: 'Book not found' });
      return;
    }

    data.recently_read_books.unshift({
      id: Date.now(),
      user_id: parseInt(uid),
      book_id: parseInt(bookId),
      title: book.title,
      author: book.author,
      cover: book.cover,
      read_date: new Date().toISOString()
    });
    
    // Keep only last 20
    if (data.recently_read_books.length > 20) {
      data.recently_read_books = data.recently_read_books.slice(0, 20);
    }
    
    saveData(data);
    res.json({ success: true, message: 'Tracked' });
    return;
  }

  res.status(405).json({ success: false, error: 'Method not allowed' });
};
