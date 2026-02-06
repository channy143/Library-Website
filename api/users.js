const { db, setCorsHeaders } = require('../lib/db');

function getUserStats(userId) {
  const borrowed = db.prepare('SELECT COUNT(*) as count FROM borrowed WHERE user_id = ?').get(userId).count;
  const historyCount = db.prepare('SELECT COUNT(*) as count FROM history WHERE user_id = ?').get(userId).count;
  const overdueCount = db.prepare('SELECT COUNT(*) as count FROM history WHERE user_id = ? AND overdue = 1').get(userId).count;
  const reservations = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE user_id = ? AND status IN ('waiting', 'ready')").get(userId).count;
  
  const latestHistory = db.prepare('SELECT return_date FROM history WHERE user_id = ? ORDER BY return_date DESC LIMIT 1').get(userId);
  const latestBorrow = db.prepare('SELECT borrow_date FROM borrowed WHERE user_id = ? ORDER BY borrow_date DESC LIMIT 1').get(userId);
  
  let lastActivity = null;
  if (latestHistory && latestBorrow) {
    lastActivity = latestHistory.return_date > latestBorrow.borrow_date ? latestHistory.return_date : latestBorrow.borrow_date;
  } else {
    lastActivity = latestHistory?.return_date || latestBorrow?.borrow_date || null;
  }
  
  return {
    borrowedCount: borrowed || 0,
    totalBooks: historyCount || 0,
    overdueCount: overdueCount || 0,
    reservationCount: reservations || 0,
    lastActivity
  };
}

function getAdminStats() {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const activeUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get().count;
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
  const totalBooks = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
  const checkedOut = db.prepare('SELECT COUNT(*) as count FROM borrowed').get().count;
  const totalReservations = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE status IN ('waiting', 'ready')").get().count;
  
  const catResult = db.prepare('SELECT category, COUNT(*) as count FROM books GROUP BY category').all();
  const categories = {};
  catResult.forEach(row => {
    categories[row.category] = row.count;
  });
  
  return {
    totalUsers: totalUsers || 0,
    activeUsers: activeUsers || 0,
    adminCount: adminCount || 0,
    totalBooks: totalBooks || 0,
    checkedOut: checkedOut || 0,
    reservations: totalReservations || 0,
    categories
  };
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id, action } = req.query || {};

  try {
    if (req.method === 'GET') {
      if (action === 'stats') {
        res.status(200).json({ success: true, data: getAdminStats() });
      } else if (id) {
        const user = db.prepare('SELECT id, username, email, full_name, role, status, created_at FROM users WHERE id = ?').get(id);
        
        if (user) {
          const stats = getUserStats(user.id);
          user.stats = stats;
          res.status(200).json({ success: true, data: user });
        } else {
          res.status(404).json({ success: false, message: 'User not found' });
        }
      } else {
        const users = db.prepare('SELECT id, username, email, full_name, role, status, created_at FROM users ORDER BY created_at DESC').all();
        
        const usersWithStats = users.map(row => {
          const stats = getUserStats(row.id);
          return {
            ...row,
            stats,
            status: row.status || 'active'
          };
        });
        
        res.status(200).json({ success: true, data: usersWithStats });
      }
    } else if (req.method === 'PUT') {
      const body = req.body || {};
      const updateId = id || body.id;
      
      if (!updateId) {
        res.status(400).json({ success: false, message: 'User ID required' });
        return;
      }
      
      const fields = [];
      const values = [];
      
      if (body.full_name !== undefined) { fields.push('full_name = ?'); values.push(body.full_name); }
      if (body.email !== undefined) { fields.push('email = ?'); values.push(body.email); }
      if (body.role !== undefined) { fields.push('role = ?'); values.push(body.role); }
      if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
      if (body.username !== undefined) { fields.push('username = ?'); values.push(body.username); }
      
      if (fields.length === 0) {
        res.status(200).json({ success: true, message: 'No changes made' });
        return;
      }
      
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(updateId);
      
      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      const result = db.prepare(query).run(...values);
      
      if (result.changes > 0) {
        res.status(200).json({ success: true, message: 'User updated' });
      } else {
        res.status(200).json({ success: true, message: 'No changes made' });
      }
    } else if (req.method === 'DELETE') {
      if (!id) {
        res.status(400).json({ success: false, message: 'User ID required' });
        return;
      }
      
      // Delete related records first
      db.prepare('DELETE FROM borrowed WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM reservations WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM wishlist WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM history WHERE user_id = ?').run(id);
      
      const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
      
      if (result.changes > 0) {
        res.status(200).json({ success: true, message: 'User deleted' });
      } else {
        res.status(404).json({ success: false, message: 'User not found' });
      }
    } else {
      res.status(405).json({ success: false, message: 'Method not allowed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
