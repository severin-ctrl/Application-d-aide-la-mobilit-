<?php
/**
 * Provider pour les parkings de Londres
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Cette classe a une seule responsabilité : adapter les données de Londres au format standardisé
 * 
 * Pattern Design : Adapter
 * Adapte le format REST de l'API TfL au format standardisé de l'application
 */

require_once __DIR__ . '/ParkingProviderInterface.php';

class LondonParkingProvider implements ParkingProviderInterface {
    private const API_BASE_URL = 'https://api.tfl.gov.uk/Place/Type/CarPark';
    private ?string $apiKey;
    
    public function __construct(?string $apiKey = null) {
        $this->apiKey = $apiKey;
    }
    
    /**
     * Récupère les données depuis l'API TfL
     * 
     * @return array|null Données JSON décodées ou null en cas d'erreur
     */
    private function fetchData(): ?array {
        $url = self::API_BASE_URL;
        
        // Ajouter la clé API si disponible
        if ($this->apiKey) {
            $url .= '?app_key=' . urlencode($this->apiKey);
        }
        
        $context = stream_context_create([
            'http' => [
                'timeout' => 10,
                'method' => 'GET',
                'header' => 'User-Agent: SAE301-ParkingApp/1.0'
            ]
        ]);
        
        $json = @file_get_contents($url, false, $context);
        
        if ($json === false) {
            error_log("Erreur lors de la récupération des données TfL depuis : " . $url);
            return null;
        }
        
        $data = json_decode($json, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            error_log("Erreur de décodage JSON TfL : " . json_last_error_msg());
            return null;
        }
        
        return $data;
    }
    
    /**
     * Convertit un parking TfL au format standardisé
     * 
     * @param array $tflParking Parking de l'API TfL
     * @return array Parking au format standardisé
     */
    private function normalizeParking(array $tflParking): array {
        // L'API TfL retourne un format différent
        $id = $tflParking['id'] ?? uniqid('london_', true);
        $name = $tflParking['commonName'] ?? $tflParking['name'] ?? 'Parking';
        
        // Coordonnées (TfL utilise lat/lon directement)
        $lat = $tflParking['lat'] ?? null;
        $lng = $tflParking['lon'] ?? null; // Note: TfL utilise 'lon' (pas 'lng')
        
        // Places disponibles (l'API TfL a des propriétés additionnelles)
        $available = null;
        $total = null;
        $status = 'UNKNOWN';
        $cost = null;
        $isPmr = false;
        $pmrPlaces = null; // Nombre de places PMR
        $hasElectric = false;
        $electricPlaces = null; // Nombre de bornes électriques
        
        // Extraire les informations depuis additionalProperties
        if (isset($tflParking['additionalProperties']) && is_array($tflParking['additionalProperties'])) {
            foreach ($tflParking['additionalProperties'] as $prop) {
                $key = $prop['key'] ?? '';
                $value = $prop['value'] ?? '';
                
                // Nombre total de places
                if ($key === 'NumberOfSpaces') {
                    $total = is_numeric($value) ? (int)$value : null;
                }
                
                // Places disponibles (pas toujours disponible dans TfL)
                if (stripos($key, 'available') !== false || stripos($key, 'spaces') !== false) {
                    if (is_numeric($value)) {
                        $available = (int)$value;
                    }
                }
                
                // Statut (Open = "True" ou "False")
                if ($key === 'Open') {
                    $status = (strtolower($value) === 'true') ? 'OPEN' : 'CLOSED';
                }
                
                // PMR - Nombre de places handicapées
                if ($key === 'NumberOfDisabledBays') {
                    $disabledBays = is_numeric($value) ? (int)$value : 0;
                    $isPmr = ($disabledBays > 0);
                    $pmrPlaces = $disabledBays; // Stocker le nombre de places PMR
                }
                
                // Bornes électriques
                if ($key === 'CarElectricalChargingPoints') {
                    // Peut être un booléen ou un nombre
                    if (is_numeric($value)) {
                        $electricPlaces = (int)$value;
                        $hasElectric = ($electricPlaces > 0);
                    } else {
                        $hasElectric = (strtolower($value) === 'true' || $value === '1');
                        $electricPlaces = $hasElectric ? 1 : null; // Si c'est juste un booléen, on met 1
                    }
                }
                
                // Coût - Tarifs journaliers
                if ($key === 'StandardTariffsCashDaily' || $key === 'StandardTariffsCashlessDaily') {
                    if (is_numeric($value)) {
                        $cost = '£' . number_format((float)$value, 2) . ' par jour';
                    }
                }
            }
        }
        
        // Déterminer le statut si non trouvé
        if ($status === 'UNKNOWN') {
            if ($total !== null) {
                $status = 'OPEN'; // Si on a le total, on assume ouvert
            }
        }
        
        return [
            'id' => $id,
            'name' => $name,
            'lat' => $lat,
            'lng' => $lng,
            'total_places' => $total,
            'available_places' => $available,
            'status' => $status,
            'cost' => $cost ?? 'Non spécifié',
            'is_pmr' => $isPmr,
            'pmr_places' => $pmrPlaces, // Nombre de places PMR
            'has_electric_charging' => $hasElectric,
            'electric_charging_points' => $electricPlaces, // Nombre de bornes électriques
            'additional_info' => [
                'place_type' => $tflParking['placeType'] ?? null,
                'url' => $tflParking['url'] ?? null
            ]
        ];
    }
    
    /**
     * Récupère tous les parkings
     * 
     * @return array Liste de parkings au format standardisé
     */
    public function getAllParkings(): array {
        $data = $this->fetchData();
        
        if (!$data || !is_array($data)) {
            // Mode dégradé : retourner des données mockées si l'API échoue
            error_log("API TfL non disponible, mode dégradé activé");
            return $this->getMockedParkings();
        }
        
        $parkings = [];
        
        foreach ($data as $tflParking) {
            $normalized = $this->normalizeParking($tflParking);
            if ($normalized['lat'] !== null && $normalized['lng'] !== null) {
                $parkings[] = $normalized;
            }
        }
        
        return $parkings;
    }
    
    /**
     * Retourne des parkings mockés en cas d'échec de l'API
     * 
     * @return array Liste de parkings mockés
     */
    private function getMockedParkings(): array {
        // Quelques parkings connus de Londres pour le mode dégradé
        return [
            [
                'id' => 'london_mock_1',
                'name' => 'Parking Covent Garden',
                'lat' => 51.512,
                'lng' => -0.123,
                'total_places' => 200,
                'available_places' => null,
                'status' => 'OPEN',
                'cost' => null,
                'is_pmr' => false,
                'has_electric_charging' => false,
                'additional_info' => ['note' => 'Données mockées - API TfL non disponible']
            ],
            [
                'id' => 'london_mock_2',
                'name' => 'Parking Westminster',
                'lat' => 51.499,
                'lng' => -0.127,
                'total_places' => 150,
                'available_places' => null,
                'status' => 'OPEN',
                'cost' => null,
                'is_pmr' => true,
                'has_electric_charging' => true,
                'additional_info' => ['note' => 'Données mockées - API TfL non disponible']
            ]
        ];
    }
    
    /**
     * Recherche des parkings par terme
     * 
     * @param string $query Terme de recherche
     * @return array Liste de parkings filtrés
     */
    public function searchParkings(string $query): array {
        $allParkings = $this->getAllParkings();
        $queryLower = mb_strtolower(trim($query));
        
        if (empty($queryLower)) {
            return [];
        }
        
        return array_filter($allParkings, function($parking) use ($queryLower) {
            $name = mb_strtolower($parking['name'] ?? '');
            return mb_strpos($name, $queryLower) !== false;
        });
    }
    
    /**
     * Retourne le code de la ville
     * 
     * @return string Code de la ville
     */
    public function getCityCode(): string {
        return 'london';
    }
}
