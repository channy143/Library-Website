const { loadData, setCorsHeaders, saveData } = require('../lib/db');

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');
  const action = url.searchParams.get('action');

  try {
    const data = loadData();

    if (req.method === 'GET') {
      if (id) {
        // Get single book
        const book = data.books.find(b => b.id === parseInt(id));

        if (book) {
          // Attach rating summary
          const ratings = data.book_ratings?.filter(r => r.book_id === book.id) || [];
          const avgRating = ratings.length > 0
            ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10
            : 0;

          book.avg_rating = avgRating;
          book.rating_count = ratings.length;
          book.available = !!book.available;
          book.copies = book.copies || 1;

          res.status(200).json({ success: true, data: book });
        } else {
          res.status(404).json({ success: false, message: 'Book not found' });
        }
      } else {
        // List all books with ratings
        const books = (data.books || []).map(book => {
          const ratings = data.book_ratings?.filter(r => r.book_id === book.id) || [];
          const avgRating = ratings.length > 0
            ? Math.round((ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length) * 10) / 10
            : 0;

          return {
            ...book,
            available: !!book.available,
            copies: book.copies || 1,
            avg_rating: avgRating,
            rating_count: ratings.length
          };
        });

        res.status(200).json({ success: true, data: books });
      }
    } else if (req.method === 'POST') {
      const { title, author, category, cover, pdf, description, copies } = req.body || {};

      if (action === 'add' || !action) {
        if (!title || !author) {
          res.status(400).json({ success: false, message: 'Title and author required' });
          return;
        }

        const newBook = {
          id: Date.now(),
          title,
          author,
          category: category || 'General',
          cover: cover || '',
          pdf: pdf || null,
          description: description || '',
          copies: copies || 1,
          available: 1,
          created_at: new Date().toISOString()
        };

        if (!data.books) data.books = [];
        data.books.push(newBook);
        saveData(data);

        res.status(201).json({
          success: true,
          message: 'Book added',
          id: newBook.id
        });
      } else {
        res.status(400).json({ success: false, message: 'Invalid action' });
      }
    } else if (req.method === 'PUT') {
      const { title, author, category, cover, pdf, description, copies, available } = req.body || {};

      if (!id) {
        res.status(400).json({ success: false, message: 'Book ID required' });
        return;
      }

      const bookIndex = data.books.findIndex(b => b.id === parseInt(id));
      if (bookIndex === -1) {
        res.status(404).json({ success: false, message: 'Book not found' });
        return;
      }

      if (title !== undefined) data.books[bookIndex].title = title;
      if (author !== undefined) data.books[bookIndex].author = author;
      if (category !== undefined) data.books[bookIndex].category = category;
      if (cover !== undefined) data.books[bookIndex].cover = cover;
      if (pdf !== undefined) data.books[bookIndex].pdf = pdf;
      if (description !== undefined) data.books[bookIndex].description = description;
      if (copies !== undefined) data.books[bookIndex].copies = copies;
      if (available !== undefined) data.books[bookIndex].available = available ? 1 : 0;

      saveData(data);
      res.status(200).json({ success: true, message: 'Book updated' });
    } else if (req.method === 'DELETE') {
      if (!id) {
        res.status(400).json({ success: false, message: 'Book ID required' });
        return;
      }

      const initialLength = data.books.length;
      data.books = data.books.filter(b => b.id !== parseInt(id));

      if (data.books.length < initialLength) {
        saveData(data);
        res.status(200).json({ success: true, message: 'Book deleted' });
      } else {
        res.status(404).json({ success: false, message: 'Book not found' });
      }
    } else {
      res.status(405).json({ success: false, message: 'Method not allowed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
