const { db, setCorsHeaders } = require('../lib/db');

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id, action } = req.query || {};

  try {
    if (req.method === 'GET') {
      if (id) {
        // Get single book
        const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
        
        if (book) {
          // Attach rating summary
          const ratingRow = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count FROM book_ratings WHERE book_id = ?').get(book.id);
          book.avg_rating = ratingRow.avg_rating ? Math.round(ratingRow.avg_rating * 10) / 10 : 0;
          book.rating_count = ratingRow.rating_count || 0;
          
          // Normalize types
          book.available = !!book.available;
          book.copies = book.copies || 1;
          
          res.status(200).json({ success: true, data: book });
        } else {
          res.status(404).json({ success: false, message: 'Book not found' });
        }
      } else {
        // List all books with ratings
        const books = db.prepare(`
          SELECT b.*, AVG(r.rating) as avg_rating, COUNT(r.id) as rating_count
          FROM books b
          LEFT JOIN book_ratings r ON r.book_id = b.id
          GROUP BY b.id
          ORDER BY b.id DESC
        `).all();
        
        const formattedBooks = books.map(row => ({
          ...row,
          available: !!row.available,
          copies: row.copies || 1,
          avg_rating: row.avg_rating ? Math.round(row.avg_rating * 10) / 10 : 0,
          rating_count: row.rating_count || 0
        }));
        
        res.status(200).json({ success: true, data: formattedBooks });
      }
    } else if (req.method === 'POST') {
      const { title, author, category, cover, pdf, description, copies } = req.body || {};
      
      if (action === 'add' || !action) {
        if (!title || !author) {
          res.status(400).json({ success: false, message: 'Title and author required' });
          return;
        }
        
        const result = db.prepare(`
          INSERT INTO books (title, author, category, cover, pdf, description, copies, available)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          title,
          author,
          category || 'General',
          cover || '',
          pdf || null,
          description || '',
          copies || 1
        );
        
        res.status(201).json({ 
          success: true, 
          message: 'Book added',
          id: result.lastInsertRowid
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
      
      const fields = [];
      const values = [];
      
      if (title !== undefined) { fields.push('title = ?'); values.push(title); }
      if (author !== undefined) { fields.push('author = ?'); values.push(author); }
      if (category !== undefined) { fields.push('category = ?'); values.push(category); }
      if (cover !== undefined) { fields.push('cover = ?'); values.push(cover); }
      if (pdf !== undefined) { fields.push('pdf = ?'); values.push(pdf); }
      if (description !== undefined) { fields.push('description = ?'); values.push(description); }
      if (copies !== undefined) { fields.push('copies = ?'); values.push(copies); }
      if (available !== undefined) { fields.push('available = ?'); values.push(available ? 1 : 0); }
      
      if (fields.length === 0) {
        res.status(200).json({ success: true, message: 'No changes made' });
        return;
      }
      
      values.push(id);
      const query = `UPDATE books SET ${fields.join(', ')} WHERE id = ?`;
      const result = db.prepare(query).run(...values);
      
      if (result.changes > 0) {
        res.status(200).json({ success: true, message: 'Book updated' });
      } else {
        res.status(404).json({ success: false, message: 'Book not found' });
      }
    } else if (req.method === 'DELETE') {
      if (!id) {
        res.status(400).json({ success: false, message: 'Book ID required' });
        return;
      }
      
      const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
      
      if (result.changes > 0) {
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
