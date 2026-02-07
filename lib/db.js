const fs = require('fs');
const path = require('path');

// Use /tmp on Vercel (writable), otherwise use local data directory
const isVercel = process.env.VERCEL === '1';
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'library.json');

// In-memory cache for Vercel to persist within function instance
let memoryCache = null;

// Ensure data directory exists (only for local)
if (!isVercel && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database with default data if it doesn't exist
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
    const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString();

    const defaultData = {
      users: [
        {
          id: 1,
          username: 'john_doe',
          email: 'john@example.com',
          password: '$2a$10$hashedpasswordhere',
          full_name: 'John Doe',
          role: 'user',
          status: 'active',
          account_balance: 0,
          created_at: lastWeek,
          updated_at: lastWeek
        },
        {
          id: 2,
          username: 'jane_smith',
          email: 'jane@example.com',
          password: '$2a$10$hashedpasswordhere',
          full_name: 'Jane Smith',
          role: 'user',
          status: 'active',
          account_balance: 0,
          created_at: lastWeek,
          updated_at: lastWeek
        },
        {
          id: 3,
          username: 'alex_reader',
          email: 'alex@example.com',
          password: '$2a$10$hashedpasswordhere',
          full_name: 'Alex Reader',
          role: 'user',
          status: 'active',
          account_balance: 0,
          created_at: lastWeek,
          updated_at: lastWeek
        }
      ],
      books: [
        { id: 1, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', category: 'Fiction', cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800', pdf: null, description: 'A story of decadence and excess in the Jazz Age.', copies: 3, available: 1, created_at: lastWeek },
        { id: 2, title: '1984', author: 'George Orwell', category: 'Sci-Fi', cover: 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=800', pdf: null, description: 'Dystopian social science fiction novel.', copies: 4, available: 2, created_at: lastWeek },
        { id: 3, title: 'To Kill a Mockingbird', author: 'Harper Lee', category: 'Fiction', cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=800', pdf: null, description: 'A novel about racial injustice in the Deep South.', copies: 2, available: 0, status: 'borrowed', created_at: lastWeek },
        { id: 4, title: 'A Brief History of Time', author: 'Stephen Hawking', category: 'Non-Fiction', cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800', pdf: 'brief_history.pdf', description: 'Modern physics for general readers.', copies: 2, available: 1, created_at: lastWeek },
        { id: 5, title: 'Dune', author: 'Frank Herbert', category: 'Sci-Fi', cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=800', pdf: null, description: 'Epic science fiction set on the desert planet Arrakis.', copies: 3, available: 1, created_at: lastWeek },
        { id: 6, title: 'The Hobbit', author: 'J.R.R. Tolkien', category: 'Fantasy', cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800', pdf: null, description: 'A fantasy adventure following Bilbo Baggins.', copies: 5, available: 3, created_at: lastWeek },
        { id: 7, title: 'Pride and Prejudice', author: 'Jane Austen', category: 'Fiction', cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=800', pdf: null, description: 'Romantic novel of manners.', copies: 3, available: 2, created_at: lastWeek },
        { id: 8, title: 'The Catcher in the Rye', author: 'J.D. Salinger', category: 'Fiction', cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800', pdf: null, description: 'Story of teenage angst and alienation.', copies: 2, available: 0, status: 'borrowed', created_at: lastWeek },
        { id: 9, title: 'Sapiens', author: 'Yuval Noah Harari', category: 'Non-Fiction', cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800', pdf: null, description: 'Brief history of humankind.', copies: 4, available: 2, created_at: lastWeek },
        { id: 10, title: 'The Martian', author: 'Andy Weir', category: 'Sci-Fi', cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=800', pdf: null, description: 'An astronaut stranded on Mars fights for survival.', copies: 3, available: 1, created_at: lastWeek }
      ],
      borrowed: [
        {
          id: 1,
          user_id: 1,
          book_id: 3,
          title: 'To Kill a Mockingbird',
          author: 'Harper Lee',
          cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=800',
          borrow_date: lastWeek,
          due_date: nextWeek,
          renewals_used: 0,
          status: 'borrowed'
        },
        {
          id: 2,
          user_id: 1,
          book_id: 8,
          title: 'The Catcher in the Rye',
          author: 'J.D. Salinger',
          cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800',
          borrow_date: lastWeek,
          due_date: nextWeek,
          renewals_used: 1,
          status: 'borrowed'
        },
        {
          id: 3,
          user_id: 2,
          book_id: 10,
          title: 'The Martian',
          author: 'Andy Weir',
          cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=800',
          borrow_date: yesterday,
          due_date: twoWeeks,
          renewals_used: 0,
          status: 'borrowed'
        },
        {
          id: 4,
          user_id: 3,
          book_id: 1,
          title: 'The Great Gatsby',
          author: 'F. Scott Fitzgerald',
          cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800',
          borrow_date: lastWeek,
          due_date: nextWeek,
          renewals_used: 0,
          status: 'borrowed'
        }
      ],
      reservations: [
        {
          id: 1,
          user_id: 1,
          book_id: 5,
          title: 'Dune',
          author: 'Frank Herbert',
          cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=800',
          reservation_date: now,
          pickup_date: null,
          expiry_date: twoWeeks,
          status: 'active'
        },
        {
          id: 2,
          user_id: 2,
          book_id: 2,
          title: '1984',
          author: 'George Orwell',
          cover: 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=800',
          reservation_date: yesterday,
          pickup_date: nextWeek,
          expiry_date: twoWeeks,
          status: 'active'
        }
      ],
      history: [
        {
          id: 1,
          user_id: 1,
          book_id: 2,
          title: '1984',
          author: 'George Orwell',
          cover: 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=800',
          action: 'returned',
          action_date: yesterday,
          details: 'Book returned on time'
        },
        {
          id: 2,
          user_id: 1,
          book_id: 6,
          title: 'The Hobbit',
          author: 'J.R.R. Tolkien',
          cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800',
          action: 'returned',
          action_date: lastWeek,
          details: 'Book returned early'
        },
        {
          id: 3,
          user_id: 1,
          book_id: 3,
          title: 'To Kill a Mockingbird',
          author: 'Harper Lee',
          cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=800',
          action: 'borrowed',
          action_date: lastWeek,
          details: 'Book borrowed'
        },
        {
          id: 4,
          user_id: 2,
          book_id: 7,
          title: 'Pride and Prejudice',
          author: 'Jane Austen',
          cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=800',
          action: 'returned',
          action_date: yesterday,
          details: 'Book returned'
        }
      ],
      wishlist: [
        {
          id: 1,
          user_id: 1,
          book_id: 6,
          title: 'The Hobbit',
          author: 'J.R.R. Tolkien',
          cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800',
          added_date: lastWeek
        },
        {
          id: 2,
          user_id: 1,
          book_id: 9,
          title: 'Sapiens',
          author: 'Yuval Noah Harari',
          cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800',
          added_date: now
        }
      ],
      user_profiles: [
        {
          id: 1,
          user_id: 1,
          phone: '+1-555-0123',
          bio: 'Avid reader of fiction and sci-fi. Love discovering new authors.',
          preferences: JSON.stringify({ theme: 'dark', notifications: true }),
          avatar_url: null
        },
        {
          id: 2,
          user_id: 2,
          phone: '+1-555-0456',
          bio: 'History enthusiast and non-fiction reader.',
          preferences: JSON.stringify({ theme: 'light', notifications: true }),
          avatar_url: null
        }
      ],
      favorite_books: [
        {
          id: 1,
          user_id: 1,
          book_id: 2,
          title: '1984',
          author: 'George Orwell',
          cover: 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=800'
        },
        {
          id: 2,
          user_id: 1,
          book_id: 5,
          title: 'Dune',
          author: 'Frank Herbert',
          cover: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=800'
        }
      ],
      recently_read_books: [
        {
          id: 1,
          user_id: 1,
          book_id: 2,
          title: '1984',
          author: 'George Orwell',
          cover: 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=800',
          read_date: yesterday
        },
        {
          id: 2,
          user_id: 1,
          book_id: 6,
          title: 'The Hobbit',
          author: 'J.R.R. Tolkien',
          cover: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800',
          read_date: lastWeek
        }
      ],
      admin_notifications: [],
      penalties: [],
      payment_transactions: [],
      book_holds: [],
      book_ratings: [
        {
          id: 1,
          user_id: 1,
          book_id: 2,
          rating: 5,
          review: 'Absolutely brilliant dystopian novel.',
          created_at: lastWeek
        },
        {
          id: 2,
          user_id: 1,
          book_id: 6,
          rating: 4,
          review: 'Classic fantasy adventure.',
          created_at: lastWeek
        }
      ]
    };
    saveData(defaultData);
    return defaultData;
  }
  return loadData();
}

function loadData() {
  // Use memory cache if available (Vercel optimization)
  if (memoryCache) {
    return memoryCache;
  }
  
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    memoryCache = parsed; // Cache in memory
    return parsed;
  } catch (e) {
    return initDatabase();
  }
}

function saveData(data) {
  memoryCache = data; // Update cache
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    // If file write fails (read-only), at least keep in memory
    console.log('File write failed, using memory cache only');
  }
}

// Database operations
const db = {
  prepare: (query) => {
    const data = loadData();
    return {
      get: (...params) => {
        // Simple query handling for GET operations
        const [id] = params;
        const table = getTableFromQuery(query);
        if (table && id) {
          return data[table]?.find(item => item.id === id || item.user_id === id);
        }
        return null;
      },
      all: (...params) => {
        const data = loadData();
        const table = getTableFromQuery(query);
        if (table) {
          let results = data[table] || [];
          // Simple filtering for user-specific queries
          if (params.length > 0 && query.includes('userId') || query.includes('user_id')) {
            const userId = params[0];
            results = results.filter(item => item.user_id === userId || item.userId === userId);
          }
          return results;
        }
        return [];
      },
      run: (...params) => {
        const data = loadData();
        const table = getTableFromQuery(query);
        if (table) {
          if (!data[table]) data[table] = [];
          
          // Handle INSERT
          if (query.toLowerCase().includes('insert')) {
            const newItem = {};
            const columns = query.match(/\(([^)]+)\)/)?.[1].split(',').map(c => c.trim().replace(/^:+/, ''));
            if (columns) {
              columns.forEach((col, i) => {
                if (params[i] !== undefined) newItem[col] = params[i];
              });
            }
            newItem.id = Date.now();
            data[table].push(newItem);
            saveData(data);
            return { lastInsertRowid: newItem.id, changes: 1 };
          }
          
          // Handle UPDATE
          if (query.toLowerCase().includes('update')) {
            const id = params[params.length - 1];
            const itemIndex = data[table].findIndex(item => item.id === id);
            if (itemIndex > -1) {
              const item = data[table][itemIndex];
              const setMatch = query.match(/SET\s+(.+?)\s+WHERE/i);
              if (setMatch) {
                const setClauses = setMatch[1].split(',').map(s => s.trim());
                setClauses.forEach((clause, i) => {
                  const col = clause.match(/^(\w+)\s*=/)[1];
                  if (params[i] !== undefined) item[col] = params[i];
                });
              }
              saveData(data);
              return { changes: 1 };
            }
            return { changes: 0 };
          }
          
          // Handle DELETE
          if (query.toLowerCase().includes('delete')) {
            const id = params[0];
            const initialLength = data[table].length;
            data[table] = data[table].filter(item => item.id !== id);
            saveData(data);
            return { changes: initialLength - data[table].length };
          }
        }
        return { changes: 0 };
      }
    };
  },
  exec: (query) => {
    // For CREATE TABLE and other DDL
    const data = loadData();
    const tableMatch = query.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (tableMatch) {
      const table = tableMatch[1];
      if (!data[table]) data[table] = [];
      saveData(data);
    }
  }
};

function getTableFromQuery(query) {
  const fromMatch = query.match(/FROM\s+(\w+)/i);
  const insertMatch = query.match(/INTO\s+(\w+)/i);
  const updateMatch = query.match(/UPDATE\s+(\w+)/i);
  const deleteMatch = query.match(/DELETE\s+FROM\s+(\w+)/i);
  return fromMatch?.[1] || insertMatch?.[1] || updateMatch?.[1] || deleteMatch?.[1];
}

// User helper functions
function findUser(usernameOrEmail) {
  const data = loadData();
  return data.users.find(user => user.username === usernameOrEmail || user.email === usernameOrEmail);
}

function userExists(username, email) {
  const data = loadData();
  return data.users.some(user => user.username === username || user.email === email);
}

function addUser(userData) {
  const data = loadData();
  const now = new Date().toISOString();
  const newUser = {
    id: Date.now(),
    username: userData.username,
    email: userData.email,
    password: userData.password,
    full_name: userData.full_name || '',
    role: userData.role || 'user',
    status: 'active',
    account_balance: 0,
    created_at: now,
    updated_at: now
  };
  data.users.push(newUser);
  saveData(data);
  return newUser.id;
}

function getUsers() {
  const data = loadData();
  return data.users;
}

// CORS headers helper
function setCorsHeaders(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = {
  db,
  findUser,
  userExists,
  addUser,
  getUsers,
  setCorsHeaders,
  loadData,
  saveData
};
