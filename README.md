# Library System - HTML/JavaScript Version

A modern, responsive library management system built with HTML, CSS, and JavaScript.

## Features

✅ **Modern UI Design**
- Gradient backgrounds
- Smooth animations
- Responsive layout
- Clean, professional interface

✅ **Authentication System**
- Hardcoded admin login (dimii/kyutie)
- User registration with localStorage
- Session management
- Form validation

✅ **Pages**
- Welcome/Landing page
- Login page
- Registration page
- Admin Dashboard

## Quick Start

### Option 1: Direct Open
Simply open `index.html` in your web browser.

### Option 2: Local Server (Recommended)
```bash
# Using Python 3
cd "c:\Users\jhone\OneDrive\Desktop\gravity library"
python -m http.server 8000

# Using Node.js (if you have npx)
cd "c:\Users\jhone\OneDrive\Desktop\gravity library"
npx http-server

# Then open: http://localhost:8000
```

## Login Credentials

**Admin Account:**
- Username: `dimii`
- Password: `kyutie`

## File Structure

```
gravity library/
├── index.html          # Welcome page
├── login.html          # Login page
├── register.html       # Registration page
├── dashboard.html      # Admin dashboard
├── css/
│   └── styles.css      # All styles
└── js/
    ├── auth.js         # Authentication logic
    └── dashboard.js    # Dashboard functionality
```

## Navigation Flow

```
index.html (Welcome)
    ↓
login.html ←→ register.html
    ↓
dashboard.html (Admin Panel)
    ↓ (Logout)
login.html
```

## Technologies Used

- **HTML5**: Semantic markup
- **CSS3**: Modern styling with flexbox, gradients, animations
- **JavaScript (ES6)**: Client-side logic
- **SessionStorage**: User session management
- **LocalStorage**: User registration data

## Browser Compatibility

Works on all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Features to Add

- [ ] Book management (CRUD)
- [ ] User management
- [ ] Borrow/Return system
- [ ] Search functionality
- [ ] Statistics dashboard
- [ ] Backend database integration (if needed)

## Notes

- No server or database required for basic functionality
- Registration data stored in browser's localStorage
- Admin login uses hardcoded credentials
- Perfect for demonstration and prototyping
