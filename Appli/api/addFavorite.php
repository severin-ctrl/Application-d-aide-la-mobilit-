<?php
/**
 * API endpoint pour ajouter un parking aux favoris
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
$parkingId = $data['parking_id'] ?? null;
$customName = $data['custom_name'] ?? null;

if (!$parkingId) {
    http_response_code(400);
    echo json_encode(['error' => 'parking_id requis']);
    exit;
}

$userId = Auth::getUserId();
$userModel = new User();

$result = $userModel->addFavorite($userId, $parkingId, $customName);

if ($result === false) {
    http_response_code(400);
    echo json_encode(['error' => 'Impossible d\'ajouter le favori (limite atteinte ou déjà en favori)']);
    exit;
}

echo json_encode(['success' => true, 'favorite_id' => $result]);
