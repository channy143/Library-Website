<?php
// User Registration API - File-based Storage
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
if (empty($input['username']) || empty($input['email']) || empty($input['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Username, email, and password are required']);
    exit;
}

$username = trim($input['username']);
$email = trim($input['email']);
$password = $input['password'];
$fullName = isset($input['fullName']) ? trim($input['fullName']) : '';

// Validate email format
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid email format']);
    exit;
}

// Validate username (alphanumeric, 3-50 chars)
if (!preg_match('/^[a-zA-Z0-9_]{3,50}$/', $username)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Username must be 3-50 characters and contain only letters, numbers, and underscores']);
    exit;
}

// Validate password length
if (strlen($password) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Password must be at least 6 characters']);
    exit;
}

// Check if username or email already exists
if (userExists($username, $email)) {
    http_response_code(409);
    echo json_encode(['success' => false, 'error' => 'Username or email already exists']);
    exit;
}

// Hash the password
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Create new user with role
$role = isset($input['role']) && $input['role'] === 'admin' ? 'admin' : 'user';
$userId = addUser([
    'username' => $username,
    'email' => $email,
    'password' => $hashedPassword,
    'full_name' => $fullName,
    'role' => $role
]);

echo json_encode([
    'success' => true,
    'message' => 'Registration successful',
    'user' => [
        'id' => $userId,
        'username' => $username,
        'email' => $email,
        'fullName' => $fullName,
        'role' => $role
    ]
]);
?>
