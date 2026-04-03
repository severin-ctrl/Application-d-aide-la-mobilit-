<?php
/**
 * API Endpoint : Récupération des préférences utilisateur
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce fichier gère uniquement la récupération des préférences utilisateur depuis la BDD
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config/db.php';

// Gestion des erreurs
error_reporting(E_ALL);
ini_set('display_errors', 0);

/**
 * Service de gestion des préférences utilisateur
 */
class UserPreferencesService {
    private PDO $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Récupère les préférences d'un utilisateur
     * 
     * @param int $userId ID de l'utilisateur
     * @return array|null Préférences utilisateur ou null si non trouvé
     */
    public function getUserPreferences(int $userId): ?array {
        $stmt = $this->db->prepare("
            SELECT 
                u.id_utilisateur,
                u.est_pmr,
                u.preference_cout,
                v.id_type_veh,
                v.id_motorisation,
                tv.libelle_type,
                m.libelle_moto
            FROM Utilisateur u
            LEFT JOIN Vehicule v ON v.id_utilisateur = u.id_utilisateur
            LEFT JOIN Ref_Type_Vehicule tv ON tv.id_type_veh = v.id_type_veh
            LEFT JOIN Ref_Motorisation m ON m.id_motorisation = v.id_motorisation
            WHERE u.id_utilisateur = :userId
            LIMIT 1
        ");
        
        $stmt->execute(['userId' => $userId]);
        $result = $stmt->fetch();
        
        if (!$result) {
            return null;
        }
        
        // Récupérer tous les véhicules de l'utilisateur
        $stmtVehicles = $this->db->prepare("
            SELECT 
                v.id_vehicule,
                v.nom_vehicule,
                v.id_type_veh,
                v.id_motorisation,
                tv.libelle_type,
                m.libelle_moto
            FROM Vehicule v
            LEFT JOIN Ref_Type_Vehicule tv ON tv.id_type_veh = v.id_type_veh
            LEFT JOIN Ref_Motorisation m ON m.id_motorisation = v.id_motorisation
            WHERE v.id_utilisateur = :userId
        ");
        
        $stmtVehicles->execute(['userId' => $userId]);
        $vehicles = $stmtVehicles->fetchAll();
        
        return [
            'id_utilisateur' => $result['id_utilisateur'],
            'est_pmr' => (bool)$result['est_pmr'],
            'preference_cout' => $result['preference_cout'],
            'vehicules' => $vehicles
        ];
    }
}

// Point d'entrée de l'API
try {
    // Cette API est maintenant dépréciée, utiliser getUserProfile.php à la place
    // On garde cette API pour compatibilité avec l'ancien code
    
    require_once __DIR__ . '/../config/Auth.php';
    Auth::startSession();
    
    // Si l'utilisateur est connecté, utiliser la session
    if (Auth::isLoggedIn()) {
        $userId = Auth::getUserId();
    } else {
        // Sinon, utiliser l'ID passé en paramètre (pour tests)
        $userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;
    }
    
    if ($userId === null || $userId <= 0) {
        http_response_code(401);
        echo json_encode([
            'error' => 'Non authentifié',
            'message' => 'Utilisez getUserProfile.php pour les utilisateurs connectés'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    $service = new UserPreferencesService();
    $preferences = $service->getUserPreferences($userId);
    
    if ($preferences === null) {
        http_response_code(404);
        echo json_encode([
            'error' => 'Utilisateur non trouvé'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    echo json_encode($preferences, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur serveur',
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
