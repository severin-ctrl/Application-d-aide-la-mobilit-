<?php
/**
 * API endpoint pour vérifier si un parking est en favori
 */

require_once __DIR__ . '/../config/Auth.php';
require_once __DIR__ . '/../modele/User.php';

header('Content-Type: application/json');

Auth::startSession();

if (!Auth::isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['is_favorite' => false]);
    exit;
}

$parkingId = $_GET['parking_id'] ?? null;

if (!$parkingId) {
    http_response_code(400);
    echo json_encode(['error' => 'parking_id requis']);
    exit;
}

$userId = Auth::getUserId();
$userModel = new User();

$favoriteId = $userModel->isFavorite($userId, $parkingId);

echo json_encode(['is_favorite' => $favoriteId !== false, 'favorite_id' => $favoriteId]);
