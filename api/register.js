const { db, userExists, addUser, setCorsHeaders } = require('../lib/db');
const bcrypt = require('bcryptjs');

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

  const { username, email, password, fullName, role } = req.body || {};

  if (!username || !email || !password) {
    res.status(400).json({ success: false, error: 'Username, email, and password are required' });
    return;
  }

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim();
  const trimmedFullName = fullName ? fullName.trim() : '';

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    res.status(400).json({ success: false, error: 'Invalid email format' });
    return;
  }

  // Validate username (alphanumeric, 3-50 chars)
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
  if (!usernameRegex.test(trimmedUsername)) {
    res.status(400).json({ success: false, error: 'Username must be 3-50 characters and contain only letters, numbers, and underscores' });
    return;
  }

  // Validate password length
  if (password.length < 6) {
    res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    return;
  }

  // Check if username or email already exists
  if (userExists(trimmedUsername, trimmedEmail)) {
    res.status(409).json({ success: false, error: 'Username or email already exists' });
    return;
  }

  // Hash the password
  const hashedPassword = bcrypt.hashSync(password, 10);

  // Create new user with role
  const userRole = role === 'admin' ? 'admin' : 'user';
  const userId = addUser({
    username: trimmedUsername,
    email: trimmedEmail,
    password: hashedPassword,
    full_name: trimmedFullName,
    role: userRole
  });

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    user: {
      id: userId,
      username: trimmedUsername,
      email: trimmedEmail,
      fullName: trimmedFullName,
      role: userRole
    }
  });
};
