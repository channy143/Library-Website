<?php
require_once 'config.php';

$db = getDB();
setCorsHeaders();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$userId = $_GET['userId'] ?? ($input['userId'] ?? null);

try {
    switch ($method) {
        case 'GET':
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                break;
            }

            $stmt = $db->prepare('SELECT u.id as user_id, u.username, u.email, u.full_name, u.role, u.status, u.account_balance, p.profile_picture, p.phone, p.address, p.bio FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = :uid');
            $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
            $result = $stmt->execute();
            $row = $result->fetchArray(SQLITE3_ASSOC) ?: null;

            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'User not found']);
                break;
            }

            echo json_encode(['success' => true, 'data' => $row]);
            break;

        case 'POST':
        case 'PUT':
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                break;
            }

            $profilePicture = $input['profile_picture'] ?? $input['profilePicture'] ?? null;
            $phone = $input['phone'] ?? null;
            $address = $input['address'] ?? null;
            $bio = $input['bio'] ?? null;

            $check = $db->prepare('SELECT COUNT(*) as cnt FROM user_profiles WHERE user_id = :uid');
            $check->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
            $countRow = $check->execute()->fetchArray(SQLITE3_ASSOC);
            $exists = ($countRow && (int)$countRow['cnt'] > 0);

            if ($exists) {
                $stmt = $db->prepare('UPDATE user_profiles SET profile_picture = :pic, phone = :phone, address = :addr, bio = :bio WHERE user_id = :uid');
            } else {
                $stmt = $db->prepare('INSERT INTO user_profiles (user_id, profile_picture, phone, address, bio) VALUES (:uid, :pic, :phone, :addr, :bio)');
            }

            $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
            $stmt->bindValue(':pic', $profilePicture, SQLITE3_TEXT);
            $stmt->bindValue(':phone', $phone, SQLITE3_TEXT);
            $stmt->bindValue(':addr', $address, SQLITE3_TEXT);
            $stmt->bindValue(':bio', $bio, SQLITE3_TEXT);
            $stmt->execute();

            // Return updated profile
            $_GET['userId'] = $userId;
            $_SERVER['REQUEST_METHOD'] = 'GET';
            echo json_encode(['success' => true, 'message' => 'Profile saved']);
            break;

        case 'DELETE':
            if (!$userId) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'User ID required']);
                break;
            }
            $stmt = $db->prepare('DELETE FROM user_profiles WHERE user_id = :uid');
            $stmt->bindValue(':uid', (int)$userId, SQLITE3_INTEGER);
            $stmt->execute();
            echo json_encode(['success' => true, 'message' => 'Profile deleted']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error: ' . $e->getMessage()]);
}
?>
