<?php
/**
 * Factory pour créer les providers de parkings
 * 
 * Principe SOLID appliqué : 
 * - Single Responsibility Principle (SRP) : Une seule responsabilité : créer les providers
 * - Open/Closed Principle (OCP) : Ouvert à l'extension (nouveaux providers)
 * 
 * Pattern Design : Factory
 * Centralise la création des providers selon la ville
 */

require_once __DIR__ . '/ParkingProviderInterface.php';
require_once __DIR__ . '/MetzParkingProvider.php';
require_once __DIR__ . '/LondonParkingProvider.php';

class ParkingProviderFactory {
    /**
     * Crée un provider pour une ville donnée
     * 
     * @param string $cityCode Code de la ville (ex: 'metz', 'london')
     * @return ParkingProviderInterface Provider pour la ville
     * @throws Exception Si la ville n'est pas supportée
     */
    public static function create(string $cityCode): ParkingProviderInterface {
        $cityCode = strtolower(trim($cityCode));
        
        switch ($cityCode) {
            case 'metz':
                return new MetzParkingProvider();
                
            case 'london':
            case 'londres':
                // Charger la clé API TfL si disponible
                $apiKeys = self::loadApiKeys();
                $tflKey = $apiKeys['tfl'] ?? null;
                return new LondonParkingProvider($tflKey);
                
            default:
                throw new Exception("Ville non supportée : {$cityCode}");
        }
    }
    
    /**
     * Charge les clés API depuis le fichier de configuration
     * 
     * @return array Tableau des clés API
     */
    private static function loadApiKeys(): array {
        $apiKeysFile = __DIR__ . '/../config/api_keys.php';
        
        if (file_exists($apiKeysFile)) {
            return require $apiKeysFile;
        }
        
        // Retourner un tableau vide si le fichier n'existe pas
        return [];
    }
    
    /**
     * Vérifie si une ville est supportée
     * 
     * @param string $cityCode Code de la ville
     * @return bool True si la ville est supportée
     */
    public static function isCitySupported(string $cityCode): bool {
        $cityCode = strtolower(trim($cityCode));
        return in_array($cityCode, ['metz', 'london', 'londres']);
    }
}
