<?php
/**
 * Classe Auth - Gestion de l'authentification et des sessions
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Cette classe a une seule responsabilité : gérer l'authentification et les sessions
 * 
 * Principe : Separation of Concerns - Toute la logique d'authentification est isolée ici
 */

require_once __DIR__ . '/../modele/User.php';

class Auth {
    /**
     * Démarre une session si elle n'est pas déjà démarrée
     */
    public static function startSession(): void {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
    }
    
    /**
     * Vérifie si un utilisateur est connecté
     * 
     * @return bool True si connecté
     */
    public static function isLoggedIn(): bool {
        self::startSession();
        return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
    }
    
    /**
     * Récupère l'ID de l'utilisateur connecté
     * 
     * @return int|null ID de l'utilisateur ou null si non connecté
     */
    public static function getUserId(): ?int {
        self::startSession();
        return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    }
    
    /**
     * Récupère les données de l'utilisateur connecté
     * 
     * @return array|null Données de l'utilisateur ou null
     */
    public static function getUser(): ?array {
        self::startSession();
        return $_SESSION['user'] ?? null;
    }
    
    /**
     * Connecte un utilisateur
     * 
     * @param array $userData Données de l'utilisateur (sans mot de passe)
     * @return void
     */
    public static function login(array $userData): void {
        self::startSession();
        $_SESSION['user_id'] = $userData['id_utilisateur'];
        $_SESSION['user'] = $userData;
    }
    
    /**
     * Déconnecte l'utilisateur
     * 
     * @return void
     */
    public static function logout(): void {
        self::startSession();
        $_SESSION = [];
        
        if (isset($_COOKIE[session_name()])) {
            setcookie(session_name(), '', time() - 3600, '/');
        }
        
        session_destroy();
    }
    
    /**
     * Vérifie les identifiants et connecte l'utilisateur
     * 
     * @param string $email Email
     * @param string $password Mot de passe
     * @return array|false Données de l'utilisateur ou false si échec
     */
    public static function attemptLogin(string $email, string $password): array|false {
        $userModel = new User();
        $user = $userModel->authenticate($email, $password);
        
        if ($user) {
            self::login($user);
            return $user;
        }
        
        return false;
    }
    
    /**
     * Requiert que l'utilisateur soit connecté
     * Redirige vers login.php si non connecté
     * 
     * @return void
     */
    public static function requireLogin(): void {
        if (!self::isLoggedIn()) {
            header('Location: login.php?redirect=' . urlencode($_SERVER['REQUEST_URI']));
            exit;
        }
    }
}
