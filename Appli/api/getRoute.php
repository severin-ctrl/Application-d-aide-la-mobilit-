<?php
/**
 * API Endpoint : Calcul d'itinéraire
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce fichier a une seule responsabilité : calculer et retourner un itinéraire
 * 
 * Note : Cette API fait office de proxy vers OSRM pour éviter les problèmes CORS
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Gestion des erreurs
error_reporting(E_ALL);
ini_set('display_errors', 0);

/**
 * Service de calcul d'itinéraire
 * Principe : Separation of Concerns
 */
class RouteService {
    private const OSRM_API_URL = 'https://router.project-osrm.org/route/v1/driving';
    
    /**
     * Calcule un itinéraire entre deux points
     * 
     * @param float $lat1 Latitude du point de départ
     * @param float $lng1 Longitude du point de départ
     * @param float $lat2 Latitude du point d'arrivée
     * @param float $lng2 Longitude du point d'arrivée
     * @return array Données de l'itinéraire
     */
    public function calculateRoute(float $lat1, float $lng1, float $lat2, float $lng2): array {
        // Format OSRM : longitude,latitude (attention à l'ordre !)
        $url = sprintf(
            '%s/%f,%f;%f,%f?overview=full&geometries=geojson',
            self::OSRM_API_URL,
            $lng1, $lat1,
            $lng2, $lat2
        );
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'method' => 'GET',
                'header' => 'User-Agent: SAE301-ParkingApp/1.0'
            ]
        ]);
        
        $json = @file_get_contents($url, false, $context);
        
        if ($json === false) {
            throw new Exception("Impossible de calculer l'itinéraire");
        }
        
        $data = json_decode($json, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Erreur de décodage JSON");
        }
        
        if (!isset($data['routes']) || empty($data['routes'])) {
            throw new Exception("Aucun itinéraire trouvé");
        }
        
        return $data;
    }
}

// Point d'entrée de l'API
try {
    // Vérifier les paramètres requis
    if (!isset($_GET['lat1']) || !isset($_GET['lng1']) || 
        !isset($_GET['lat2']) || !isset($_GET['lng2'])) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Paramètres manquants',
            'message' => 'Les paramètres lat1, lng1, lat2, lng2 sont requis'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    $lat1 = floatval($_GET['lat1']);
    $lng1 = floatval($_GET['lng1']);
    $lat2 = floatval($_GET['lat2']);
    $lng2 = floatval($_GET['lng2']);
    
    // Validation des coordonnées
    if ($lat1 < -90 || $lat1 > 90 || $lat2 < -90 || $lat2 > 90 ||
        $lng1 < -180 || $lng1 > 180 || $lng2 < -180 || $lng2 > 180) {
        http_response_code(400);
        echo json_encode([
            'error' => 'Coordonnées invalides'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    $service = new RouteService();
    $result = $service->calculateRoute($lat1, $lng1, $lat2, $lng2);
    
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur serveur',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
