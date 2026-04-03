<?php
/**
 * API endpoint pour supprimer un favori
 */

require_once __DIR__ . '/../config/Auth.php';
require_once __DIR__ . '/../modele/User.php';

header('Content-Type: application/json');

Auth::startSession();

if (!Auth::isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['error' => 'Non authentifié']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Méthode non autorisée']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$favoriteId = $data['favorite_id'] ?? null;

if (!$favoriteId) {
    http_response_code(400);
    echo json_encode(['error' => 'favorite_id requis']);
    exit;
}

$userId = Auth::getUserId();
$userModel = new User();

$result = $userModel->removeFavorite((int)$favoriteId, $userId);

if (!$result) {
    http_response_code(400);
    echo json_encode(['error' => 'Impossible de supprimer le favori']);
    exit;
}

echo json_encode(['success' => true]);
