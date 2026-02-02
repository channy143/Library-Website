<?php
// User Login API - File-based Storage
require_once 'config.php';

setCorsHeaders();

// Only accept POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
if (empty($input['username']) || empty($input['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Username and password are required']);
    exit;
}

$username = trim($input['username']);
$password = $input['password'];

// Hardcoded admin login
if ($username === 'dimi' && $password === 'kyutie') {
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => [
            'id' => 'admin',
            'username' => 'dimi',
            'email' => 'admin@example.com',
            'fullName' => 'Admin User'
        ]
    ]);
    exit;
}

// Find user by username or email
$user = findUser($username);

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid username or password']);
    exit;
}

// Verify password
if (!password_verify($password, $user['password'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Invalid username or password']);
    exit;
}

// Login successful
echo json_encode([
    'success' => true,
    'message' => 'Login successful',
    'user' => [
        'id' => $user['id'],
        'username' => $user['username'],
        'email' => $user['email'],
        'fullName' => $user['full_name'],
        'role' => $user['role'] ?? 'user'
    ]
]);
?>
