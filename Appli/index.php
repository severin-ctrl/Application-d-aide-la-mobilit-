<?php
/**
 * Point d'entrée principal de l'application
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce fichier a une seule responsabilité : servir la page HTML principale
 * 
 * Principe : Separation of Concerns
 * - Pas de logique métier ici
 * - Pas de requêtes SQL ici
 * - Uniquement la structure HTML de base
 */

// Configuration de la page
$pageTitle = 'Parking Metz - Mobilité';

// Inclure le header
require_once __DIR__ . '/includes/header.php';
?>

<!-- Barre de recherche -->
<div id="search-bar">
    <input 
        type="search" 
        id="search-input" 
        name="q" 
        placeholder="Rechercher un parking..." 
        autocomplete="off"
        aria-label="Rechercher un parking"
    />
    <div id="suggestions" class="suggestions hidden"></div>
    <button id="search-button" type="button">Rechercher</button>
    <button id="toggle-filter-btn" type="button">Masquer les parkings de rue</button>
</div>

<!-- Conteneur de la carte -->
<div id="map"></div>

<!-- Panneau de guidage (remplace la barre de recherche en mode guidage) -->
<div id="guidance-panel" class="hidden">
    <div class="guidance-header">
        <div class="guidance-destination">
            <h3 id="guidance-destination-name">Destination</h3>
            <p id="guidance-summary">Calcul en cours...</p>
        </div>
        <button id="stop-guidance-btn" type="button" class="btn-stop" aria-label="Arrêter la navigation">
            ANNULER
        </button>
    </div>
    <div id="guidance-instructions" class="guidance-instructions">
        <!-- Les instructions seront injectées ici par JavaScript -->
    </div>
    <!-- Bouton de simulation pour la réactivité dynamique (visible seulement pour Parking de la République à Metz) -->
    <div id="simulate-unavailability-container" class="hidden" style="padding: 10px; text-align: center; border-top: 1px solid #ddd; margin-top: 10px;">
        <button id="simulate-unavailability-btn" type="button" class="btn-simulate" style="padding: 8px 16px; background: #ff9800; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: 600;">
            🧪 Simuler l'indisponibilité du parking
        </button>
        <p style="font-size: 11px; color: #666; margin-top: 5px;">Démo : Simule l'indisponibilité et la redirection automatique</p>
    </div>
</div>

<!-- Panneau guidage (boutons en bas) -->
<div id="guidance-controls">
    <button id="nearest-parking-btn" type="button" aria-label="Aller au parking le plus proche">
        Parking le plus proche
    </button>
</div>

<!-- Switch suivi utilisateur -->
<div id="follow-user-container" class="hidden">
    <label class="switch-label">
        <input type="checkbox" id="follow-user-checkbox" checked>
        <span class="switch-slider"></span>
        <span class="switch-text">Suivre ma position</span>
    </label>
</div>

<?php
// Inclure le footer
require_once __DIR__ . '/includes/footer.php';
?>
