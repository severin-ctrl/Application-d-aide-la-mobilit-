<?php
/**
 * Configuration de la base de données
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Cette classe a une seule responsabilité : gérer la connexion à la base de données
 * 
 * Pattern utilisé : Singleton pour garantir une seule instance de connexion
 */

class Database {
    /**
     * Instance unique de la classe (Singleton)
     */
    private static $instance = null;
    
    /**
     * Constructeur privé pour empêcher l'instanciation directe
     */
    private function __construct() {
        // Empêche l'instanciation directe
    }
    
    /**
     * Empêche le clonage de l'instance
     */
    private function __clone() {
        // Empêche le clonage
    }
    
    /**
     * Empêche la désérialisation
     */
    public function __wakeup() {
        throw new Exception("Cannot unserialize singleton");
    }
    
    /**
     * Récupère l'instance unique de la connexion PDO
     * 
     * @return PDO Instance de la connexion à la base de données
     * @throws Exception Si la connexion échoue
     */
    /**
     * @return array{host: string, dbname: string, username: string, password: string}
     */
    private static function getDbConfig(): array {
        $local = __DIR__ . '/db.local.php';
        if (is_file($local)) {
            $cfg = require $local;
            if (
                is_array($cfg)
                && !empty($cfg['host'])
                && !empty($cfg['dbname'])
                && !empty($cfg['username'])
                && array_key_exists('password', $cfg)
            ) {
                return $cfg;
            }
        }
        $host = getenv('DB_HOST') ?: '';
        $dbname = getenv('DB_NAME') ?: '';
        $username = getenv('DB_USER') ?: '';
        $password = getenv('DB_PASS');
        if ($password === false) {
            $password = '';
        }
        if ($host !== '' && $dbname !== '' && $username !== '') {
            return compact('host', 'dbname', 'username', 'password');
        }
        throw new Exception(
            'Configuration BDD manquante : copiez config/db.local.php.example vers db.local.php, '
            . 'ou définissez les variables d’environnement DB_HOST, DB_NAME, DB_USER, DB_PASS.'
        );
    }

    public static function getInstance(): PDO {
        if (self::$instance === null) {
            try {
                $cfg = self::getDbConfig();
                $host = $cfg['host'];
                $dbname = $cfg['dbname'];
                $username = $cfg['username'];
                $password = $cfg['password'];

                $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";
                
                $options = [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ];
                
                self::$instance = new PDO($dsn, $username, $password, $options);
                
            } catch (PDOException $e) {
                error_log("Erreur de connexion à la base de données : " . $e->getMessage());
                throw new Exception("Impossible de se connecter à la base de données");
            }
        }
        
        return self::$instance;
    }
}