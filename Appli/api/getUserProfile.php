<?php
/**
 * API Endpoint : Récupération du profil utilisateur connecté
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce fichier a une seule responsabilité : retourner le profil de l'utilisateur connecté
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/Auth.php';
require_once __DIR__ . '/../modele/User.php';

// Gestion des erreurs
error_reporting(E_ALL);
ini_set('display_errors', 0);

Auth::startSession();

// Vérifier si l'utilisateur est connecté
if (!Auth::isLoggedIn()) {
    http_response_code(401);
    echo json_encode([
        'error' => 'Non authentifié',
        'message' => 'Vous devez être connecté pour accéder à votre profil'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $userId = Auth::getUserId();
    $userModel = new User();
    $profile = $userModel->getFullProfile($userId);
    
    if (!$profile) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Profil non trouvé',
            'message' => 'Le profil utilisateur n\'a pas pu être récupéré.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Formater les données pour le frontend
    $response = [
        'id_utilisateur' => $profile['id_utilisateur'],
        'email' => $profile['email'],
        'pseudo' => $profile['pseudo'],
        'est_pmr' => (bool)$profile['est_pmr'],
        'preference_cout' => $profile['preference_cout'],
        'vehicules' => $profile['vehicules'] ?? []
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    // Erreur de base de données
    error_log("Erreur BDD dans getUserProfile.php: " . $e->getMessage());
    http_response_code(503);
    echo json_encode([
        'error' => 'Base de données indisponible',
        'message' => 'Impossible de se connecter à la base de données. Veuillez réessayer plus tard.'
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Autres erreurs
    error_log("Erreur dans getUserProfile.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur serveur',
        'message' => 'Une erreur est survenue lors de la récupération du profil.'
    ], JSON_UNESCAPED_UNICODE);
}
