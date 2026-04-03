/**
 * Module principal de l'application
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce module orchestre les interactions entre les différents composants
 * 
 * Principe : Separation of Concerns - La logique métier de l'application est ici
 */

import ApiClient from './api_client.js';
import MapManager from './map.js';

/**
 * Classe principale de l'application
 * Principe : Orchestration des différents modules
 */
class ParkingApp {
    constructor() {
        console.log('=== ParkingApp.constructor() appelé ===');
        this.apiClient = new ApiClient();
        this.mapManager = new MapManager('map');
        this.parkingsData = null;
        this.userPreferences = null;
        this.isUserLoggedIn = false;
        this.currentCity = 'metz'; // Ville par défaut
        this.citiesConfig = null; // Sera chargé depuis l'API
        this.favorites = []; // Liste des favoris
        this.searchHistory = []; // Historique de recherche
        this.favoritesMap = new Map(); // Map parking_id -> favorite_id pour vérification rapide
        this.currentGuidanceParking = null; // Parking actuellement sélectionné pour le guidage
        this.availabilityCheckInterval = null; // Intervalle de vérification de disponibilité
        
        // Éléments DOM
        this.searchInput = null;
        this.suggestionsList = null;
        this.searchButton = null;
        this.nearestParkingBtn = null;
        this.stopGuidanceBtn = null;
        this.followUserCheckbox = null;
        this.citySelector = null;
        this.simulateUnavailabilityBtn = null;
        this.simulateUnavailabilityContainer = null;
        
        console.log('ParkingApp initialisé, appel de init()...');
        
        // Écouter les changements de connexion
        window.addEventListener('connectionChange', (event) => {
            this.updateConnectionStatus(event.detail.isOnline, false);
        });
        
        this.init();
    }
    
    /**
     * Initialise l'application
     */
    async init() {
        console.log('=== ParkingApp.init() appelé ===');
        
        // Initialiser l'indicateur de connexion immédiatement
        this.updateConnectionStatus(!this.apiClient.isOffline(), false);
        
        // Initialiser la carte
        this.mapManager.init();
        
        // Attendre que la carte soit prête
        this.mapManager.map.whenReady(() => {
            console.log('Carte prête, initialisation de l\'application...');
            // Attendre un peu pour que le DOM soit complètement chargé
            setTimeout(() => {
                console.log('Setup DOM et event listeners...');
                this.setupDOM();
                this.setupEventListeners();
                console.log('Chargement des parkings...');
                this.loadParkings();
                console.log('Chargement des préférences utilisateur...');
                // Charger les préférences utilisateur (et donc les favoris/historique)
                this.loadUserPreferences();
            }, 100);
        });
    }
    
    /**
     * Configure les références aux éléments DOM
     */
    setupDOM() {
        this.searchInput = document.getElementById('search-input');
        this.suggestionsList = document.getElementById('suggestions');
        this.searchButton = document.getElementById('search-button');
        this.nearestParkingBtn = document.getElementById('nearest-parking-btn');
        this.stopGuidanceBtn = document.getElementById('stop-guidance-btn');
        this.followUserCheckbox = document.getElementById('follow-user-checkbox');
        this.toggleFilterBtn = document.getElementById('toggle-filter-btn');
        this.citySelector = document.getElementById('city-selector');
        this.filterRealParkings = false;
        
        // Charger la configuration des villes
        this.loadCitiesConfig();
    }
    
    /**
     * Charge la configuration des villes
     */
    loadCitiesConfig() {
        // Configuration statique des villes
        this.citiesConfig = {
            'metz': {
                center: { lat: 49.119, lng: 6.176 },
                zoom: 13
            },
            'london': {
                center: { lat: 51.507, lng: -0.127 },
                zoom: 12
            }
        };
    }
    
    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Sélecteur de ville
        if (this.citySelector) {
            this.citySelector.addEventListener('change', (e) => {
                const cityCode = e.target.value;
                this.changeCity(cityCode);
            });
        }
        
        // Recherche de parkings
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                if (query.length === 0) {
                    // Si la barre est vide et que l'utilisateur est connecté, afficher favoris/historique
                    if (this.isUserLoggedIn) {
                        this.showFavoritesAndHistory();
                    } else {
                        this.hideSuggestions();
                    }
                } else {
                    this.handleSearchInput(query);
                }
            });
            
            this.searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
            
            // Afficher favoris et historique quand on clique sur la barre de recherche
            this.searchInput.addEventListener('focus', () => {
                if (!this.searchInput.value.trim() && this.isUserLoggedIn) {
                    this.showFavoritesAndHistory();
                }
            });
        }
        
        if (this.searchButton) {
            this.searchButton.addEventListener('click', () => {
                this.performSearch();
            });
        }
        
        // Gérer les événements de favori depuis les popups
        document.addEventListener('favoriteToggle', async (e) => {
            const { parkingId, isFavorite, favoriteId, starElement } = e.detail;
            if (isFavorite) {
                await this.removeFavorite(parseInt(favoriteId));
            } else {
                await this.addFavorite(parkingId);
            }
            // Mettre à jour l'étoile immédiatement
            if (starElement) {
                this.updateFavoriteStar(starElement, !isFavorite, favoriteId);
            }
        });
        
        // Mettre à jour l'étoile quand un popup est ouvert
        document.addEventListener('popupOpened', (e) => {
            const { parkingId, starElement } = e.detail;
            const favoriteId = this.favoritesMap.get(parkingId);
            const isFavorite = favoriteId !== undefined;
            this.updateFavoriteStar(starElement, isFavorite, favoriteId);
        });
        
        // Mettre à jour les boutons favori quand les parkings sont affichés
        document.addEventListener('parkingsDisplayed', () => {
            if (this.isUserLoggedIn) {
                // Attendre un peu pour que les popups soient créés
                setTimeout(() => {
                    this.updateAllPopupsForFavorites();
                }, 1500);
            }
        });
        
        // Bouton parking le plus proche
        if (this.nearestParkingBtn) {
            this.nearestParkingBtn.addEventListener('click', () => {
                this.guideToNearestParking();
            });
        }
        
        // Bouton arrêter guidage
        if (this.stopGuidanceBtn) {
            this.stopGuidanceBtn.addEventListener('click', () => {
                this.stopGuidance();
            });
        }
        
        // Checkbox suivi utilisateur
        if (this.followUserCheckbox) {
            this.followUserCheckbox.addEventListener('change', (e) => {
                this.mapManager.setFollowUser(e.target.checked);
            });
        }
        
        // Bouton de simulation d'indisponibilité
        // Utiliser la délégation d'événements pour gérer les clics même si le bouton n'existe pas encore
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'simulate-unavailability-btn') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Bouton de simulation cliqué ! (via délégation)');
                this.checkParkingAvailability(true); // true = simuler l'indisponibilité
            }
        });
        
        // Aussi attacher directement si le bouton existe déjà
        if (this.simulateUnavailabilityBtn) {
            console.log('Bouton de simulation trouvé, ajout de l\'événement click direct');
            this.simulateUnavailabilityBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Bouton de simulation cliqué ! (direct)');
                this.checkParkingAvailability(true); // true = simuler l'indisponibilité
            });
        } else {
            console.log('Bouton de simulation non trouvé au démarrage (sera attaché plus tard)');
        }
        
        // Bouton filtre parkings réels
        if (this.toggleFilterBtn) {
            this.toggleFilterBtn.addEventListener('click', () => {
                this.filterRealParkings = !this.filterRealParkings;
                this.mapManager.setFilterRealParkings(this.filterRealParkings);
                this.toggleFilterBtn.textContent = this.filterRealParkings 
                    ? 'Afficher tous les parkings' 
                    : 'Masquer les parkings de rue';
                
                // Rafraîchir l'affichage courant
                if (this.mapManager.isGuidanceActive) return;
                
                // Réafficher les parkings avec le nouveau filtre
                if (this.parkingsData) {
                    // Vider les marqueurs actuels
                    this.mapManager.clearParkingMarkers();
                    
                    // Réafficher avec le filtre
                    if (this.userPreferences) {
                        this.applyFilters();
                    } else {
                        // Afficher tous les parkings (y compris les fermés)
                        this.mapManager.displayParkings(this.parkingsData, false);
                    }
                }
            });
        }
        
        // Écouter les clics sur les boutons de guidage dans les popups
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-guidance')) {
                // Vérifier si le bouton est désactivé (parking fermé)
                if (e.target.disabled || e.target.dataset.status === 'CLOSED') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showError('Impossible de démarrer le guidage vers un parking fermé.');
                    return;
                }
                
                const lat = parseFloat(e.target.dataset.lat);
                const lng = parseFloat(e.target.dataset.lng);
                const name = e.target.dataset.name || null;
                this.startGuidance(lat, lng, name);
            }
        });
        
        // Écouter les événements de la carte
        this.mapManager.map.on('guidance:started', (e) => {
            this.onGuidanceStarted(e.destinationName);
        });
        
        this.mapManager.map.on('guidance:routefound', (e) => {
            this.onRouteFound(e.distance, e.time, e.instructions);
        });
        
        this.mapManager.map.on('guidance:stopped', () => {
            this.onGuidanceStopped();
        });
        
        // Références aux éléments du panneau de guidage
        this.guidancePanel = document.getElementById('guidance-panel');
        this.guidanceDestinationName = document.getElementById('guidance-destination-name');
        this.guidanceSummary = document.getElementById('guidance-summary');
        this.guidanceInstructions = document.getElementById('guidance-instructions');
        this.searchBar = document.getElementById('search-bar');
        this.simulateUnavailabilityBtn = document.getElementById('simulate-unavailability-btn');
        this.simulateUnavailabilityContainer = document.getElementById('simulate-unavailability-container');
        
        // Cacher les suggestions au clic ailleurs
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-bar')) {
                this.hideSuggestions();
            }
        });
    }
    
    /**
     * Charge les parkings depuis l'API
     */
    async loadParkings() {
        try {
            console.log('Chargement des parkings pour:', this.currentCity);
            this.parkingsData = await this.apiClient.getParkings(this.currentCity);
            console.log('Parkings chargés:', this.parkingsData);
            
            // Vérifier si les données viennent du cache (en vérifiant si on est offline mais qu'on a des données)
            const isCached = this.apiClient.isOffline() && this.parkingsData;
            this.updateConnectionStatus(!this.apiClient.isOffline(), isCached);
            
            if (isCached) {
                this.showNotification('Données en cache (mode avion)', 'warning');
            }
            
            // Appliquer les filtres si les préférences sont déjà chargées
            if (this.userPreferences) {
                this.applyFilters();
            } else {
                // Sinon, afficher tous les parkings (y compris les fermés)
                this.mapManager.displayParkings(this.parkingsData);
            }
            
            // Recharger toutes les 30 secondes (seulement si en ligne)
            if (!this.refreshInterval && !this.apiClient.isOffline()) {
                this.refreshInterval = setInterval(() => {
                    if (!this.apiClient.isOffline()) {
                        this.refreshParkings();
                    }
                }, 30000);
            }
            
        } catch (error) {
            console.error('Erreur lors du chargement des parkings:', error);
            
            // Vérifier si c'est une erreur de connexion
            if (error.message.includes('Mode avion') || error.message.includes('connexion')) {
                this.updateConnectionStatus(false, false);
                this.showConnectionError('Mode avion détecté. Les données en cache sont affichées si disponibles.');
            } else if (error.message.includes('serveur') || error.message.includes('HTTP')) {
                this.showError('Erreur serveur. Les données en cache sont affichées si disponibles.');
            } else {
                this.showError('Impossible de charger les parkings: ' + error.message);
            }
        }
    }
    
    /**
     * Rafraîchit les données des parkings
     */
    async refreshParkings() {
        try {
            this.parkingsData = await this.apiClient.getParkings(this.currentCity);
            
            // Ne pas réafficher si le guidage est actif
            if (!this.mapManager.isGuidanceActive) {
                // Appliquer les filtres si disponibles
                if (this.userPreferences) {
                    this.applyFilters();
                } else {
                    // Afficher tous les parkings (y compris les fermés)
                    this.mapManager.displayParkings(this.parkingsData);
                }
            }
        } catch (error) {
            console.error('Erreur lors du rafraîchissement des parkings:', error);
        }
    }
    
    /**
     * Change la ville et recharge les données
     * 
     * @param {string} cityCode Code de la ville
     */
    async changeCity(cityCode) {
        if (this.currentCity === cityCode) {
            return; // Déjà sur cette ville
        }
        
        console.log('Changement de ville:', cityCode);
        this.currentCity = cityCode;
        
        // Recentrer la carte
        if (this.citiesConfig && this.citiesConfig[cityCode]) {
            this.mapManager.centerOnCity(cityCode, this.citiesConfig);
        }
        
        // Simuler la position utilisateur selon la ville sélectionnée
        if (cityCode === 'london') {
            // Coordonnées du centre de Londres (Trafalgar Square)
            const londonCenter = { lat: 51.5074, lng: -0.1278 };
            this.mapManager.simulateUserPosition(londonCenter.lat, londonCenter.lng);
            console.log('Position simulée à Londres pour démonstration');
        } else if (cityCode === 'metz') {
            // Reprendre la géolocalisation réelle pour Metz
            this.mapManager.resumeRealLocation();
            console.log('Géolocalisation réelle reprise pour Metz');
        }
        
        // Vider les marqueurs
        this.mapManager.clearParkingMarkers();
        
        // Recharger les parkings
        await this.loadParkings();
    }
    
    /**
     * Charge les préférences utilisateur
     */
    async loadUserPreferences() {
        try {
            console.log('Tentative de chargement du profil utilisateur...');
            // Utiliser le nouvel endpoint qui utilise la session
            this.userPreferences = await this.apiClient.getUserProfile();
            console.log('Profil utilisateur chargé:', this.userPreferences);
            this.isUserLoggedIn = true;
            
            // Appliquer les filtres après avoir chargé les parkings
            if (this.parkingsData) {
                this.applyFilters();
            }
            
            // Informer MapManager que l'utilisateur est connecté AVANT de charger les favoris
            this.mapManager.setUserLoggedIn(true);
            console.log('MapManager informé: utilisateur connecté');
            
            // Charger les favoris et l'historique si connecté
            await this.loadFavorites();
            await this.loadSearchHistory();
            
            // Mettre à jour tous les popups existants pour afficher le bouton favori
            console.log('Mise à jour des popups pour afficher les boutons favori...');
            this.updateAllPopupsForFavorites();
        } catch (error) {
            console.log('Utilisateur non connecté ou erreur:', error.message);
            console.error('Détails de l\'erreur:', error);
            // Utilisateur non connecté, continuer sans filtres
            this.userPreferences = null;
            this.isUserLoggedIn = false;
            this.favorites = [];
            this.searchHistory = [];
            this.favoritesMap.clear();
            
            // Informer MapManager que l'utilisateur n'est pas connecté
            this.mapManager.setUserLoggedIn(false);
        }
    }
    
    /**
     * Charge les favoris de l'utilisateur
     */
    async loadFavorites() {
        if (!this.isUserLoggedIn) {
            console.log('loadFavorites: Utilisateur non connecté (isUserLoggedIn =', this.isUserLoggedIn, ')');
            return;
        }
        
        try {
            console.log('Chargement des favoris depuis l\'API...');
            const response = await this.apiClient.getFavorites();
            console.log('Réponse API favoris:', response);
            this.favorites = response.favorites || [];
            console.log('Favoris chargés:', this.favorites.length, 'favoris');
            
            // Créer une map pour vérification rapide
            this.favoritesMap.clear();
            this.favorites.forEach(fav => {
                this.favoritesMap.set(fav.ref_parking_api, fav.id_favori);
                console.log('Favori ajouté à la map:', fav.ref_parking_api, '->', fav.id_favori);
            });
            
            // Mettre à jour les étoiles favori dans les popups existants
            this.updateAllFavoriteStars();
        } catch (error) {
            console.error('Erreur lors du chargement des favoris:', error);
            console.error('Stack trace:', error.stack);
        }
    }
    
    /**
     * Charge l'historique de recherche
     */
    async loadSearchHistory() {
        if (!this.isUserLoggedIn) {
            console.log('loadSearchHistory: Utilisateur non connecté');
            return;
        }
        
        try {
            console.log('Chargement de l\'historique depuis l\'API...');
            const response = await this.apiClient.getSearchHistory();
            console.log('Réponse API historique:', response);
            this.searchHistory = response.history || [];
            console.log('Historique chargé:', this.searchHistory.length, 'entrées');
        } catch (error) {
            console.error('Erreur lors du chargement de l\'historique:', error);
            console.error('Stack trace:', error.stack);
        }
    }
    
    /**
     * Affiche les favoris et l'historique dans la barre de recherche
     */
    showFavoritesAndHistory() {
        console.log('showFavoritesAndHistory appelé');
        console.log('- suggestionsList:', this.suggestionsList);
        console.log('- isUserLoggedIn:', this.isUserLoggedIn);
        console.log('- favorites:', this.favorites);
        console.log('- searchHistory:', this.searchHistory);
        
        if (!this.suggestionsList) {
            console.log('showFavoritesAndHistory: suggestionsList non trouvé');
            return;
        }
        
        if (!this.isUserLoggedIn) {
            console.log('showFavoritesAndHistory: Utilisateur non connecté');
            this.hideSuggestions();
            return;
        }
        
        console.log('Affichage favoris et historique. Favoris:', this.favorites.length, 'Historique:', this.searchHistory.length);
        
        this.suggestionsList.innerHTML = '';
        
        // Afficher les favoris
        if (this.favorites.length > 0) {
            console.log('Affichage de', this.favorites.length, 'favoris');
            const favoritesHeader = document.createElement('div');
            favoritesHeader.className = 'suggestions-header';
            favoritesHeader.textContent = '⭐ Favoris';
            this.suggestionsList.appendChild(favoritesHeader);
            
            this.favorites.forEach(favorite => {
                const parking = this.findParkingById(favorite.ref_parking_api);
                if (parking) {
                    const item = this.createSuggestionItem(parking, true, favorite.id_favori);
                    this.suggestionsList.appendChild(item);
                } else {
                    console.log('Parking non trouvé pour favori:', favorite.ref_parking_api);
                }
            });
        }
        
        // Afficher l'historique
        if (this.searchHistory.length > 0) {
            const historyHeader = document.createElement('div');
            historyHeader.className = 'suggestions-header';
            historyHeader.textContent = '🕒 Historique';
            this.suggestionsList.appendChild(historyHeader);
            
            this.searchHistory.forEach(historyItem => {
                const parking = this.findParkingById(historyItem.ref_parking_api);
                if (parking) {
                    const item = this.createSuggestionItem(parking, false);
                    this.suggestionsList.appendChild(item);
                } else {
                    console.log('Parking non trouvé pour historique:', historyItem.ref_parking_api);
                }
            });
        }
        
        // Si aucun favori ni historique
        if (this.favorites.length === 0 && this.searchHistory.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'suggestion-item empty-message';
            emptyMsg.textContent = 'Aucun favori ou historique';
            this.suggestionsList.appendChild(emptyMsg);
        }
        
        this.suggestionsList.classList.remove('hidden');
    }
    
    /**
     * Trouve un parking par son ID
     */
    findParkingById(parkingId) {
        if (!this.parkingsData || !this.parkingsData.parkings) {
            console.log('findParkingById: Pas de données de parkings');
            return null;
        }
        
        const parking = this.parkingsData.parkings.find(p => p.id === parkingId);
        if (!parking) {
            // Essayer aussi avec différentes variantes d'ID
            const parkingAlt = this.parkingsData.parkings.find(p => 
                String(p.id) === String(parkingId) || 
                p.id?.toString() === parkingId?.toString()
            );
            return parkingAlt || null;
        }
        
        return parking;
    }
    
    /**
     * Crée un élément de suggestion
     */
    createSuggestionItem(parking, isFavorite = false, favoriteId = null) {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        if (isFavorite) {
            item.classList.add('favorite-item');
        }
        
        const lat = parking.lat;
        const lng = parking.lng;
        const nom = parking.name || 'Parking';
        const disponibles = parking.available_places;
        const total = parking.total_places;
        
        let info = '';
        if (disponibles !== null && disponibles !== undefined && 
            total !== null && total !== undefined) {
            info = `${disponibles}/${total} places`;
        } else if (total !== null && total !== undefined) {
            info = `${total} places`;
        }
        
        const favoriteIcon = isFavorite ? '<span class="favorite-star">⭐</span>' : '';
        
        item.innerHTML = `
            ${favoriteIcon}<strong>${nom}</strong>
            ${info ? `<div class="parking-info">${info}</div>` : ''}
            ${isFavorite && favoriteId ? `<button class="remove-favorite-btn" data-favorite-id="${favoriteId}" title="Retirer des favoris">×</button>` : ''}
        `;
        
        item.addEventListener('click', (e) => {
            // Ne pas déclencher si on clique sur le bouton de suppression
            if (e.target.classList.contains('remove-favorite-btn')) {
                e.stopPropagation();
                this.removeFavorite(favoriteId);
                return;
            }
            
            this.searchInput.value = nom;
            this.hideSuggestions();
            this.mapManager.map.setView([lat, lng], 17);
            
            // Ouvrir le popup du marqueur correspondant
            this.mapManager.parkingMarkers.forEach(marker => {
                const markerLatLng = marker.getLatLng();
                if (Math.abs(markerLatLng.lat - lat) < 0.0001 &&
                    Math.abs(markerLatLng.lng - lng) < 0.0001) {
                    marker.openPopup();
                }
            });
            
            // Enregistrer dans l'historique
            if (this.isUserLoggedIn) {
                this.addToHistory(parking.id);
            }
        });
        
        return item;
    }
    
    /**
     * Ajoute un parking aux favoris
     */
    async addFavorite(parkingId) {
        if (!this.isUserLoggedIn) {
            alert('Vous devez être connecté pour ajouter aux favoris');
            return;
        }
        
        try {
            const response = await this.apiClient.addFavorite(parkingId);
            if (response.success) {
                // Recharger les favoris
                await this.loadFavorites();
                // Mettre à jour le bouton
                this.updateFavoriteButton(parkingId, true, response.favorite_id);
            } else {
                alert('Impossible d\'ajouter aux favoris (limite de 5 favoris atteinte)');
            }
        } catch (error) {
            console.error('Erreur lors de l\'ajout du favori:', error);
            if (error.message.includes('401')) {
                alert('Vous devez être connecté pour ajouter aux favoris');
            } else {
                alert('Erreur lors de l\'ajout aux favoris');
            }
        }
    }
    
    /**
     * Supprime un favori
     */
    async removeFavorite(favoriteId) {
        if (!this.isUserLoggedIn) return;
        
        try {
            const response = await this.apiClient.removeFavorite(favoriteId);
            if (response.success) {
                // Recharger les favoris
                await this.loadFavorites();
                // Mettre à jour toutes les étoiles
                this.updateAllFavoriteStars();
                // Si on est dans la vue favoris/historique, rafraîchir
                if (!this.searchInput.value.trim()) {
                    this.showFavoritesAndHistory();
                }
            }
        } catch (error) {
            console.error('Erreur lors de la suppression du favori:', error);
            throw error;
        }
    }
    
    /**
     * Met à jour l'état d'une étoile favori
     */
    updateFavoriteStar(starElement, isFavorite, favoriteId = null) {
        if (!starElement) return;
        
        if (isFavorite) {
            starElement.textContent = '★';
            starElement.setAttribute('data-is-favorite', 'true');
            starElement.classList.add('is-favorite');
            if (favoriteId) {
                starElement.setAttribute('data-favorite-id', favoriteId);
            }
        } else {
            starElement.textContent = '☆';
            starElement.setAttribute('data-is-favorite', 'false');
            starElement.classList.remove('is-favorite');
            starElement.removeAttribute('data-favorite-id');
        }
    }
    
    /**
     * Met à jour toutes les étoiles favori dans les popups ouverts
     */
    updateAllFavoriteStars() {
        if (!this.isUserLoggedIn) return;
        
        this.mapManager.parkingMarkers.forEach(marker => {
            if (marker.parkingData) {
                const popup = marker.getPopup();
                if (popup) {
                    const popupElement = popup.getElement();
                    if (popupElement) {
                        const parkingId = marker.parkingData.id;
                        const favoriteId = this.favoritesMap.get(parkingId);
                        const isFavorite = favoriteId !== undefined;
                        
                        const starElement = popupElement.querySelector(`#favorite-star-${parkingId}`);
                        if (starElement) {
                            this.updateFavoriteStar(starElement, isFavorite, favoriteId);
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Met à jour tous les popups pour afficher les étoiles favori si l'utilisateur est connecté
     */
    updateAllPopupsForFavorites() {
        // Utiliser la méthode updateAllFavoriteStars qui gère les étoiles
        this.updateAllFavoriteStars();
    }
    
    /**
     * Met à jour tous les boutons favori dans les popups
     */
    updateFavoriteButtons() {
        if (!this.isUserLoggedIn) return;
        
        // Utiliser une délai pour s'assurer que les popups sont créés
        setTimeout(() => {
            this.mapManager.parkingMarkers.forEach(marker => {
                if (marker.parkingData) {
                    const parkingId = marker.parkingData.id;
                    const favoriteId = this.favoritesMap.get(parkingId);
                    this.updateFavoriteButton(parkingId, favoriteId !== undefined, favoriteId);
                }
            });
        }, 1000);
    }
    
    /**
     * Met à jour un bouton favori spécifique
     */
    updateFavoriteButton(parkingId, isFavorite, favoriteId = null) {
        // Trouver le popup correspondant
        this.mapManager.parkingMarkers.forEach(marker => {
            if (marker.parkingData && marker.parkingData.id === parkingId) {
                const popup = marker.getPopup();
                if (popup) {
                    const popupContent = popup.getContent();
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = popupContent;
                    
                    const favoriteBtn = tempDiv.querySelector('.btn-favorite');
                    if (favoriteBtn) {
                        if (isFavorite) {
                            favoriteBtn.innerHTML = '<span class="favorite-icon">★</span> Retirer des favoris';
                            favoriteBtn.setAttribute('data-is-favorite', 'true');
                            favoriteBtn.setAttribute('data-favorite-id', favoriteId);
                            favoriteBtn.classList.add('is-favorite');
                        } else {
                            favoriteBtn.innerHTML = '<span class="favorite-icon">☆</span> Ajouter aux favoris';
                            favoriteBtn.setAttribute('data-is-favorite', 'false');
                            favoriteBtn.classList.remove('is-favorite');
                        }
                        
                        // Mettre à jour le popup
                        marker.setPopupContent(tempDiv.innerHTML);
                        
                        // Réattacher l'événement
                        const newBtn = marker.getPopup().getElement().querySelector('.btn-favorite');
                        if (newBtn) {
                            newBtn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const isFav = newBtn.getAttribute('data-is-favorite') === 'true';
                                if (isFav) {
                                    const favId = newBtn.getAttribute('data-favorite-id');
                                    this.removeFavorite(parseInt(favId));
                                } else {
                                    this.addFavorite(parkingId);
                                }
                            });
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Ajoute une recherche à l'historique
     */
    async addToHistory(parkingId) {
        if (!this.isUserLoggedIn) return;
        
        try {
            await this.apiClient.addToHistory(parkingId);
            // Recharger l'historique
            await this.loadSearchHistory();
        } catch (error) {
            console.error('Erreur lors de l\'ajout à l\'historique:', error);
        }
    }
    
    /**
     * Applique les filtres selon les préférences utilisateur
     * 
     * Principe : Single Responsibility Principle (SRP)
     * Cette méthode a une seule responsabilité : filtrer les parkings selon les préférences
     */
    applyFilters() {
        if (!this.userPreferences || !this.parkingsData) {
            return;
        }
        
        // Gérer le nouveau format standardisé
        let parkings = [];
        if (Array.isArray(this.parkingsData.parkings)) {
            parkings = this.parkingsData.parkings;
        } else if (Array.isArray(this.parkingsData)) {
            parkings = this.parkingsData;
        } else {
            return; // Format non reconnu
        }
        
        const filteredParkings = parkings.filter(parking => {
            // Filtre 1 : Préférence de coût
            if (this.userPreferences.preference_cout === 'GRATUIT') {
                // Masquer les parkings payants
                const cost = (parking.cost || '').toLowerCase();
                if (cost.includes('payant') || 
                    cost.includes('€') || 
                    cost.includes('£') ||
                    (parseFloat(cost) > 0)) {
                    return false;
                }
            } else if (this.userPreferences.preference_cout === 'PAYANT') {
                // Masquer les parkings gratuits
                const cost = (parking.cost || '').toLowerCase();
                if (cost.includes('gratuit') || 
                    cost === '0' || 
                    cost === '' ||
                    cost.includes('non spécifié')) {
                    return false;
                }
            }
            
            // Filtre 2 : Accessibilité PMR
            if (this.userPreferences.est_pmr) {
                // Vérifier si le parking est accessible PMR (format standardisé)
                if (parking.is_pmr === true) {
                    return true;
                }
                // Si pas d'info claire, on garde le parking (mieux vaut trop que pas assez)
            }
            
            // Filtre 3 : Type de véhicule et motorisation
            if (this.userPreferences.vehicules && this.userPreferences.vehicules.length > 0) {
                const vehicule = this.userPreferences.vehicules[0]; // Prendre le premier véhicule
                
                // Si l'utilisateur a un vélo, on ne fait rien (pas de filtre)
                if (vehicule.libelle_type === 'Velo') {
                    return true;
                }
                
                // Si l'utilisateur a une moto
                if (vehicule.libelle_type === 'Moto') {
                    // Les motos peuvent généralement se garer partout (pas de filtre spécial)
                    return true;
                }
                
                // Si l'utilisateur a une voiture électrique
                if (vehicule.libelle_moto === 'Electrique') {
                    // Vérifier si le parking a des bornes de recharge (format standardisé)
                    if (parking.has_electric_charging === true) {
                        return true;
                    }
                    // Sinon, on garde le parking (on ne peut pas être sûr qu'il n'y a pas de bornes)
                }
                
                // Si l'utilisateur a une voiture hybride
                if (vehicule.libelle_moto === 'Hybride') {
                    // Les hybrides peuvent utiliser les bornes électriques mais aussi les parkings normaux
                    // On garde tous les parkings (pas de filtre spécial)
                    return true;
                }
                
                // Si l'utilisateur a une voiture thermique
                if (vehicule.libelle_moto === 'Thermique (Essence/Diesel)') {
                    // Les voitures thermiques peuvent se garer partout (pas de filtre spécial)
                    return true;
                }
            }
            
            return true;
        });
        
        const filteredData = {
            city: this.parkingsData.city || this.currentCity,
            parkings: filteredParkings,
            count: filteredParkings.length
        };
        
        if (!this.mapManager.isGuidanceActive) {
            this.mapManager.displayParkings(filteredData, false);
        }
    }
    
    /**
     * Gère la saisie dans le champ de recherche
     * 
     * @param {string} query Terme de recherche
     */
    handleSearchInput(query) {
        if (query.length < 2) {
            this.hideSuggestions();
            return;
        }
        
        const filtered = this.filterParkings(query);
        this.showSuggestions(filtered);
    }
    
    /**
     * Filtre les parkings selon un terme de recherche
     * 
     * @param {string} query Terme de recherche
     * @returns {Array} Parkings filtrés
     */
    filterParkings(query) {
        // Gérer le nouveau format standardisé
        let parkings = [];
        if (this.parkingsData && Array.isArray(this.parkingsData.parkings)) {
            parkings = this.parkingsData.parkings;
        } else if (this.parkingsData && Array.isArray(this.parkingsData)) {
            parkings = this.parkingsData;
        } else if (this.parkingsData && this.parkingsData.features) {
            // Format GeoJSON ancien (rétrocompatibilité)
            parkings = this.parkingsData.features.map(feature => ({
                id: feature.id || feature.properties?.id,
                name: this.mapManager.cleanParkingName(feature.properties || {}),
                lat: feature.geometry?.coordinates?.[1],
                lng: feature.geometry?.coordinates?.[0],
                total_places: feature.properties?.place_total || feature.properties?.total,
                available_places: feature.properties?.place_libre || feature.properties?.dispo,
                status: 'UNKNOWN',
                cost: feature.properties?.cout || null,
                is_pmr: false,
                has_electric_charging: false,
                properties: feature.properties // Garder pour isValidParking
            }));
        }
        
        if (parkings.length === 0) {
            return [];
        }
        
        const queryLower = query.toLowerCase();
        return parkings.filter(parking => {
            // Si le filtre est actif, exclure les parkings de rue (uniquement pour format GeoJSON)
            if (this.filterRealParkings && parking.properties && !this.mapManager.isValidParking(parking.properties)) {
                return false;
            }
            const nom = (parking.name || '').toLowerCase();
            const quartier = (parking.additional_info?.quartier || '').toLowerCase();
            return nom.includes(queryLower) || quartier.includes(queryLower);
        });
    }
    
    /**
     * Affiche les suggestions de recherche
     * 
     * @param {Array} parkings Parkings à afficher (format standardisé)
     */
    showSuggestions(parkings) {
        if (!this.suggestionsList) return;
        
        if (parkings.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestionsList.innerHTML = '';
        
        parkings.slice(0, 5).forEach(parking => {
            const lat = parking.lat;
            const lng = parking.lng;
            const nom = parking.name || 'Parking';
            const disponibles = parking.available_places;
            const total = parking.total_places;
            
            if (lat === null || lng === null) {
                return; // Ignorer les parkings sans coordonnées
            }
            
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            
            let info = '';
            // Afficher les infos seulement si les valeurs sont valides
            if (disponibles !== null && disponibles !== undefined && 
                total !== null && total !== undefined) {
                info = `${disponibles}/${total} places`;
            } else if (total !== null && total !== undefined) {
                info = `${total} places`;
            }
            
            item.innerHTML = `
                <strong>${nom}</strong>
                ${info ? `<div class="parking-info">${info}</div>` : ''}
            `;
            
            item.addEventListener('click', () => {
                this.searchInput.value = nom;
                this.hideSuggestions();
                this.mapManager.map.setView([lat, lng], 17);
                
                // Ouvrir le popup du marqueur correspondant
                this.mapManager.parkingMarkers.forEach(marker => {
                    const markerLatLng = marker.getLatLng();
                    if (Math.abs(markerLatLng.lat - lat) < 0.0001 &&
                        Math.abs(markerLatLng.lng - lng) < 0.0001) {
                        marker.openPopup();
                        
                        // Enregistrer dans l'historique
                        if (this.isUserLoggedIn && marker.parkingData) {
                            this.addToHistory(marker.parkingData.id);
                        }
                    }
                });
            });
            
            this.suggestionsList.appendChild(item);
        });
        
        this.suggestionsList.classList.remove('hidden');
    }
    
    /**
     * Cache les suggestions
     */
    hideSuggestions() {
        if (this.suggestionsList) {
            this.suggestionsList.classList.add('hidden');
        }
    }
    
    /**
     * Effectue une recherche de parkings
     */
    async performSearch() {
        const query = this.searchInput.value.trim();
        
        if (query.length < 2) {
            this.showError('Veuillez entrer au moins 2 caractères');
            return;
        }
        
        try {
            const results = await this.apiClient.searchParkings(query, this.currentCity);
            
            // Gérer le nouveau format standardisé
            let parkings = [];
            if (results && Array.isArray(results.parkings)) {
                parkings = results.parkings;
            } else if (results && Array.isArray(results)) {
                parkings = results;
            } else if (results && results.features) {
                // Format GeoJSON ancien (rétrocompatibilité)
                parkings = results.features.map(feature => ({
                    id: feature.id || feature.properties?.id,
                    name: this.mapManager.cleanParkingName(feature.properties || {}),
                    lat: feature.geometry?.coordinates?.[1],
                    lng: feature.geometry?.coordinates?.[0],
                    total_places: feature.properties?.place_total || feature.properties?.total,
                    available_places: feature.properties?.place_libre || feature.properties?.dispo,
                    status: 'UNKNOWN',
                    cost: feature.properties?.cout || null,
                    is_pmr: false,
                    has_electric_charging: false,
                    properties: feature.properties // Garder pour isValidParking
                }));
            }
            
            if (parkings.length === 0) {
                this.showError('Aucun parking trouvé');
                return;
            }
            
            // Filtrer les résultats si le filtre est activé (uniquement pour format GeoJSON)
            if (this.filterRealParkings) {
                parkings = parkings.filter(p => {
                    if (p.properties) {
                        return this.mapManager.isValidParking(p.properties);
                    }
                    return true; // Format standardisé, pas de filtre de rue
                });
                
                if (parkings.length === 0) {
                    this.showError('Aucun parking valide trouvé (filtre actif)');
                    return;
                }
            }
            
            // Garder tous les parkings dans les résultats de recherche (y compris les fermés)
            const searchResults = {
                city: results.city || this.currentCity,
                parkings: parkings,
                count: parkings.length
            };
            
            // Afficher les résultats filtrés sur la carte avec forceFitBounds pour la recherche
            this.mapManager.displayParkings(searchResults, true);
            
            // Centrer sur le premier résultat
            if (parkings.length > 0 && parkings[0].lat && parkings[0].lng) {
                this.mapManager.map.setView([parkings[0].lat, parkings[0].lng], 17);
                
                // Enregistrer dans l'historique
                if (this.isUserLoggedIn) {
                    this.addToHistory(parkings[0].id);
                }
            }
            
            this.hideSuggestions();
            
        } catch (error) {
            console.error('Erreur lors de la recherche:', error);
            this.showError('Erreur lors de la recherche: ' + error.message);
        }
    }
    
    /**
     * Guide vers le parking le plus proche
     */
    guideToNearestParking() {
        if (!this.mapManager.userPosition) {
            this.showError('Position utilisateur non disponible');
            return;
        }
        
        // Gérer le nouveau format standardisé
        let parkings = [];
        if (this.parkingsData && Array.isArray(this.parkingsData.parkings)) {
            parkings = this.parkingsData.parkings;
        } else if (this.parkingsData && Array.isArray(this.parkingsData)) {
            parkings = this.parkingsData;
        } else if (this.parkingsData && this.parkingsData.features) {
            // Format GeoJSON ancien (rétrocompatibilité)
            parkings = this.parkingsData.features.map(feature => ({
                id: feature.id || feature.properties?.id,
                name: this.mapManager.cleanParkingName(feature.properties || {}),
                lat: feature.geometry?.coordinates?.[1],
                lng: feature.geometry?.coordinates?.[0],
                total_places: feature.properties?.place_total || feature.properties?.total,
                available_places: feature.properties?.place_libre || feature.properties?.dispo,
                status: 'UNKNOWN',
                cost: feature.properties?.cout || null,
                is_pmr: false,
                has_electric_charging: false
            }));
        }
        
        if (parkings.length === 0) {
            this.showError('Aucun parking disponible');
            return;
        }
        
        // Filtrer les parkings de rue si le filtre est actif
        if (this.filterRealParkings) {
            parkings = parkings.filter(parking => {
                // Pour le format standardisé
                if (parking.lat && parking.lng && parking.name) {
                    return this.mapManager.isValidParkingStandardized(parking);
                }
                // Pour le format GeoJSON ancien (rétrocompatibilité)
                if (parking.properties) {
                    return this.mapManager.isValidParking(parking.properties);
                }
                return true; // Si on ne peut pas déterminer, on garde
            });
        }
        
        if (parkings.length === 0) {
            this.showError('Aucun parking valide trouvé (filtre actif)');
            return;
        }
        
        // Filtrer selon les préférences utilisateur si connecté
        if (this.userPreferences) {
            parkings = parkings.filter(parking => {
                // Filtre PMR
                if (this.userPreferences.est_pmr && !parking.is_pmr) {
                    return false;
                }
                // Filtre coût
                if (this.userPreferences.preference_cout === 'GRATUIT') {
                    const cost = (parking.cost || '').toLowerCase();
                    if (cost.includes('payant') || cost.includes('£') || parseFloat(cost) > 0) {
                        return false;
                    }
                }
                return true;
            });
        }
        
        if (parkings.length === 0) {
            this.showError('Aucun parking correspondant à vos préférences');
            return;
        }
        
        const nearest = this.findNearestParkingStandardized(
            parkings,
            this.mapManager.userPosition[0],
            this.mapManager.userPosition[1]
        );
        
        if (!nearest) {
            this.showError('Aucun parking trouvé');
            return;
        }
        
        this.startGuidance(nearest.lat, nearest.lng, nearest.name);
    }
    
    /**
     * Trouve le parking le plus proche (format standardisé)
     * 
     * @param {Array} parkings Liste de parkings au format standardisé
     * @param {number} userLat Latitude de l'utilisateur
     * @param {number} userLng Longitude de l'utilisateur
     * @returns {Object|null} Parking le plus proche ou null
     */
    findNearestParkingStandardized(parkings, userLat, userLng) {
        let nearest = null;
        let minDistance = Infinity;
        
        parkings.forEach(parking => {
            if (parking.lat === null || parking.lng === null) {
                return;
            }
            
            const distance = this.mapManager.calculateDistance(
                userLat,
                userLng,
                parking.lat,
                parking.lng
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                nearest = parking;
            }
        });
        
        return nearest;
    }
    
    /**
     * Démarre le guidage vers une destination
     * 
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @param {string} destinationName Nom de la destination (optionnel)
     */
    async startGuidance(lat, lng, destinationName = null) {
        // Vérifier si on est en mode avion
        if (this.apiClient.isOffline()) {
            this.showError('Impossible de calculer un itinéraire en mode avion. Le calcul d\'itinéraire nécessite une connexion internet.');
            return;
        }
        
        try {
            // Trouver le parking correspondant à cette destination
            let parking = this.findParkingByCoordinates(lat, lng);
            
            // Si le parking n'est pas trouvé par coordonnées, essayer de le trouver par nom
            if (!parking && destinationName) {
                parking = this.findParkingByName(destinationName);
            }
            
            // Vérifier si le parking est fermé
            if (parking && parking.status === 'CLOSED') {
                this.showError('Impossible de démarrer le guidage vers un parking fermé.');
                return;
            }
            
            // Si toujours pas trouvé, créer un objet parking temporaire avec les infos disponibles
            if (!parking) {
                parking = {
                    lat: lat,
                    lng: lng,
                    name: destinationName || 'Destination',
                    id: null
                };
            }
            
            this.currentGuidanceParking = parking;
            console.log('Parking sélectionné pour guidage:', parking);
            console.log('Nom du parking:', parking.name);
            console.log('Ville actuelle:', this.currentCity);
            
            await this.mapManager.startGuidance(lat, lng, destinationName);
            
            // Démarrer la vérification périodique de disponibilité (seulement pour Metz et Parking de la République)
            const isRepublique = parking && parking.name && 
                (parking.name.toLowerCase().includes('république') || 
                 parking.name.toLowerCase().includes('republique') ||
                 (destinationName && (destinationName.toLowerCase().includes('république') || 
                                     destinationName.toLowerCase().includes('republique'))));
            
            if (this.currentCity === 'metz' && isRepublique) {
                this.stopAvailabilityCheck(); // Arrêter l'ancien si existe
                this.startAvailabilityCheck();
            } else {
                this.stopAvailabilityCheck(); // Arrêter si ce n'est pas le bon parking
            }
        } catch (error) {
            console.error('Erreur lors du démarrage du guidage:', error);
            
            // Vérifier si c'est une erreur de connexion
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                this.showError('Impossible de calculer l\'itinéraire. Vérifiez votre connexion internet.');
            } else {
                this.showError('Impossible de démarrer le guidage: ' + error.message);
            }
        }
    }
    
    /**
     * Trouve un parking par son nom
     * 
     * @param {string} name Nom du parking à rechercher
     * @returns {Object|null} Parking trouvé ou null
     */
    findParkingByName(name) {
        if (!this.parkingsData || !name) {
            return null;
        }
        
        let parkings = [];
        if (Array.isArray(this.parkingsData.parkings)) {
            parkings = this.parkingsData.parkings;
        } else if (Array.isArray(this.parkingsData)) {
            parkings = this.parkingsData;
        } else {
            return null;
        }
        
        const nameLower = name.toLowerCase().trim();
        
        // Chercher une correspondance exacte ou partielle
        // Supporte "République", "Parking République", "Parking de la République", etc.
        const parking = parkings.find(p => {
            if (!p.name) return false;
            const parkingNameLower = p.name.toLowerCase().trim();
            
            // Correspondance exacte
            if (parkingNameLower === nameLower) {
                return true;
            }
            
            // Correspondance partielle (l'un contient l'autre)
            if (parkingNameLower.includes(nameLower) || nameLower.includes(parkingNameLower)) {
                return true;
            }
            
            // Vérifier aussi si les deux contiennent "république" ou "republique"
            const hasRepublique = (parkingNameLower.includes('république') || parkingNameLower.includes('republique')) &&
                                 (nameLower.includes('république') || nameLower.includes('republique'));
            
            if (hasRepublique) {
                return true;
            }
            
            return false;
        });
        
        return parking || null;
    }
    
    /**
     * Arrête le guidage
     */
    stopGuidance() {
        this.stopAvailabilityCheck();
        this.currentGuidanceParking = null;
        this.mapManager.stopGuidance();
    }
    
    /**
     * Trouve un parking par ses coordonnées
     * 
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @returns {Object|null} Parking trouvé ou null
     */
    findParkingByCoordinates(lat, lng) {
        if (!this.parkingsData) {
            return null;
        }
        
        let parkings = [];
        if (Array.isArray(this.parkingsData.parkings)) {
            parkings = this.parkingsData.parkings;
        } else if (Array.isArray(this.parkingsData)) {
            parkings = this.parkingsData;
        } else {
            return null;
        }
        
        // Trouver le parking le plus proche des coordonnées (tolérance de 200m pour être plus flexible)
        let nearest = null;
        let minDistance = Infinity;
        const tolerance = 200; // mètres (augmenté pour être plus flexible)
        
        parkings.forEach(parking => {
            if (parking.lat === null || parking.lng === null) {
                return;
            }
            
            const distance = this.mapManager.calculateDistance(
                lat,
                lng,
                parking.lat,
                parking.lng
            );
            
            if (distance < tolerance && distance < minDistance) {
                minDistance = distance;
                nearest = parking;
            }
        });
        
        return nearest;
    }
    
    /**
     * Trouve un parking alternatif conforme aux critères du parking actuel ET aux préférences utilisateur
     * 
     * @param {Object} excludeParking Parking à exclure de la recherche
     * @returns {Object|null} Parking alternatif ou null
     */
    findAlternativeParking(excludeParking) {
        console.log('=== findAlternativeParking appelé ===');
        console.log('- excludeParking:', excludeParking);
        console.log('- parkingsData:', this.parkingsData ? 'présent' : 'absent');
        console.log('- userPosition:', this.mapManager.userPosition);
        
        if (!this.parkingsData) {
            console.error('Aucune donnée de parkings disponible');
            return null;
        }
        
        if (!this.mapManager.userPosition) {
            console.error('Position utilisateur non disponible');
            return null;
        }
        
        // Obtenir tous les parkings
        let parkings = [];
        if (Array.isArray(this.parkingsData.parkings)) {
            parkings = this.parkingsData.parkings;
        } else if (Array.isArray(this.parkingsData)) {
            parkings = this.parkingsData;
        } else {
            console.error('Format de données de parkings non reconnu');
            return null;
        }
        
        console.log('- Nombre total de parkings:', parkings.length);
        
        // Extraire les caractéristiques du parking actuel pour trouver un équivalent
        const currentCost = excludeParking?.cost || '';
        const currentIsPmr = excludeParking?.is_pmr || false;
        const currentHasElectric = excludeParking?.has_electric_charging || false;
        
        console.log('- Caractéristiques du parking actuel:');
        console.log('  * Coût:', currentCost);
        console.log('  * PMR:', currentIsPmr);
        console.log('  * Électrique:', currentHasElectric);
        
        // Exclure le parking actuel
        const excludeName = excludeParking?.name?.toLowerCase() || '';
        const excludeId = excludeParking?.id || '';
        
        // Étape 1 : Chercher un parking avec les MÊMES caractéristiques que le parking actuel
        let matchingParkings = parkings.filter(parking => {
            if (!parking.lat || !parking.lng) {
                return false;
            }
            
            // Exclure les parkings fermés
            if (parking.status === 'CLOSED') {
                return false;
            }
            
            // Exclure le parking actuel
            if (excludeId && parking.id === excludeId) {
                return false;
            }
            
            if (excludeName && parking.name) {
                const parkingNameLower = parking.name.toLowerCase();
                if (parkingNameLower === excludeName || 
                    parkingNameLower.includes(excludeName) ||
                    excludeName.includes(parkingNameLower)) {
                    return false;
                }
            }
            
            // Vérifier que le coût correspond
            const parkingCost = (parking.cost || '').toLowerCase();
            const currentCostLower = currentCost.toLowerCase();
            
            // Correspondance de coût : gratuit/gratuit ou payant/payant
            const isGratuit = parkingCost.includes('gratuit') || parkingCost === '' || parkingCost === '0';
            const currentIsGratuit = currentCostLower.includes('gratuit') || currentCostLower === '' || currentCostLower === '0';
            const isPayant = parkingCost.includes('payant') || parkingCost.includes('€') || parseFloat(parkingCost) > 0;
            const currentIsPayant = currentCostLower.includes('payant') || currentCostLower.includes('€') || parseFloat(currentCostLower) > 0;
            
            if (isGratuit !== currentIsGratuit && isPayant !== currentIsPayant) {
                // Le coût ne correspond pas
                return false;
            }
            
            // Vérifier PMR si le parking actuel est PMR
            if (currentIsPmr && !parking.is_pmr) {
                return false;
            }
            
            // Vérifier électrique si le parking actuel a des bornes
            if (currentHasElectric && !parking.has_electric_charging) {
                return false;
            }
            
            return true;
        });
        
        console.log('- Parkings avec mêmes caractéristiques:', matchingParkings.length);
        
        // Étape 2 : Si aucun parking avec les mêmes caractéristiques, appliquer les filtres utilisateur
        if (matchingParkings.length === 0) {
            console.log('Aucun parking avec mêmes caractéristiques, application des filtres utilisateur...');
            matchingParkings = this.applyFiltersToParkings(parkings);
            
            // Exclure le parking actuel
            matchingParkings = matchingParkings.filter(parking => {
                if (!parking.lat || !parking.lng) {
                    return false;
                }
                
                if (excludeId && parking.id === excludeId) {
                    return false;
                }
                
                if (excludeName && parking.name) {
                    const parkingNameLower = parking.name.toLowerCase();
                    if (parkingNameLower === excludeName || 
                        parkingNameLower.includes(excludeName) ||
                        excludeName.includes(parkingNameLower)) {
                        return false;
                    }
                }
                
                return true;
            });
            
            console.log('- Parkings après filtres utilisateur:', matchingParkings.length);
        } else {
            // Exclure le parking actuel des parkings avec mêmes caractéristiques
            matchingParkings = matchingParkings.filter(parking => {
                if (excludeId && parking.id === excludeId) {
                    return false;
                }
                
                if (excludeName && parking.name) {
                    const parkingNameLower = parking.name.toLowerCase();
                    if (parkingNameLower === excludeName || 
                        parkingNameLower.includes(excludeName) ||
                        excludeName.includes(parkingNameLower)) {
                        return false;
                    }
                }
                
                return true;
            });
        }
        
        // Étape 3 : Si toujours aucun, prendre n'importe quel parking ouvert (sauf le parking actuel)
        if (matchingParkings.length === 0) {
            console.warn('Aucun parking après filtres, recherche sans critères (mais parkings ouverts uniquement)...');
            
            matchingParkings = parkings.filter(parking => {
                if (!parking.lat || !parking.lng) {
                    return false;
                }
                
                // Exclure les parkings fermés
                if (parking.status === 'CLOSED') {
                    return false;
                }
                
                if (excludeId && parking.id === excludeId) {
                    return false;
                }
                
                if (excludeName && parking.name) {
                    const parkingNameLower = parking.name.toLowerCase();
                    if (parkingNameLower === excludeName || 
                        parkingNameLower.includes(excludeName) ||
                        excludeName.includes(parkingNameLower)) {
                        return false;
                    }
                }
                
                return true;
            });
            
            console.log('- Parkings disponibles (sans critères, ouverts uniquement):', matchingParkings.length);
        }
        
        if (matchingParkings.length === 0) {
            console.error('Aucun parking alternatif disponible');
            return null;
        }
        
        // Trouver le parking le plus proche de la position actuelle de l'utilisateur
        const alternative = this.findNearestParkingStandardized(
            matchingParkings,
            this.mapManager.userPosition[0],
            this.mapManager.userPosition[1]
        );
        
        console.log('- Parking alternatif sélectionné:', alternative);
        if (alternative) {
            console.log('  * Coût:', alternative.cost);
            console.log('  * PMR:', alternative.is_pmr);
            console.log('  * Électrique:', alternative.has_electric_charging);
        }
        
        return alternative;
    }
    
    /**
     * Filtre les parkings fermés d'un objet de données de parkings
     * 
     * @param {Object} data Données de parkings au format {city, parkings, count} ou tableau
     * @returns {Object|Array} Données filtrées sans les parkings fermés
     */
    filterClosedParkings(data) {
        if (!data) {
            return data;
        }
        
        let parkings = [];
        if (Array.isArray(data.parkings)) {
            parkings = data.parkings;
        } else if (Array.isArray(data)) {
            parkings = data;
        } else {
            return data;
        }
        
        const filteredParkings = parkings.filter(parking => parking.status !== 'CLOSED');
        
        if (Array.isArray(data)) {
            return filteredParkings;
        } else {
            return {
                ...data,
                parkings: filteredParkings,
                count: filteredParkings.length
            };
        }
    }
    
    /**
     * Applique les filtres utilisateur à une liste de parkings
     * 
     * @param {Array} parkings Liste de parkings
     * @returns {Array} Parkings filtrés
     */
    applyFiltersToParkings(parkings) {
        if (!this.userPreferences) {
            return parkings;
        }
        
        return parkings.filter(parking => {
            // Filtre 1 : Préférence de coût
            if (this.userPreferences.preference_cout === 'GRATUIT') {
                const cost = (parking.cost || '').toLowerCase();
                if (cost.includes('payant') || 
                    cost.includes('€') || 
                    cost.includes('£') ||
                    (parseFloat(cost) > 0)) {
                    return false;
                }
            } else if (this.userPreferences.preference_cout === 'PAYANT') {
                const cost = (parking.cost || '').toLowerCase();
                if (cost.includes('gratuit') || 
                    cost === '0' || 
                    cost === '' ||
                    cost.includes('non spécifié')) {
                    return false;
                }
            }
            
            // Filtre 2 : Accessibilité PMR
            if (this.userPreferences.est_pmr) {
                if (parking.is_pmr === true) {
                    return true;
                }
            }
            
            // Filtre 3 : Type de véhicule et motorisation
            if (this.userPreferences.vehicules && this.userPreferences.vehicules.length > 0) {
                const vehicule = this.userPreferences.vehicules[0];
                
                if (vehicule.libelle_type === 'Velo') {
                    return true;
                }
                
                if (vehicule.libelle_type === 'Moto') {
                    return true;
                }
                
                if (vehicule.libelle_moto === 'Electrique') {
                    if (parking.has_electric_charging === true) {
                        return true;
                    }
                }
                
                if (vehicule.libelle_moto === 'Hybride') {
                    return true;
                }
                
                if (vehicule.libelle_moto === 'Thermique (Essence/Diesel)') {
                    return true;
                }
            }
            
            return true;
        });
    }
    
    /**
     * Vérifie la disponibilité du parking actuel et redirige si nécessaire
     * 
     * @param {boolean} simulate Si true, simule l'indisponibilité même si le parking est disponible
     */
    async checkParkingAvailability(simulate = false) {
        console.log('=== checkParkingAvailability appelé ===');
        console.log('- simulate:', simulate);
        console.log('- currentGuidanceParking:', this.currentGuidanceParking);
        console.log('- isGuidanceActive:', this.mapManager.isGuidanceActive);
        
        if (!this.currentGuidanceParking) {
            console.error('Aucun parking en guidage actuellement');
            this.showError('Aucun parking sélectionné pour le guidage.');
            return;
        }
        
        if (!this.mapManager.isGuidanceActive) {
            console.error('Le guidage n\'est pas actif');
            this.showError('Le guidage n\'est pas actif.');
            return;
        }
        
        // Pour la démo : simuler l'indisponibilité du Parking de la République
        // Si simulate est true, forcer l'indisponibilité
        const isUnavailable = simulate ? true : this.isParkingUnavailable(this.currentGuidanceParking);
        
        console.log('- simulate:', simulate);
        console.log('- isUnavailable:', isUnavailable);
        console.log('- Parking actuel:', this.currentGuidanceParking.name);
        
        if (isUnavailable) {
            console.log('Parking indisponible détecté:', this.currentGuidanceParking.name);
            this.showNotification('Recherche d\'un parking alternatif...', 'info');
            
            // Trouver un parking alternatif
            const alternativeParking = this.findAlternativeParking(this.currentGuidanceParking);
            
            console.log('- Parking alternatif trouvé:', alternativeParking);
            
            if (alternativeParking) {
                this.showNotification(
                    `Le parking "${this.currentGuidanceParking.name}" est indisponible. Redirection vers "${alternativeParking.name}"...`,
                    'warning'
                );
                
                // Attendre un peu pour que la notification soit visible
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Rediriger vers le nouveau parking
                await this.redirectGuidance(alternativeParking);
            } else {
                console.error('Aucun parking alternatif trouvé');
                this.showError('Aucun parking alternatif conforme à vos critères n\'a été trouvé.');
            }
        } else {
            console.log('Le parking est disponible');
            this.showNotification('Le parking est disponible.', 'success');
        }
    }
    
    /**
     * Vérifie si un parking est indisponible (simulation)
     * 
     * @param {Object} parking Parking à vérifier
     * @returns {boolean} True si le parking est indisponible
     */
    isParkingUnavailable(parking) {
        // Simulation : pour le Parking de la République à Metz, on peut simuler l'indisponibilité
        // En production, cela ferait un appel API pour vérifier la disponibilité en temps réel
        if (this.currentCity === 'metz' && parking.name && 
            parking.name.toLowerCase().includes('république')) {
            // Pour la démo, on peut utiliser une variable de simulation
            // En production, cela serait une vraie vérification API
            return false; // Par défaut disponible, mais peut être simulé
        }
        
        return false;
    }
    
    /**
     * Redirige le guidage vers un nouveau parking
     * 
     * @param {Object} newParking Nouveau parking vers lequel rediriger
     */
    async redirectGuidance(newParking) {
        console.log('=== redirectGuidance appelé ===');
        console.log('- newParking:', newParking);
        
        if (!newParking || !newParking.lat || !newParking.lng) {
            console.error('Parking invalide pour redirection:', newParking);
            this.showError('Parking invalide pour redirection.');
            return;
        }
        
        // Vérifier si on est en mode avion
        if (this.apiClient.isOffline()) {
            this.showError('Impossible de rediriger en mode avion.');
            return;
        }
        
        // Arrêter l'ancien guidage d'abord
        this.mapManager.stopGuidance();
        
        // Attendre un peu pour que l'arrêt soit effectif
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Mettre à jour le parking actuel AVANT de démarrer le guidage
        this.currentGuidanceParking = newParking;
        console.log('- Parking actuel mis à jour pour redirection:', this.currentGuidanceParking);
        
        // Utiliser la méthode startGuidance de app.js qui gère tous les événements
        try {
            console.log('Démarrage du guidage vers le nouveau parking...');
            console.log('- Coordonnées:', newParking.lat, newParking.lng);
            console.log('- Nom:', newParking.name);
            
            // Utiliser startGuidance de app.js qui déclenche tous les événements nécessaires
            // Mais s'assurer que le parking trouvé correspond au nouveau parking
            await this.mapManager.startGuidance(newParking.lat, newParking.lng, newParking.name);
            
            // S'assurer que currentGuidanceParking reste le nouveau parking
            // (car startGuidance pourrait essayer de le trouver à nouveau)
            this.currentGuidanceParking = newParking;
            
            // Redémarrer la vérification de disponibilité si nécessaire
            const nameLower = (newParking.name || '').toLowerCase();
            const isRepublique = nameLower.includes('république') || nameLower.includes('republique');
            
            if (this.currentCity === 'metz' && isRepublique) {
                this.stopAvailabilityCheck(); // Arrêter l'ancien
                this.startAvailabilityCheck(); // Redémarrer
            } else {
                this.stopAvailabilityCheck(); // Arrêter si ce n'est plus République
            }
            
            this.showNotification(`Guidage redirigé vers "${newParking.name}"`, 'success');
            console.log('Redirection réussie');
        } catch (error) {
            console.error('Erreur lors de la redirection:', error);
            this.showError('Erreur lors de la redirection vers le nouveau parking: ' + error.message);
        }
    }
    
    /**
     * Démarre la vérification périodique de disponibilité
     */
    startAvailabilityCheck() {
        // Vérifier toutes les 10 secondes (pour la démo, en production ce serait plus long)
        this.availabilityCheckInterval = setInterval(() => {
            this.checkParkingAvailability(false);
        }, 10000); // 10 secondes pour la démo
        
        console.log('Vérification de disponibilité démarrée');
    }
    
    /**
     * Arrête la vérification périodique de disponibilité
     */
    stopAvailabilityCheck() {
        if (this.availabilityCheckInterval) {
            clearInterval(this.availabilityCheckInterval);
            this.availabilityCheckInterval = null;
            console.log('Vérification de disponibilité arrêtée');
        }
    }
    
    /**
     * Appelé quand le guidage démarre
     */
    onGuidanceStarted(destinationName) {
        // Cacher les marqueurs de parkings
        this.mapManager.clearParkingMarkers();
        
        // Cacher la barre de recherche
        if (this.searchBar) {
            this.searchBar.classList.add('hidden');
        }
        
        // Afficher le panneau de guidage
        if (this.guidancePanel) {
            this.guidancePanel.classList.remove('hidden');
        }
        
        // Mettre à jour le nom de destination
        if (this.guidanceDestinationName) {
            this.guidanceDestinationName.textContent = destinationName || 'Destination';
        }
        
        // Afficher/masquer les boutons appropriés
        if (this.nearestParkingBtn) {
            this.nearestParkingBtn.classList.add('hidden');
        }
        if (this.followUserCheckbox && this.followUserCheckbox.parentElement) {
            this.followUserCheckbox.parentElement.classList.remove('hidden');
        }
        
        // Afficher le bouton de simulation seulement pour le Parking de la République à Metz
        if (this.simulateUnavailabilityContainer) {
            const parkingName = this.currentGuidanceParking?.name || '';
            const destName = destinationName || '';
            const nameLower = (parkingName + ' ' + destName).toLowerCase();
            
            const isRepublique = nameLower.includes('république') || nameLower.includes('republique');
            
            console.log('Vérification affichage bouton simulation:');
            console.log('- Ville:', this.currentCity);
            console.log('- Parking name:', parkingName);
            console.log('- Destination name:', destName);
            console.log('- Is République:', isRepublique);
            console.log('- Current guidance parking:', this.currentGuidanceParking);
            
            if (this.currentCity === 'metz' && isRepublique) {
                this.simulateUnavailabilityContainer.classList.remove('hidden');
                console.log('Bouton de simulation affiché');
            } else {
                this.simulateUnavailabilityContainer.classList.add('hidden');
                console.log('Bouton de simulation masqué');
            }
        }
    }
    
    /**
     * Appelé quand l'itinéraire est trouvé
     */
    onRouteFound(distance, time, instructions) {
        // Mettre à jour le résumé
        if (this.guidanceSummary) {
            const distanceText = distance < 1000 ? `${distance} m` : `${(distance / 1000).toFixed(1)} km`;
            const timeText = time < 60 ? `${time} min` : `${Math.floor(time / 60)}h${time % 60} min`;
            this.guidanceSummary.textContent = `${distanceText}, ${timeText}`;
        }
        
        // Afficher les instructions
        if (this.guidanceInstructions) {
            this.guidanceInstructions.innerHTML = '';
            
            if (instructions && instructions.length > 0) {
                instructions.slice(0, 3).forEach((instruction, index) => {
                    const instructionDiv = document.createElement('div');
                    instructionDiv.className = 'instruction-item';
                    
                    let icon = '';
                    let text = instruction.text || 'Continuez';
                    let distance = instruction.distance ? `${Math.round(instruction.distance)} m` : '';
                    
                    // Déterminer l'icône selon le type d'instruction
                    if (index === 0) {
                        icon = '<span class="instruction-icon start">A</span>';
                    } else if (index === instructions.length - 1) {
                        icon = '<span class="instruction-icon end">B</span>';
                    } else if (text.toLowerCase().includes('nord-est') || text.toLowerCase().includes('sud-est')) {
                        icon = '<span class="instruction-icon turn-right">↗</span>';
                    } else if (text.toLowerCase().includes('nord-ouest') || text.toLowerCase().includes('sud-ouest')) {
                        icon = '<span class="instruction-icon turn-left">↖</span>';
                    } else if (text.toLowerCase().includes('est')) {
                        icon = '<span class="instruction-icon turn-right">→</span>';
                    } else if (text.toLowerCase().includes('ouest')) {
                        icon = '<span class="instruction-icon turn-left">←</span>';
                    } else if (text.toLowerCase().includes('tout droit') || text.toLowerCase().includes('nord') || text.toLowerCase().includes('sud')) {
                        icon = '<span class="instruction-icon straight">↑</span>';
                    } else {
                        icon = '<span class="instruction-icon">•</span>';
                    }
                    
                    instructionDiv.innerHTML = `
                        ${icon}
                        <div class="instruction-content">
                            <div class="instruction-text" style="color: #333 !important;">${text}</div>
                            ${distance ? `<div class="instruction-distance">${distance}</div>` : ''}
                        </div>
                    `;
                    
                    this.guidanceInstructions.appendChild(instructionDiv);
                });
            } else {
                // Message par défaut si pas d'instructions
                this.guidanceInstructions.innerHTML = '<div class="instruction-item"><div class="instruction-text" style="color: #333 !important;">Itinéraire calculé</div></div>';
            }
        }
    }
    
    /**
     * Appelé quand le guidage s'arrête
     */
    onGuidanceStopped() {
        // Réafficher les parkings
        if (this.parkingsData) {
            if (this.userPreferences) {
                this.applyFilters();
            } else {
                // Afficher tous les parkings (y compris les fermés)
                this.mapManager.displayParkings(this.parkingsData);
            }
        }
        
        // Cacher le panneau de guidage
        if (this.guidancePanel) {
            this.guidancePanel.classList.add('hidden');
        }
        
        // Cacher le bouton de simulation
        if (this.simulateUnavailabilityContainer) {
            this.simulateUnavailabilityContainer.classList.add('hidden');
        }
        
        // Réafficher la barre de recherche
        if (this.searchBar) {
            this.searchBar.classList.remove('hidden');
        }
        
        // Afficher/masquer les boutons appropriés
        if (this.nearestParkingBtn) {
            this.nearestParkingBtn.classList.remove('hidden');
        }
        if (this.followUserCheckbox && this.followUserCheckbox.parentElement) {
            this.followUserCheckbox.parentElement.classList.add('hidden');
        }
    }
    
    /**
     * Affiche un message d'erreur
     * 
     * @param {string} message Message d'erreur
     */
    showError(message) {
        // Implémentation simple - à améliorer avec un système de notifications
        console.error('Erreur:', message);
        // Afficher une notification non-intrusive
        this.showNotification(message, 'error');
    }
    
    /**
     * Affiche un message d'erreur de connexion
     * 
     * @param {string} message Message d'erreur
     */
    showConnectionError(message) {
        console.warn('Erreur de connexion:', message);
        this.showNotification(message, 'warning');
    }
    
    /**
     * Affiche une notification
     * 
     * @param {string} message Message à afficher
     * @param {string} type Type de notification (error, warning, info, success)
     */
    showNotification(message, type = 'info') {
        // Créer un élément de notification
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 60px;
            right: 10px;
            padding: 15px 20px;
            border-radius: 5px;
            background-color: ${type === 'error' ? '#f44336' : type === 'warning' ? '#FF9800' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            font-weight: bold;
            z-index: 10001;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        // Supprimer après 5 secondes
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    /**
     * Met à jour l'indicateur de connexion
     * 
     * @param {boolean} isOnline État de la connexion
     * @param {boolean} isCached Si les données viennent du cache
     */
    updateConnectionStatus(isOnline, isCached = false) {
        const statusEl = document.getElementById('connection-status');
        const iconEl = document.getElementById('connection-status-icon');
        const textEl = document.getElementById('connection-status-text');
        
        if (!statusEl || !iconEl || !textEl) return;
        
        // Mettre à jour les classes CSS
        statusEl.className = 'connection-status ' + (isOnline 
            ? (isCached ? 'connection-status-cached' : 'connection-status-online') 
            : 'connection-status-offline');
        
        // Mettre à jour le texte
        textEl.textContent = isOnline 
            ? (isCached ? 'Données en cache' : 'En ligne')
            : 'Mode avion';
        
        // L'icône reste "●" dans le HTML, les couleurs sont gérées par CSS
    }
}

// Log immédiat pour vérifier que le fichier est chargé
console.log('=== app.js chargé ===');
console.log('Document readyState:', document.readyState);

// Initialiser l'application quand le DOM est prêt
if (document.readyState === 'loading') {
    console.log('DOM en cours de chargement, attente de DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOMContentLoaded déclenché, création de ParkingApp...');
        new ParkingApp();
    });
} else {
    console.log('DOM déjà chargé, création immédiate de ParkingApp...');
    new ParkingApp();
}