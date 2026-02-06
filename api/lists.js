const { setCorsHeaders, loadData, saveData } = require('../lib/db');

module.exports = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || 'list';
  const type = url.searchParams.get('type') || 'favorites'; // 'favorites' or 'wishlist'
  
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const data = loadData();
  const table = type === 'wishlist' ? 'wishlist' : 'favorite_books';

  // GET /api/lists?type=favorites&userId=X
  if (req.method === 'GET') {
    const userId = parseInt(url.searchParams.get('userId'));
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId required' });
      return;
    }
    
    const items = data[table]?.filter(item => item.user_id === userId || item.userId === userId) || [];
    res.json({ success: true, data: items });
    return;
  }

  // POST /api/lists?action=add|remove&type=favorites
  if (req.method === 'POST') {
    const body = req.body;
    const userId = body.userId || body.user_id;
    const bookId = body.bookId || body.book_id;
    
    if (!userId || !bookId) {
      res.status(400).json({ success: false, error: 'userId and bookId required' });
      return;
    }

    if (action === 'add') {
      const existing = data[table]?.find(item => 
        (item.user_id === userId || item.userId === userId) && 
        (item.book_id === bookId || item.bookId === bookId)
      );
      
      if (existing) {
        res.status(400).json({ success: false, error: 'Already in list' });
        return;
      }

      const book = data.books.find(b => b.id === parseInt(bookId));
      if (!book) {
        res.status(404).json({ success: false, error: 'Book not found' });
        return;
      }

      if (!data[table]) data[table] = [];
      data[table].push({
        id: Date.now(),
        user_id: parseInt(userId),
        book_id: parseInt(bookId),
        title: book.title,
        author: book.author,
        cover: book.cover,
        added_date: new Date().toISOString()
      });
      saveData(data);
      res.json({ success: true, message: `Added to ${type}` });
      return;
    }

    if (action === 'remove') {
      if (!data[table]) {
        res.json({ success: true, message: 'Item not found' });
        return;
      }
      const initialLength = data[table].length;
      data[table] = data[table].filter(item => 
        !((item.user_id === userId || item.userId === userId) && 
          (item.book_id === bookId || item.bookId === bookId))
      );
      saveData(data);
      res.json({ success: true, message: `Removed from ${type}` });
      return;
    }

    res.status(400).json({ success: false, error: 'Invalid action' });
    return;
  }

  res.status(405).json({ success: false, error: 'Method not allowed' });
};
