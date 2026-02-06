const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const ROOT_DIR = path.join(__dirname);

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// API handlers
const apiHandlers = {
  '/api/auth': require('./api/auth.js'),
  '/api/books': require('./api/books.js'),
  '/api/borrow': require('./api/borrow.js'),
  '/api/lists': require('./api/lists.js'),
  '/api/history': require('./api/history.js'),
  '/api/ratings': require('./api/ratings.js'),
  '/api/reserve': require('./api/reserve.js'),
  '/api/discover': require('./api/discover.js'),
  '/api/user': require('./api/user.js')
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // Handle API routes
  const apiPath = pathname.replace(/\.js$/, '');
  if (apiHandlers[apiPath]) {
    // Set CORS headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    // Parse body for POST/PUT requests
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (e) {
        req.body = {};
      }
      req.query = parsedUrl.query;
      
      // Mock Express response methods
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.end(JSON.stringify(data));
      };
      
      try {
        apiHandlers[apiPath](req, res);
      } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    });
    return;
  }

  // Serve static files
  if (pathname === '/') pathname = '/index.html';
  
  const filePath = path.join(ROOT_DIR, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('File not found');
      } else {
        res.statusCode = 500;
        res.end('Server error');
      }
    } else {
      res.setHeader('Content-Type', contentType);
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
