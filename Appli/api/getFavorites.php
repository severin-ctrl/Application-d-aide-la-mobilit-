<?php
/**
 * API endpoint pour récupérer les favoris de l'utilisateur connecté
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
$favorites = $userModel->getFavorites($userId);

echo json_encode(['favorites' => $favorites]);
