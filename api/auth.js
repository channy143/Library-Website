const { db, findUser, setCorsHeaders, loadData, saveData } = require('../lib/db');
const bcrypt = require('bcryptjs');

module.exports = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET /api/auth?action=list - Get all users (admin)
  if (req.method === 'GET' && action === 'list') {
    const data = loadData();
    const users = data.users.map(u => ({ ...u, password: undefined }));
    res.json({ success: true, data: users });
    return;
  }

  // GET /api/auth?id=X - Get specific user
  if (req.method === 'GET' && url.searchParams.get('id')) {
    const id = parseInt(url.searchParams.get('id'));
    const data = loadData();
    const user = data.users.find(u => u.id === id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    const { password, ...userWithoutPassword } = user;
    res.json({ success: true, data: userWithoutPassword });
    return;
  }

  // POST /api/auth - Login or Register
  if (req.method === 'POST') {
    const body = req.body;
    
    // Register
    if (body.username && body.email && body.password && !body.action) {
      if (findUser(body.username) || findUser(body.email)) {
        res.status(400).json({ success: false, error: 'Username or email already exists' });
        return;
      }
      
      const hashedPassword = bcrypt.hashSync(body.password, 10);
      const newId = Date.now();
      const data = loadData();
      data.users.push({
        id: newId,
        username: body.username,
        email: body.email,
        password: hashedPassword,
        full_name: body.full_name || '',
        role: 'user',
        status: 'active',
        account_balance: 0,
        created_at: new Date().toISOString()
      });
      saveData(data);
      
      res.json({
        success: true,
        message: 'User registered successfully',
        user: { id: newId, username: body.username, email: body.email }
      });
      return;
    }
    
    // Login
    if (body.username && body.password) {
      const trimmedUsername = body.username.trim();
      
      // Admin login
      if (trimmedUsername === 'dimii' && body.password === 'kyutie') {
        res.json({
          success: true,
          message: 'Login successful',
          user: {
            id: 'admin',
            username: 'dimii',
            email: 'admin@example.com',
            fullName: 'Admin User',
            role: 'admin'
          }
        });
        return;
      }
      
      const user = findUser(trimmedUsername);
      if (!user || !bcrypt.compareSync(body.password, user.password)) {
        res.status(401).json({ success: false, error: 'Invalid credentials' });
        return;
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json({ success: true, message: 'Login successful', user: userWithoutPassword });
      return;
    }
    
    res.status(400).json({ success: false, error: 'Invalid request' });
    return;
  }

  // PUT /api/auth?id=X - Update user
  if (req.method === 'PUT') {
    const id = parseInt(url.searchParams.get('id'));
    const data = loadData();
    const userIndex = data.users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    
    const body = req.body;
    if (body.full_name) data.users[userIndex].full_name = body.full_name;
    if (body.email) data.users[userIndex].email = body.email;
    if (body.password) data.users[userIndex].password = bcrypt.hashSync(body.password, 10);
    if (body.role) data.users[userIndex].role = body.role;
    if (body.status) data.users[userIndex].status = body.status;
    
    data.users[userIndex].updated_at = new Date().toISOString();
    saveData(data);
    
    const { password, ...userWithoutPassword } = data.users[userIndex];
    res.json({ success: true, message: 'User updated', data: userWithoutPassword });
    return;
  }

  // DELETE /api/auth?id=X - Delete user
  if (req.method === 'DELETE') {
    const id = parseInt(url.searchParams.get('id'));
    const data = loadData();
    const initialLength = data.users.length;
    data.users = data.users.filter(u => u.id !== id);
    saveData(data);
    
    if (data.users.length === initialLength) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    
    res.json({ success: true, message: 'User deleted' });
    return;
  }

  res.status(405).json({ success: false, error: 'Method not allowed' });
};
