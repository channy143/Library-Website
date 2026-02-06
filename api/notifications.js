const { db, setCorsHeaders } = require('../lib/db');

function createBorrowerNudge(targetUserId, requesterUserId, bookId, bookTitleOverride = null) {
  const reqRow = db.prepare('SELECT full_name, username FROM users WHERE id = ?').get(requesterUserId);
  const requesterName = reqRow?.full_name || reqRow?.username || `User #${requesterUserId}`;
  
  let title = bookTitleOverride;
  if (!title && bookId) {
    const bRow = db.prepare('SELECT title FROM books WHERE id = ?').get(bookId);
    if (bRow) title = bRow.title;
  }
  if (!title) title = 'a book you borrowed';
  
  const message = `${requesterName} has requested that you return "${title}" so they can borrow it. Your loan is already overdue.`;
  
  db.prepare('INSERT INTO admin_notifications (user_id, book_id, notification_type, message, is_read) VALUES (?, ?, ?, ?, 0)').run(targetUserId, bookId, 'borrower_nudge', message);
  
  return { success: true, message: 'Notification created' };
}

function listNotificationsForUser(userId) {
  const rows = db.prepare(`
    SELECT n.id, n.book_id, n.notification_type, n.message, n.created_at, b.title
    FROM admin_notifications n
    LEFT JOIN books b ON b.id = n.book_id
    WHERE n.user_id = ? AND n.is_read = 0
    ORDER BY n.created_at DESC
  `).all(userId);
  
  return rows.map(row => ({
    id: row.id,
    bookId: row.book_id,
    type: row.notification_type,
    message: row.message,
    createdAt: row.created_at,
    bookTitle: row.title
  }));
}

function listAllUnreadNotifications() {
  const rows = db.prepare(`
    SELECT n.*, b.title as book_title, u.username, u.full_name
    FROM admin_notifications n
    LEFT JOIN books b ON b.id = n.book_id
    LEFT JOIN users u ON u.id = n.user_id
    WHERE n.is_read = 0
    ORDER BY n.created_at DESC
  `).all();
  
  return rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    type: row.notification_type,
    message: row.message,
    createdAt: row.created_at,
    bookTitle: row.book_title,
    userName: row.full_name || row.username
  }));
}

function markNotificationRead(notificationId) {
  db.prepare('UPDATE admin_notifications SET is_read = 1 WHERE id = ?').run(notificationId);
  return { success: true, message: 'Notification marked as read' };
}

function markAllNotificationsRead(userId) {
  db.prepare('UPDATE admin_notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  return { success: true, message: 'All notifications marked as read' };
}

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { action, userId, id, targetUserId, requesterUserId, bookId, bookTitle } = req.query || {};
  const body = req.body || {};

  try {
    switch (action) {
      case 'nudge':
        if (!targetUserId || !requesterUserId || !bookId) {
          res.status(400).json({ success: false, message: 'Missing required IDs' });
          return;
        }
        res.status(200).json(createBorrowerNudge(parseInt(targetUserId), parseInt(requesterUserId), parseInt(bookId), bookTitle || body.bookTitle));
        break;
        
      case 'list':
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json({ success: true, data: listNotificationsForUser(parseInt(userId)) });
        break;
        
      case 'adminList':
        res.status(200).json({ success: true, data: listAllUnreadNotifications() });
        break;
        
      case 'markRead':
        const notifId = id || body.id;
        if (!notifId) {
          res.status(400).json({ success: false, message: 'Notification ID required' });
          return;
        }
        res.status(200).json(markNotificationRead(parseInt(notifId)));
        break;
        
      case 'markAllRead':
        if (!userId) {
          res.status(400).json({ success: false, message: 'User ID required' });
          return;
        }
        res.status(200).json(markAllNotificationsRead(parseInt(userId)));
        break;
        
      default:
        res.status(400).json({ success: false, message: 'Invalid action' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
