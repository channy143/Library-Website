// Authentication functionality with Database Integration

// API Base URL - Update this based on your XAMPP setup
// When running from XAMPP, use: http://localhost/gravity-library/api
// When running locally, the path may need adjustment
const API_BASE = 'api';

// In-browser fallback user store (used when API is unavailable)
const FALLBACK_USERS_KEY = 'demo_users';
function getFallbackUsers() {
    try {
        const raw = localStorage.getItem(FALLBACK_USERS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}
function saveFallbackUsers(users) {
    try {
        localStorage.setItem(FALLBACK_USERS_KEY, JSON.stringify(users));
    } catch (e) { }
}
// Seed a couple of demo users if none exist
function ensureDemoUsers() {
    const users = getFallbackUsers();
    if (users.length === 0) {
        const demo = [
            { id: 'demo_user_1', username: 'alice', password: '123456', fullName: 'Alice Member', email: 'alice@example.com', role: 'member' },
            { id: 'demo_user_2', username: 'bob', password: '123456', fullName: 'Bob Reader', email: 'bob@example.com', role: 'member' }
        ];
        saveFallbackUsers(demo);
    }
}
ensureDemoUsers();

// Handle Login
async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = event.target.querySelector('button[type="submit"]');

    // Hardcoded admin credentials
    if (username === 'dimii' && password === 'kyutie') {
        const adminUser = {
            id: 'admin',
            username: 'dimi',
            email: 'admin@example.com',
            fullName: 'Admin User',
            role: 'admin'
        };

        sessionStorage.setItem('currentUser', JSON.stringify(adminUser));
        window.location.href = 'admin-dashboard.html';
        return;
    }

    // Disable button during request
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            sessionStorage.setItem('currentUser', JSON.stringify(data.user));
            const user = data.user || {};
            const isAdmin = user.username === 'dimi' || user.id === 'admin' || user.role === 'admin';
            window.location.href = isAdmin ? 'admin-dashboard.html' : 'dashboard.html';
        } else {
            // Show error message
            errorMessage.textContent = data.error || 'Invalid username or password';
            errorMessage.style.display = 'block';

            // Hide error after 3 seconds
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error('Login error:', error);
        // Fallback to in-browser user store when API is unavailable
        const users = getFallbackUsers();
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            const userObj = {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                role: user.role
            };
            sessionStorage.setItem('currentUser', JSON.stringify(userObj));
            const isAdmin = userObj.username === 'dimi' || userObj.id === 'admin' || userObj.role === 'admin';
            window.location.href = isAdmin ? 'admin-dashboard.html' : 'dashboard.html';
            return;
        } else {
            errorMessage.textContent = 'Invalid username or password (offline mode).';
            errorMessage.style.display = 'block';
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 3000);
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
    }
}

// Handle Registration
async function handleRegister(event) {
    event.preventDefault();

    const fullName = document.getElementById('fullName').value;
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');

    // Validation
    if (password !== confirmPassword) {
        showMessage('Passwords do not match!', 'error');
        return;
    }

    if (password.length < 6) {
        showMessage('Password must be at least 6 characters long!', 'error');
        return;
    }

    // Enhanced password strength check
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (password.length < 8 || !(hasUpperCase || hasLowerCase) || !hasNumber) {
        showMessage('Password should be 8+ chars with letters and numbers for better security.', 'error');
        return;
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Please enter a valid email address!', 'error');
        return;
    }

    // Username validation
    if (username.length < 3) {
        showMessage('Username must be at least 3 characters!', 'error');
        return;
    }

    // Disable button during request
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fullName,
                username,
                email,
                password
            })
        });

        const data = await response.json();

        if (data.success) {
            // Show success message
            showMessage('Registration successful! Redirecting to login...', 'success');

            // Redirect to login after 1.5 seconds
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        } else {
            showMessage(data.error || 'Registration failed. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        // Fallback to in-browser store when API is unavailable
        const users = getFallbackUsers();
        if (users.some(u => u.username === username || u.email === email)) {
            showMessage('Username or email already exists (offline mode).', 'error');
            return;
        }
        const newUser = {
            id: 'demo_user_' + Date.now(),
            username,
            email,
            fullName,
            password,
            role: 'member'
        };
        users.push(newUser);
        saveFallbackUsers(users);
        showMessage('Registration successful! Redirecting to login...', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
    }
}

// Helper function to show messages
function showMessage(text, type) {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;

    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';

    if (type === 'error') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }
}
