const { db, setCorsHeaders } = require('../lib/db');

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { userId } = req.query || {};
  const body = req.body || {};
  const uid = userId || body.userId;

  try {
    if (req.method === 'GET') {
      if (!uid) {
        res.status(400).json({ success: false, message: 'User ID required' });
        return;
      }

      const row = db.prepare(`
        SELECT u.id as user_id, u.username, u.email, u.full_name, u.role, u.status, u.account_balance,
               p.profile_picture, p.phone, p.address, p.bio
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = ?
      `).get(uid);

      if (!row) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }

      res.status(200).json({ success: true, data: row });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      if (!uid) {
        res.status(400).json({ success: false, message: 'User ID required' });
        return;
      }

      const profilePicture = body.profile_picture || body.profilePicture || null;
      const phone = body.phone || null;
      const address = body.address || null;
      const bio = body.bio || null;

      const exists = db.prepare('SELECT COUNT(*) as cnt FROM user_profiles WHERE user_id = ?').get(uid).cnt > 0;

      if (exists) {
        db.prepare('UPDATE user_profiles SET profile_picture = ?, phone = ?, address = ?, bio = ? WHERE user_id = ?').run(profilePicture, phone, address, bio, uid);
      } else {
        db.prepare('INSERT INTO user_profiles (user_id, profile_picture, phone, address, bio) VALUES (?, ?, ?, ?, ?)').run(uid, profilePicture, phone, address, bio);
      }

      res.status(200).json({ success: true, message: 'Profile saved' });

    } else if (req.method === 'DELETE') {
      if (!uid) {
        res.status(400).json({ success: false, message: 'User ID required' });
        return;
      }

      db.prepare('DELETE FROM user_profiles WHERE user_id = ?').run(uid);
      res.status(200).json({ success: true, message: 'Profile deleted' });

    } else {
      res.status(405).json({ success: false, message: 'Method not allowed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
};
