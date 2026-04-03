/**
 * Module API Client
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce module a une seule responsabilité : gérer toutes les communications avec l'API
 * 
 * Principe : Separation of Concerns - Toute la logique de communication HTTP est isolée ici
 */

// Log immédiat pour vérifier que le fichier est chargé
console.log('=== api_client.js chargé ===');

/**
 * Classe responsable de la communication avec l'API backend
 * Gère la robustesse : mode avion, cache local, gestion d'erreurs
 */
class ApiClient {
    /**
     * Base URL de l'API (relative au dossier racine)
     */
    constructor() {
        this.baseUrl = 'api';
        this.cachePrefix = 'parking_app_cache_';
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes en millisecondes
        this.isOnline = navigator.onLine;
        
        // Écouter les changements de connexion
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.onConnectionChange(true);
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.onConnectionChange(false);
        });
    }
    
    /**
     * Gère les changements de connexion
     * 
     * @param {boolean} isOnline État de la connexion
     */
    onConnectionChange(isOnline) {
        const event = new CustomEvent('connectionChange', { 
            detail: { isOnline } 
        });
        window.dispatchEvent(event);
    }
    
    /**
     * Vérifie si on est en mode avion / hors ligne
     * 
     * @returns {boolean} True si hors ligne
     */
    isOffline() {
        return !this.isOnline || !navigator.onLine;
    }
    
    /**
     * Gère le cache local (localStorage)
     * 
     * @param {string} key Clé du cache
     * @param {any} data Données à mettre en cache
     */
    setCache(key, data) {
        try {
            const cacheData = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(this.cachePrefix + key, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Impossible de mettre en cache:', error);
        }
    }
    
    /**
     * Récupère les données du cache local
     * 
     * @param {string} key Clé du cache
     * @returns {any|null} Données en cache ou null si expiré/inexistant
     */
    getCache(key) {
        try {
            const cached = localStorage.getItem(this.cachePrefix + key);
            if (!cached) return null;
            
            const cacheData = JSON.parse(cached);
            const age = Date.now() - cacheData.timestamp;
            
            if (age > this.cacheExpiry) {
                localStorage.removeItem(this.cachePrefix + key);
                return null;
            }
            
            return cacheData.data;
        } catch (error) {
            console.warn('Erreur lors de la récupération du cache:', error);
            return null;
        }
    }
    
    /**
     * Effectue une requête fetch avec gestion d'erreurs et cache
     * 
     * @param {string} endpoint Endpoint de l'API
     * @param {Object} options Options de la requête fetch
     * @param {boolean} useCache Si true, utilise le cache en cas d'erreur
     * @returns {Promise<any>} Données JSON décodées
     * @throws {Error} Si la requête échoue et pas de cache disponible
     */
    async request(endpoint, options = {}, useCache = false) {
        const url = `${this.baseUrl}/${endpoint}`;
        const cacheKey = endpoint.replace(/[?&]/g, '_');
        
        // Vérifier le mode avion
        if (this.isOffline()) {
            console.warn('Mode avion détecté, tentative de récupération depuis le cache...');
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('Données récupérées depuis le cache (mode avion)');
                return cached;
            }
            throw new Error('Mode avion activé. Aucune donnée en cache disponible.');
        }
        
        // Créer un AbortController pour le timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                
                // Si erreur serveur et cache disponible, utiliser le cache
                if (useCache && response.status >= 500) {
                    const cached = this.getCache(cacheKey);
                    if (cached) {
                        console.warn('Erreur serveur, utilisation du cache');
                        return cached;
                    }
                }
                
                throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Mettre en cache si succès
            if (useCache) {
                this.setCache(cacheKey, data);
            }
            
            return data;
            
        } catch (error) {
            clearTimeout(timeoutId);
            console.error(`Erreur API [${endpoint}]:`, error);
            
            // Si erreur réseau et cache disponible, utiliser le cache
            if (useCache && (error.name === 'TypeError' || error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
                const cached = this.getCache(cacheKey);
                if (cached) {
                    console.warn('Erreur réseau, utilisation du cache:', error.message);
                    return cached;
                }
            }
            
            // Améliorer le message d'erreur
            if (error.name === 'AbortError') {
                throw new Error('Délai d\'attente dépassé. Vérifiez votre connexion internet.');
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                throw new Error('Impossible de se connecter au serveur. Vérifiez votre connexion internet.');
            }
            
            throw error;
        }
    }
    
    /**
     * Récupère tous les parkings pour une ville donnée
     * Utilise le cache en cas d'erreur réseau ou serveur
     * 
     * @param {string} city Code de la ville (ex: 'metz', 'london')
     * @returns {Promise<Object>} Données des parkings au format standardisé
     */
    async getParkings(city = 'metz') {
        const encodedCity = encodeURIComponent(city);
        return this.request(`getParkings.php?city=${encodedCity}`, {}, true);
    }
    
    /**
     * Recherche des parkings par terme dans une ville
     * Utilise le cache en cas d'erreur réseau ou serveur
     * 
     * @param {string} query Terme de recherche
     * @param {string} city Code de la ville (ex: 'metz', 'london')
     * @returns {Promise<Object>} Données des parkings filtrés
     */
    async searchParkings(query, city = 'metz') {
        const encodedQuery = encodeURIComponent(query);
        const encodedCity = encodeURIComponent(city);
        // Pour les recherches, on ne met pas en cache (trop spécifique)
        return this.request(`getParkings.php?city=${encodedCity}&q=${encodedQuery}`, {}, false);
    }
    
    /**
     * Calcule un itinéraire entre deux points
     * 
     * @param {number} lat1 Latitude départ
     * @param {number} lng1 Longitude départ
     * @param {number} lat2 Latitude arrivée
     * @param {number} lng2 Longitude arrivée
     * @returns {Promise<Object>} Données de l'itinéraire OSRM
     */
    async getRoute(lat1, lng1, lat2, lng2) {
        return this.request(
            `getRoute.php?lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}`
        );
    }
    
    /**
     * Récupère les préférences d'un utilisateur (ancienne méthode, dépréciée)
     * 
     * @param {number} userId ID de l'utilisateur
     * @returns {Promise<Object>} Préférences utilisateur
     * @deprecated Utiliser getUserProfile() à la place
     */
    async getUserPreferences(userId) {
        return this.request(`getUserPreferences.php?user_id=${userId}`);
    }
    
    /**
     * Récupère le profil de l'utilisateur connecté (utilise la session)
     * 
     * @returns {Promise<Object>} Profil utilisateur complet
     */
    async getUserProfile() {
        return this.request('getUserProfile.php');
    }
    
    /**
     * Récupère les favoris de l'utilisateur connecté
     * 
     * @returns {Promise<Object>} Liste des favoris
     */
    async getFavorites() {
        console.log('ApiClient.getFavorites: Appel API...');
        try {
            const result = await this.request('getFavorites.php');
            console.log('ApiClient.getFavorites: Résultat:', result);
            return result;
        } catch (error) {
            console.error('ApiClient.getFavorites: Erreur:', error);
            throw error;
        }
    }
    
    /**
     * Ajoute un parking aux favoris
     * 
     * @param {string} parkingId ID du parking
     * @param {string|null} customName Nom personnalisé (optionnel)
     * @returns {Promise<Object>} Résultat de l'ajout
     */
    async addFavorite(parkingId, customName = null) {
        return this.request('addFavorite.php', {
            method: 'POST',
            body: JSON.stringify({
                parking_id: parkingId,
                custom_name: customName
            })
        });
    }
    
    /**
     * Supprime un favori
     * 
     * @param {number} favoriteId ID du favori
     * @returns {Promise<Object>} Résultat de la suppression
     */
    async removeFavorite(favoriteId) {
        return this.request('removeFavorite.php', {
            method: 'POST',
            body: JSON.stringify({
                favorite_id: favoriteId
            })
        });
    }
    
    /**
     * Vérifie si un parking est en favori
     * 
     * @param {string} parkingId ID du parking
     * @returns {Promise<Object>} Statut du favori
     */
    async checkFavorite(parkingId) {
        const encodedId = encodeURIComponent(parkingId);
        return this.request(`checkFavorite.php?parking_id=${encodedId}`);
    }
    
    /**
     * Récupère l'historique de recherche
     * 
     * @returns {Promise<Object>} Liste de l'historique
     */
    async getSearchHistory() {
        console.log('ApiClient.getSearchHistory: Appel API...');
        try {
            const result = await this.request('getSearchHistory.php');
            console.log('ApiClient.getSearchHistory: Résultat:', result);
            return result;
        } catch (error) {
            console.error('ApiClient.getSearchHistory: Erreur:', error);
            throw error;
        }
    }
    
    /**
     * Ajoute une recherche à l'historique
     * 
     * @param {string} parkingId ID du parking recherché
     * @returns {Promise<Object>} Résultat de l'ajout
     */
    async addToHistory(parkingId) {
        return this.request('addToHistory.php', {
            method: 'POST',
            body: JSON.stringify({
                parking_id: parkingId
            })
        });
    }
}

// Export pour utilisation dans d'autres modules
export default ApiClient;
