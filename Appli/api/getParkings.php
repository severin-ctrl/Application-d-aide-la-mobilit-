<?php
/**
 * API Endpoint : Récupération des parkings
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce fichier a une seule responsabilité : servir les données de parkings en JSON standardisé
 * 
 * Pattern Design : Strategy
 * Utilise le ParkingProviderFactory pour obtenir le bon provider selon la ville
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Gestion des erreurs
error_reporting(E_ALL);
ini_set('display_errors', 0);

require_once __DIR__ . '/../providers/ParkingProviderFactory.php';
require_once __DIR__ . '/../config/cities.php';

// Point d'entrée de l'API
try {
    // Récupérer le paramètre de ville (par défaut : Metz)
    $cityCode = $_GET['city'] ?? 'metz';
    $cityCode = strtolower(trim($cityCode));
    
    // Vérifier que la ville est supportée
    if (!ParkingProviderFactory::isCitySupported($cityCode)) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Ville non supportée',
            'message' => "La ville '{$cityCode}' n'est pas supportée",
            'supported_cities' => array_keys(require __DIR__ . '/../config/cities.php')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Créer le provider approprié
    $provider = ParkingProviderFactory::create($cityCode);
    
    // Vérifier si c'est une recherche
    if (isset($_GET['q']) && !empty($_GET['q'])) {
        $query = trim($_GET['q']);
        $parkings = $provider->searchParkings($query);
    } else {
        $parkings = $provider->getAllParkings();
    }
    
    // Vérifier si les parkings sont null (erreur API externe)
    if ($parkings === null) {
        http_response_code(503);
        echo json_encode([
            'error' => 'Service temporairement indisponible',
            'message' => 'Impossible de récupérer les données des parkings. L\'API externe est peut-être indisponible.',
            'city' => $cityCode,
            'parkings' => [],
            'count' => 0
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Retourner les données au format standardisé
    echo json_encode([
        'city' => $cityCode,
        'parkings' => $parkings,
        'count' => count($parkings)
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (PDOException $e) {
    // Erreur de base de données
    error_log("Erreur BDD dans getParkings.php: " . $e->getMessage());
    http_response_code(503);
    echo json_encode([
        'error' => 'Base de données indisponible',
        'message' => 'Impossible de se connecter à la base de données. Veuillez réessayer plus tard.'
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    // Autres erreurs
    error_log("Erreur dans getParkings.php: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur serveur',
        'message' => 'Une erreur est survenue lors de la récupération des parkings.'
    ], JSON_UNESCAPED_UNICODE);
}
