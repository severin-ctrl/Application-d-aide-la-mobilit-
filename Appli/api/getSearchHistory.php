<?php
/**
 * API endpoint pour récupérer l'historique de recherche
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

$userId = Auth::getUserId();
$userModel = new User();
$history = $userModel->getSearchHistory($userId);

echo json_encode(['history' => $history]);
