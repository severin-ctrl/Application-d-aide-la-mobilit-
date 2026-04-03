<?php
/**
 * Page de déconnexion
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Cette page a une seule responsabilité : déconnecter l'utilisateur
 */

require_once __DIR__ . '/config/Auth.php';

Auth::startSession();
Auth::logout();

header('Location: index.php');
exit;
