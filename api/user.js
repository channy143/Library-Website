const { setCorsHeaders, loadData, saveData } = require('../lib/db');

module.exports = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || 'profile';
  
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const data = loadData();

  // GET /api/user?action=profile&userId=X
  if (req.method === 'GET' && action === 'profile') {
    const userId = parseInt(url.searchParams.get('userId'));
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId required' });
      return;
    }
    
    const profile = data.user_profiles?.find(p => p.user_id === userId);
    res.json({ success: true, data: profile || {} });
    return;
  }

  // GET /api/user?action=notifications&userId=X
  if (req.method === 'GET' && action === 'notifications') {
    const userId = url.searchParams.get('userId');
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId required' });
      return;
    }
    
    const notifs = data.admin_notifications?.filter(n => 
      n.user_id === userId || n.recipient_id === userId
    ) || [];
    
    res.json({ success: true, data: notifs });
    return;
  }

  // POST /api/user?action=profile - Create/Update profile
  if (req.method === 'POST' && action === 'profile') {
    const body = req.body;
    const userId = body.userId || body.user_id;
    
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId required' });
      return;
    }
    
    if (!data.user_profiles) data.user_profiles = [];
    
    const existingIndex = data.user_profiles.findIndex(p => p.user_id === parseInt(userId));
    
    if (existingIndex > -1) {
      // Update
      data.user_profiles[existingIndex] = {
        ...data.user_profiles[existingIndex],
        phone: body.phone || data.user_profiles[existingIndex].phone,
        bio: body.bio || data.user_profiles[existingIndex].bio,
        updated_at: new Date().toISOString()
      };
    } else {
      // Create
      data.user_profiles.push({
        id: Date.now(),
        user_id: parseInt(userId),
        phone: body.phone || '',
        bio: body.bio || '',
        preferences: JSON.stringify({ theme: 'light', notifications: true }),
        avatar_url: null,
        created_at: new Date().toISOString()
      });
    }
    
    saveData(data);
    res.json({ success: true, message: 'Profile saved' });
    return;
  }

  // POST /api/user?action=markRead - Mark notification as read
  if (req.method === 'POST' && action === 'markRead') {
    const body = req.body;
    const notifId = body.id;
    
    if (!notifId || !data.admin_notifications) {
      res.status(400).json({ success: false, error: 'Notification ID required' });
      return;
    }
    
    const notifIndex = data.admin_notifications.findIndex(n => n.id === parseInt(notifId));
    if (notifIndex > -1) {
      data.admin_notifications[notifIndex].is_read = 1;
      data.admin_notifications[notifIndex].read_at = new Date().toISOString();
      saveData(data);
    }
    
    res.json({ success: true });
    return;
  }

  res.status(405).json({ success: false, error: 'Method not allowed' });
};
