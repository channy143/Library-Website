const { db, findUser, setCorsHeaders } = require('../lib/db');

module.exports = (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    res.status(400).json({ success: false, error: 'Username and password are required' });
    return;
  }

  const trimmedUsername = username.trim();

  // Hardcoded admin login
  if (trimmedUsername === 'dimii' && password === 'kyutie') {
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: 'admin',
        username: 'dimii',
        email: 'admin@example.com',
        fullName: 'Admin User'
      }
    });
    return;
  }

  // Find user by username or email
  const user = findUser(trimmedUsername);

  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid username or password' });
    return;
  }

  // Verify password (using bcrypt compare would be better, but for now we check hashed)
  const bcrypt = require('bcryptjs');
  if (!bcrypt.compareSync(password, user.password)) {
    res.status(401).json({ success: false, error: 'Invalid username or password' });
    return;
  }

  // Login successful
  res.status(200).json({
    success: true,
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role || 'user'
    }
  });
};
