<?php
/**
 * Barre de navigation
 * 
 * Principe : Separation of Concerns
 * Ce fichier contient uniquement le HTML de la navigation
 */

require_once __DIR__ . '/../config/Auth.php';
Auth::startSession();
$isLoggedIn = Auth::isLoggedIn();
$user = Auth::getUser();
?>
<nav id="main-navbar" class="navbar">
    <div class="navbar-brand">
        <a href="index.php" class="navbar-brand-link">
            <h1>MET'PARK</h1>
        </a>
    </div>
    <div class="navbar-menu">
        <!-- Indicateur de connexion intégré -->
        <div id="connection-status" class="connection-status connection-status-online">
            <span id="connection-status-icon" class="connection-status-icon">●</span>
            <span id="connection-status-text" class="connection-status-text">En ligne</span>
        </div>
        
        <select id="city-selector" class="city-selector">
            <option value="metz">Metz</option>
            <option value="london">Londres</option>
        </select>
        
        <?php if ($isLoggedIn): ?>
            <a href="profile.php" class="navbar-link">
                <span class="navbar-icon">👤</span>
                <span class="navbar-link-text"><?php echo htmlspecialchars($user['pseudo'] ?? 'Mon Profil'); ?></span>
            </a>
            <a href="logout.php" class="navbar-link navbar-link-logout">
                <span class="navbar-link-text">Déconnexion</span>
            </a>
        <?php else: ?>
            <a href="login.php" class="navbar-link">
                <span class="navbar-link-text">Connexion</span>
            </a>
            <a href="register.php" class="navbar-link navbar-link-register">
                <span class="navbar-link-text">Inscription</span>
            </a>
        <?php endif; ?>
    </div>
</nav>
