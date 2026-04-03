<?php
/**
 * Modèle User - Gestion des utilisateurs
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Cette classe a une seule responsabilité : gérer toutes les interactions BDD liées aux utilisateurs
 * 
 * Principe : Separation of Concerns - Toute la logique d'accès aux données utilisateur est isolée ici
 */

require_once __DIR__ . '/../config/db.php';

class User {
    private PDO $db;
    
    public function __construct() {
        $this->db = Database::getInstance();
    }
    
    /**
     * Crée un nouvel utilisateur
     * 
     * @param string $email Email de l'utilisateur
     * @param string $password Mot de passe en clair (sera haché)
     * @param string $pseudo Pseudo de l'utilisateur
     * @param bool $estPmr Statut PMR
     * @param string $preferenceCout Préférence de coût
     * @return int|false ID de l'utilisateur créé ou false en cas d'erreur
     */
    public function create(string $email, string $password, string $pseudo, bool $estPmr = false, string $preferenceCout = 'INDIFFERENT'): int|false {
        // Vérifier que l'email n'existe pas déjà
        if ($this->emailExists($email)) {
            return false;
        }
        
        // Hacher le mot de passe
        $passwordHash = password_hash($password, PASSWORD_BCRYPT);
        
        try {
            $stmt = $this->db->prepare("
                INSERT INTO Utilisateur (email, mot_de_passe, pseudo, est_pmr, preference_cout)
                VALUES (:email, :password, :pseudo, :est_pmr, :preference_cout)
            ");
            
            $stmt->execute([
                'email' => $email,
                'password' => $passwordHash,
                'pseudo' => $pseudo,
                'est_pmr' => $estPmr ? 1 : 0,
                'preference_cout' => $preferenceCout
            ]);
            
            return (int)$this->db->lastInsertId();
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la création de l'utilisateur : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Vérifie si un email existe déjà
     * 
     * @param string $email Email à vérifier
     * @return bool True si l'email existe
     */
    public function emailExists(string $email): bool {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM Utilisateur WHERE email = :email");
        $stmt->execute(['email' => $email]);
        return $stmt->fetchColumn() > 0;
    }
    
    /**
     * Vérifie les identifiants de connexion
     * 
     * @param string $email Email de l'utilisateur
     * @param string $password Mot de passe en clair
     * @return array|false Données de l'utilisateur ou false si échec
     */
    public function authenticate(string $email, string $password): array|false {
        try {
            $stmt = $this->db->prepare("
                SELECT id_utilisateur, email, mot_de_passe, pseudo, est_pmr, preference_cout
                FROM Utilisateur
                WHERE email = :email
            ");
            
            $stmt->execute(['email' => $email]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return false;
            }
            
            // Vérifier le mot de passe
            if (!password_verify($password, $user['mot_de_passe'])) {
                return false;
            }
            
            // Mettre à jour la date de dernière connexion si la colonne existe
            try {
                $updateStmt = $this->db->prepare("
                    UPDATE Utilisateur 
                    SET derniere_connexion = CURRENT_TIMESTAMP 
                    WHERE id_utilisateur = :id
                ");
                $updateStmt->execute(['id' => $user['id_utilisateur']]);
            } catch (PDOException $e) {
                // La colonne n'existe peut-être pas encore, on ignore l'erreur
            }
            
            // Retourner les données sans le mot de passe
            unset($user['mot_de_passe']);
            return $user;
            
        } catch (PDOException $e) {
            error_log("Erreur lors de l'authentification : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Récupère un utilisateur par son ID
     * 
     * @param int $userId ID de l'utilisateur
     * @return array|false Données de l'utilisateur ou false si non trouvé
     */
    public function getById(int $userId): array|false {
        try {
            // Ne sélectionner que les colonnes qui existent vraiment
            $stmt = $this->db->prepare("
                SELECT id_utilisateur, email, pseudo, est_pmr, preference_cout
                FROM Utilisateur
                WHERE id_utilisateur = :id
            ");
            
            $stmt->execute(['id' => $userId]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$result || !is_array($result)) {
                error_log("getById: Utilisateur $userId non trouvé ou résultat invalide");
                return false;
            }
            
            error_log("getById: Utilisateur $userId trouvé - " . print_r(array_keys($result), true));
            
            return $result;
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la récupération de l'utilisateur : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Met à jour le profil d'un utilisateur
     * 
     * @param int $userId ID de l'utilisateur
     * @param array $data Données à mettre à jour
     * @return bool True si succès
     */
    public function updateProfile(int $userId, array $data): bool {
        $allowedFields = ['pseudo', 'est_pmr', 'preference_cout'];
        $updates = [];
        $params = ['id' => $userId];
        
        foreach ($data as $field => $value) {
            if (in_array($field, $allowedFields)) {
                $updates[] = "{$field} = :{$field}";
                $params[$field] = $field === 'est_pmr' ? ($value ? 1 : 0) : $value;
            }
        }
        
        if (empty($updates)) {
            return false;
        }
        
        try {
            $sql = "UPDATE Utilisateur SET " . implode(', ', $updates) . " WHERE id_utilisateur = :id";
            $stmt = $this->db->prepare($sql);
            return $stmt->execute($params);
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la mise à jour du profil : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Récupère les véhicules d'un utilisateur
     * 
     * @param int $userId ID de l'utilisateur
     * @return array Liste des véhicules
     */
    public function getVehicles(int $userId): array {
        try {
            $stmt = $this->db->prepare("
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
                WHERE v.id_utilisateur = :id
                ORDER BY v.id_vehicule ASC
            ");
            
            $stmt->execute(['id' => $userId]);
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Debug : logger pour vérifier
            error_log("getVehicles pour userId=$userId : " . count($result) . " véhicules trouvés");
            
            return $result ?: [];
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la récupération des véhicules : " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Ajoute un véhicule à un utilisateur
     * 
     * @param int $userId ID de l'utilisateur
     * @param string $nomVehicule Nom du véhicule
     * @param int $idTypeVeh ID du type de véhicule
     * @param int $idMotorisation ID de la motorisation
     * @return int|false ID du véhicule créé ou false
     */
    public function addVehicle(int $userId, string $nomVehicule, int $idTypeVeh, int $idMotorisation): int|false {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO Vehicule (nom_vehicule, id_utilisateur, id_type_veh, id_motorisation)
                VALUES (:nom, :user_id, :type_veh, :motorisation)
            ");
            
            $stmt->execute([
                'nom' => $nomVehicule,
                'user_id' => $userId,
                'type_veh' => $idTypeVeh,
                'motorisation' => $idMotorisation
            ]);
            
            return (int)$this->db->lastInsertId();
            
        } catch (PDOException $e) {
            error_log("Erreur lors de l'ajout du véhicule : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Récupère le profil complet d'un utilisateur (avec véhicules)
     * 
     * @param int $userId ID de l'utilisateur
     * @return array|false Profil complet ou false
     */
    public function getFullProfile(int $userId): array|false {
        $user = $this->getById($userId);
        
        if (!$user) {
            error_log("getFullProfile: Utilisateur $userId non trouvé");
            return false;
        }
        
        // Récupérer les véhicules
        $vehicles = $this->getVehicles($userId);
        
        // S'assurer que $user est un tableau avant d'ajouter les véhicules
        if (!is_array($user)) {
            error_log("getFullProfile: getById n'a pas retourné un tableau pour userId=$userId");
            return false;
        }
        
        // Ajouter les véhicules au profil
        $user['vehicules'] = $vehicles;
        
        error_log("getFullProfile pour userId=$userId : " . count($vehicles) . " véhicules ajoutés au profil");
        error_log("getFullProfile: Structure du profil retourné - " . print_r(array_keys($user), true));
        
        return $user;
    }
    
    /**
     * Met à jour un véhicule
     * 
     * @param int $vehicleId ID du véhicule
     * @param int $userId ID de l'utilisateur (vérification de sécurité)
     * @param string $nomVehicule Nouveau nom du véhicule
     * @param int $idTypeVeh Nouveau type de véhicule
     * @param int $idMotorisation Nouvelle motorisation
     * @return bool True si succès, false sinon
     */
    public function updateVehicle(int $vehicleId, int $userId, string $nomVehicule, int $idTypeVeh, int $idMotorisation): bool {
        try {
            // Vérifier que le véhicule appartient à l'utilisateur
            $stmt = $this->db->prepare("
                SELECT id_vehicule FROM Vehicule 
                WHERE id_vehicule = :vehicle_id AND id_utilisateur = :user_id
            ");
            $stmt->execute([
                'vehicle_id' => $vehicleId,
                'user_id' => $userId
            ]);
            
            if (!$stmt->fetch()) {
                return false; // Le véhicule n'appartient pas à l'utilisateur
            }
            
            // Mettre à jour le véhicule
            $stmt = $this->db->prepare("
                UPDATE Vehicule 
                SET nom_vehicule = :nom, id_type_veh = :type, id_motorisation = :moto
                WHERE id_vehicule = :vehicle_id AND id_utilisateur = :user_id
            ");
            
            return $stmt->execute([
                'nom' => $nomVehicule,
                'type' => $idTypeVeh,
                'moto' => $idMotorisation,
                'vehicle_id' => $vehicleId,
                'user_id' => $userId
            ]);
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la mise à jour du véhicule : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Supprime un véhicule
     * 
     * @param int $vehicleId ID du véhicule
     * @param int $userId ID de l'utilisateur (vérification de sécurité)
     * @return bool True si succès, false sinon
     */
    public function deleteVehicle(int $vehicleId, int $userId): bool {
        try {
            // Vérifier que le véhicule appartient à l'utilisateur et le supprimer
            $stmt = $this->db->prepare("
                DELETE FROM Vehicule 
                WHERE id_vehicule = :vehicle_id AND id_utilisateur = :user_id
            ");
            
            return $stmt->execute([
                'vehicle_id' => $vehicleId,
                'user_id' => $userId
            ]);
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la suppression du véhicule : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Récupère un véhicule par son ID
     * 
     * @param int $vehicleId ID du véhicule
     * @param int $userId ID de l'utilisateur (vérification de sécurité)
     * @return array|false Véhicule ou false
     */
    public function getVehicle(int $vehicleId, int $userId): array|false {
        try {
            $stmt = $this->db->prepare("
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
                WHERE v.id_vehicule = :vehicle_id AND v.id_utilisateur = :user_id
            ");
            
            $stmt->execute([
                'vehicle_id' => $vehicleId,
                'user_id' => $userId
            ]);
            
            $vehicle = $stmt->fetch();
            return $vehicle ?: false;
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la récupération du véhicule : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Récupère les favoris d'un utilisateur
     * 
     * @param int $userId ID de l'utilisateur
     * @return array Liste des favoris
     */
    public function getFavorites(int $userId): array {
        try {
            $stmt = $this->db->prepare("
                SELECT id_favori, ref_parking_api, nom_custom
                FROM Favori
                WHERE id_utilisateur = :id
                ORDER BY id_favori DESC
                LIMIT 5
            ");
            
            $stmt->execute(['id' => $userId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la récupération des favoris : " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Ajoute un parking aux favoris
     * 
     * @param int $userId ID de l'utilisateur
     * @param string $parkingId ID du parking (ref_parking_api)
     * @param string|null $customName Nom personnalisé (optionnel)
     * @return bool|int ID du favori créé ou false en cas d'erreur
     */
    public function addFavorite(int $userId, string $parkingId, ?string $customName = null): bool|int {
        try {
            // Vérifier si l'utilisateur a déjà 5 favoris
            $existingFavorites = $this->getFavorites($userId);
            if (count($existingFavorites) >= 5) {
                error_log("L'utilisateur $userId a déjà 5 favoris (limite atteinte)");
                return false;
            }
            
            // Vérifier si le parking n'est pas déjà en favori
            $stmt = $this->db->prepare("
                SELECT id_favori FROM Favori 
                WHERE id_utilisateur = :user_id AND ref_parking_api = :parking_id
            ");
            $stmt->execute([
                'user_id' => $userId,
                'parking_id' => $parkingId
            ]);
            
            if ($stmt->fetch()) {
                error_log("Le parking $parkingId est déjà en favori pour l'utilisateur $userId");
                return false; // Déjà en favori
            }
            
            // Ajouter le favori
            $stmt = $this->db->prepare("
                INSERT INTO Favori (id_utilisateur, ref_parking_api, nom_custom)
                VALUES (:user_id, :parking_id, :custom_name)
            ");
            
            $stmt->execute([
                'user_id' => $userId,
                'parking_id' => $parkingId,
                'custom_name' => $customName
            ]);
            
            return (int)$this->db->lastInsertId();
            
        } catch (PDOException $e) {
            error_log("Erreur lors de l'ajout du favori : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Supprime un favori
     * 
     * @param int $favoriteId ID du favori
     * @param int $userId ID de l'utilisateur (vérification de sécurité)
     * @return bool True si succès
     */
    public function removeFavorite(int $favoriteId, int $userId): bool {
        try {
            $stmt = $this->db->prepare("
                DELETE FROM Favori 
                WHERE id_favori = :favorite_id AND id_utilisateur = :user_id
            ");
            
            return $stmt->execute([
                'favorite_id' => $favoriteId,
                'user_id' => $userId
            ]);
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la suppression du favori : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Vérifie si un parking est en favori
     * 
     * @param int $userId ID de l'utilisateur
     * @param string $parkingId ID du parking
     * @return int|false ID du favori ou false
     */
    public function isFavorite(int $userId, string $parkingId): int|false {
        try {
            $stmt = $this->db->prepare("
                SELECT id_favori FROM Favori 
                WHERE id_utilisateur = :user_id AND ref_parking_api = :parking_id
            ");
            
            $stmt->execute([
                'user_id' => $userId,
                'parking_id' => $parkingId
            ]);
            
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            return $result ? (int)$result['id_favori'] : false;
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la vérification du favori : " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Récupère l'historique de recherche d'un utilisateur
     * 
     * @param int $userId ID de l'utilisateur
     * @return array Liste des recherches récentes
     */
    public function getSearchHistory(int $userId): array {
        try {
            $stmt = $this->db->prepare("
                SELECT DISTINCT ref_parking_api, MAX(date_recherche) as date_recherche
                FROM Historique
                WHERE id_utilisateur = :id
                GROUP BY ref_parking_api
                ORDER BY date_recherche DESC
                LIMIT 3
            ");
            
            $stmt->execute(['id' => $userId]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
            
        } catch (PDOException $e) {
            error_log("Erreur lors de la récupération de l'historique : " . $e->getMessage());
            return [];
        }
    }
    
    /**
     * Ajoute une entrée à l'historique de recherche
     * 
     * @param int $userId ID de l'utilisateur
     * @param string $parkingId ID du parking
     * @return bool True si succès
     */
    public function addToHistory(int $userId, string $parkingId): bool {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO Historique (id_utilisateur, ref_parking_api, date_recherche)
                VALUES (:user_id, :parking_id, NOW())
            ");
            
            return $stmt->execute([
                'user_id' => $userId,
                'parking_id' => $parkingId
            ]);
            
        } catch (PDOException $e) {
            error_log("Erreur lors de l'ajout à l'historique : " . $e->getMessage());
            return false;
        }
    }
}
