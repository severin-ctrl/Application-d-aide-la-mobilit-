/**
 * Module de gestion de la carte Leaflet
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce module a une seule responsabilité : gérer l'affichage et les interactions de la carte
 * 
 * Principe : Separation of Concerns - Toute la logique Leaflet est isolée ici
 */

/**
 * Classe responsable de la gestion de la carte Leaflet
 */
// Log immédiat pour vérifier que le fichier est chargé
console.log('=== map.js chargé ===');

class MapManager {
    /**
     * @param {string} containerId ID de l'élément HTML qui contiendra la carte
     */
    constructor(containerId = 'map') {
        this.containerId = containerId;
        this.map = null;
        this.userMarker = null;
        this.userPosition = null;
        this.parkingMarkers = [];
        this.routeControl = null;
        this.isGuidanceActive = false;
        this.followUser = true;
        this.hasUserInteracted = false; // Flag pour savoir si l'utilisateur a interagi avec la carte
        this.initialLoadDone = false; // Flag pour le premier chargement
        this.filterRealParkings = false; // Filtrer uniquement les parkings « sûrs »
        this.isUserLoggedIn = false; // État de connexion de l'utilisateur
        this.watchPositionId = null; // ID du watchPosition pour pouvoir l'arrêter
        this.lastRouteUpdate = null; // Timestamp de la dernière mise à jour de l'itinéraire
        this.routeUpdateInterval = 30000; // Mettre à jour l'itinéraire toutes les 30 secondes
        
        // Configuration de la carte centrée sur Metz
        this.defaultCenter = [49.1193, 6.1757];
        this.defaultZoom = 13;
    }
    
    /**
     * Définit l'état de connexion de l'utilisateur
     * 
     * @param {boolean} isLoggedIn True si l'utilisateur est connecté
     */
    setUserLoggedIn(isLoggedIn) {
        this.isUserLoggedIn = isLoggedIn;
    }
    
    /**
     * Initialise la carte Leaflet
     */
    init() {
        // Créer la carte
        this.map = L.map(this.containerId).setView(this.defaultCenter, this.defaultZoom);
        
        // Ajouter les tuiles OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
        
        // Détecter les interactions utilisateur (zoom, déplacement)
        this.map.on('zoomend', () => {
            this.hasUserInteracted = true;
        });
        
        this.map.on('moveend', () => {
            if (this.map.getZoom() !== this.defaultZoom) {
                this.hasUserInteracted = true;
            }
        });
        
        // Centrer sur la position de l'utilisateur si disponible
        this.requestUserLocation();
    }
    
    /**
     * Demande la géolocalisation de l'utilisateur
     */
    requestUserLocation() {
        if (!navigator.geolocation) {
            console.warn('Géolocalisation non disponible');
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.updateUserPosition(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                console.warn('Erreur de géolocalisation:', error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
        
        // Surveiller la position en continu (temps réel)
        // watchPosition se déclenche automatiquement à chaque changement de position
        this.watchPositionId = navigator.geolocation.watchPosition(
            (position) => {
                const newLat = position.coords.latitude;
                const newLng = position.coords.longitude;
                
                // Vérifier si la position a vraiment changé (éviter les mises à jour inutiles)
                if (this.userPosition) {
                    const distance = this.calculateDistance(
                        this.userPosition[0], 
                        this.userPosition[1], 
                        newLat, 
                        newLng
                    );
                    // Ne mettre à jour que si le déplacement est significatif (> 10 mètres)
                    if (distance < 10) {
                        return; // Position trop proche, pas besoin de mettre à jour
                    }
                }
                
                this.updateUserPosition(newLat, newLng);
                
                // Si le guidage est actif, mettre à jour l'itinéraire en temps réel
                if (this.isGuidanceActive && this.destinationMarker) {
                    this.updateRouteInRealTime(newLat, newLng);
                }
            },
            (error) => {
                console.warn('Erreur de suivi de position:', error.message);
            },
            {
                enableHighAccuracy: true, // Utiliser le GPS pour une précision maximale
                timeout: 10000,
                maximumAge: 5000 // Accepter une position jusqu'à 5 secondes
            }
        );
    }
    
    /**
     * Simule une position utilisateur (pour démonstration)
     * 
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     */
    simulateUserPosition(lat, lng) {
        // Arrêter le suivi de position réel si actif
        if (this.watchPositionId !== null) {
            navigator.geolocation.clearWatch(this.watchPositionId);
            this.watchPositionId = null;
            console.log('Suivi de position réel arrêté pour simulation');
        }
        
        // Mettre à jour la position simulée
        this.updateUserPosition(lat, lng);
        
        // Centrer la carte sur la position simulée
        if (this.map) {
            this.map.setView([lat, lng], 15, { animate: true });
        }
        
        console.log(`Position simulée: ${lat}, ${lng}`);
    }
    
    /**
     * Reprend le suivi de position réel (arrête la simulation)
     */
    resumeRealLocation() {
        if (this.watchPositionId === null) {
            this.requestUserLocation();
            console.log('Suivi de position réel repris');
        }
    }
    
    /**
     * Met à jour la position de l'utilisateur sur la carte
     * 
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     */
    updateUserPosition(lat, lng) {
        this.userPosition = [lat, lng];
        
        if (this.userMarker) {
            this.userMarker.setLatLng(this.userPosition);
        } else {
            // Créer le marqueur utilisateur avec icône bonhomme SVG
            const userIcon = L.divIcon({
                className: 'user-marker-icon',
                html: `
                    <div style="
                        width: 32px;
                        height: 32px;
                        background: #8A0808;
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        border: 3px solid white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        position: relative;
                    ">
                        <div style="
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%) rotate(45deg);
                            color: white;
                            font-size: 18px;
                            font-weight: bold;
                            line-height: 1;
                        ">👤</div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 28],
                popupAnchor: [0, -28]
            });
            
            this.userMarker = L.marker(this.userPosition, { icon: userIcon })
                .addTo(this.map)
                .bindPopup('Votre position');
        }
        
        // Suivre l'utilisateur si le mode guidage est actif
        if (this.isGuidanceActive && this.followUser) {
            this.map.setView(this.userPosition, 17, { animate: true });
        } else if (!this.userMarker) {
            // Centrer sur la position au premier chargement
            this.map.setView(this.userPosition, 15);
        }
    }
    
    /**
     * Détermine la couleur du marqueur selon la disponibilité
     * 
     * @param {Object} properties Propriétés du parking
     * @returns {string} Couleur hexadécimale
     */
    getParkingColor(properties) {
        const disponibles = properties.place_libre;
        const total = properties.place_total;
        
        if (disponibles === null || total === null) {
            return '#808080'; // Gris si pas d'info
        }
        
        const pourcentage = (disponibles / total) * 100;
        
        if (pourcentage >= 50) {
            return '#28a745'; // Vert
        } else if (pourcentage >= 20) {
            return '#ffc107'; // Orange
        } else {
            return '#dc3545'; // Rouge
        }
    }
    
    /**
     * Vérifie si un parking est valide (pas une place de rue)
     * 
     * @param {Object} properties Propriétés du parking
     * @returns {boolean} True si c'est un vrai parking
     */
    isValidParking(properties) {
        if (!properties) {
            return false;
        }
        
        const nom = (properties.lib || properties.voie || '').toLowerCase();
        const disponibles = properties.place_libre;
        const total = properties.place_total;
        const typ = (properties.typ || '').toLowerCase();
        
        // Exclure les parkings avec "UNDEFINED" dans le nom
        if (nom.includes('undefined')) {
            return false;
        }
        
        // Exclure les parkings où les places sont undefined, null, ou la chaîne "undefined"
        const disponiblesStr = disponibles !== null && disponibles !== undefined 
            ? String(disponibles).toLowerCase() 
            : '';
        const totalStr = total !== null && total !== undefined 
            ? String(total).toLowerCase() 
            : '';
        
        if (disponiblesStr.includes('undefined') || totalStr.includes('undefined')) {
            return false;
        }
        
        // Exclure les parkings où les deux valeurs sont null/undefined (pas d'info disponible)
        if ((disponibles === null || disponibles === undefined) && 
            (total === null || total === undefined)) {
            // Si c'est un parking avec un nom complet (lib), on l'inclut quand même
            // Sinon, c'est probablement une place de rue
            if (!properties.lib) {
                return false;
            }
        }
        
        // Exclure les places de rue (typiquement ceux sans nom complet ou avec très peu de places)
        // Les vrais parkings ont généralement un nom complet et plusieurs places
        if (!properties.lib && properties.voie) {
            // Si c'est juste une voie sans nom de parking, probablement une place de rue
            if (total !== null && total !== undefined && total <= 5) {
                return false;
            }
            // Si pas d'info sur le total et pas de nom complet, exclure
            if ((total === null || total === undefined) && !properties.lib) {
                return false;
            }
        }
        
        // Inclure les parkings avec un nom complet (lib) ou ceux avec beaucoup de places
        if (properties.lib || (total !== null && total !== undefined && total > 5)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Nettoie et complète le nom d'un parking
     * 
     * @param {Object} properties Propriétés du parking
     * @returns {string} Nom nettoyé
     */
    cleanParkingName(properties) {
        let nom = properties.lib || properties.voie || 'Parking';
        
        // Si le nom est tronqué (commence par une parenthèse ou se termine par une parenthèse)
        // Essayer de trouver le nom complet dans d'autres propriétés
        if (nom.includes('(') && !nom.includes(')')) {
            // Nom tronqué, essayer de compléter
            const voie = properties.voie || '';
            const quartier = properties.quartier || '';
            
            if (voie && !nom.includes(voie)) {
                nom = voie + ' ' + nom;
            }
        }
        
        // Nettoyer les noms incomplets
        if (nom.startsWith('(') || nom.endsWith(')')) {
            // Essayer de reconstruire avec les autres propriétés
            if (properties.voie && properties.voie !== nom) {
                nom = properties.voie + ' ' + nom;
            }
        }
        
        return nom.trim();
    }
    
    /**
     * Vérifie si un parking est un "vrai" parking (pas une place de rue) - format standardisé
     * 
     * @param {Object} parking Parking au format standardisé
     * @returns {boolean} True si c'est un vrai parking
     */
    isValidParkingStandardized(parking) {
        // Un parking est valide si :
        // 1. Il a un nom complet (pas juste une voie)
        const name = (parking.name || '').toLowerCase();
        
        // Exclure les parkings avec "undefined" dans le nom
        if (name.includes('undefined')) {
            return false;
        }
        
        // 2. Il a des informations sur les places (total ou disponibles)
        const total = parking.total_places;
        const available = parking.available_places;
        
        // Vérifier si on a des infos sur les places
        const hasPlaceInfo = (total !== null && total !== undefined) || 
                             (available !== null && available !== undefined);
        
        // Si on a le total et qu'il est > 5, c'est probablement un vrai parking
        if (total !== null && total !== undefined && total > 5) {
            return true;
        }
        
        // Si on a le total et les disponibles, c'est un vrai parking
        if (total !== null && available !== null) {
            return true;
        }
        
        // Si on a juste le total (même petit), c'est un vrai parking
        if (total !== null && total > 0) {
            return true;
        }
        
        // Si le nom est complet et qu'on a des infos sur les places, c'est un vrai parking
        // Les vrais parkings ont généralement un nom significatif
        if (hasPlaceInfo && name && name.length > 10 && 
            !name.includes('rue') && !name.includes('avenue') && !name.includes('boulevard')) {
            return true;
        }
        
        // Si le nom contient des mots-clés de vrais parkings
        const parkingKeywords = ['parking', 'p+r', 'park', 'stationnement', 'république', 'saint-jacques', 'marché'];
        for (const keyword of parkingKeywords) {
            if (name.includes(keyword)) {
                return true;
            }
        }
        
        // Si on a des infos additionnelles qui indiquent un vrai parking
        if (parking.additional_info) {
            const typ = (parking.additional_info.typ || '').toLowerCase();
            // Les vrais parkings ont souvent un type spécifique
            if (typ && typ !== 'rue' && typ !== 'voie') {
                return true;
            }
        }
        
        // Sinon, c'est probablement une place de rue
        return false;
    }
    
    /**
     * Crée un marqueur pour un parking (format standardisé)
     * 
     * @param {Object} parking Parking au format standardisé
     * @returns {L.Marker|null} Marqueur Leaflet ou null si parking invalide
     */
    createParkingMarker(parking) {
        const lat = parking.lat;
        const lng = parking.lng;
        
        if (lat === null || lng === null) {
            return null;
        }
        
        // Si le filtre "parkings de rue" est actif, vérifier si c'est un vrai parking
        if (this.filterRealParkings) {
            // Pour le format standardisé
            if (!this.isValidParkingStandardized(parking)) {
                return null; // Exclure les parkings de rue
            }
            // Pour le format GeoJSON ancien (rétrocompatibilité)
            if (parking.properties && !this.isValidParking(parking.properties)) {
                return null;
            }
        }
        
        const nom = parking.name || 'Parking';
        const disponibles = parking.available_places;
        const total = parking.total_places;
        const cout = parking.cost || 'Non spécifié';
        const status = parking.status || 'UNKNOWN';
        
        // Créer une icône colorée selon la disponibilité
        const color = this.getParkingColorStandardized(parking);
        
        // Ajouter des badges pour PMR et électrique
        let badges = '';
        if (parking.is_pmr) {
            badges += '<span style="position: absolute; top: -4px; right: -4px; background: #007bff; color: white; border-radius: 50%; width: 12px; height: 12px; font-size: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid white;">♿</span>';
        }
        if (parking.has_electric_charging) {
            badges += '<span style="position: absolute; bottom: -4px; right: -4px; background: #28a745; color: white; border-radius: 50%; width: 12px; height: 12px; font-size: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid white;">🔌</span>';
        }
        
        const icon = L.divIcon({
            className: 'parking-marker',
            html: `<div style="position: relative; background: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${badges}</div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        
        // Construire le contenu du popup
        // Étoile favori (sera mise à jour dynamiquement)
        const favoriteStarId = `favorite-star-${parking.id}`;
        const favoriteStarClass = this.isUserLoggedIn ? 'favorite-star-clickable' : 'favorite-star-hidden';
        const favoriteStarIcon = '☆'; // Vide par défaut, sera mis à jour
        
        let popupContent = `<div class="parking-popup">
            <h3>
                ${nom}
                <span id="${favoriteStarId}" class="${favoriteStarClass}" data-parking-id="${parking.id}" data-is-favorite="false" style="cursor: pointer; margin-left: 8px; font-size: 20px; user-select: none;">${favoriteStarIcon}</span>
            </h3>`;
        
        if (disponibles !== null && total !== null) {
            popupContent += `<p><strong>Disponibilité:</strong> ${disponibles}/${total} places</p>`;
        } else if (total !== null) {
            popupContent += `<p><strong>Total:</strong> ${total} places</p>`;
        } else {
            popupContent += `<p><em>Informations de disponibilité non disponibles</em></p>`;
        }
        
        // Affichage PMR avec nombre de places si disponible
        if (parking.is_pmr) {
            if (parking.pmr_places !== null && parking.pmr_places !== undefined) {
                popupContent += `<p><strong>♿ Accessible PMR</strong> (${parking.pmr_places} place${parking.pmr_places > 1 ? 's' : ''} réservée${parking.pmr_places > 1 ? 's' : ''})</p>`;
            } else {
                popupContent += `<p><strong>♿ Accessible PMR</strong></p>`;
            }
        }
        
        // Affichage bornes électriques avec nombre si disponible
        if (parking.has_electric_charging) {
            if (parking.electric_charging_points !== null && parking.electric_charging_points !== undefined) {
                popupContent += `<p><strong>🔌 Bornes de recharge</strong> (${parking.electric_charging_points} borne${parking.electric_charging_points > 1 ? 's' : ''})</p>`;
            } else {
                popupContent += `<p><strong>🔌 Bornes de recharge</strong></p>`;
            }
        }
        
        popupContent += `<p><strong>Coût:</strong> ${cout}</p>
            <p><strong>Statut:</strong> ${this.getStatusLabel(status)}</p>
            <div class="popup-actions">
                <button class="btn-guidance" data-lat="${lat}" data-lng="${lng}" data-name="${nom.replace(/"/g, '&quot;')}" data-status="${status}" ${status === 'CLOSED' ? 'disabled' : ''}>
                    ${status === 'CLOSED' ? 'Parking fermé' : 'M\'y guider'}
                </button>
            </div>
        </div>`;
        
        const marker = L.marker([lat, lng], { icon })
            .bindPopup(popupContent)
            .addTo(this.map);
        
        // Stocker les données du parking dans le marqueur
        marker.parkingData = parking;
        
        // Gérer les clics sur l'étoile favori après que le popup soit créé
        marker.on('popupopen', () => {
            const popupElement = marker.getPopup().getElement();
            if (popupElement) {
                const favoriteStar = popupElement.querySelector(`#favorite-star-${parking.id}`);
                if (favoriteStar && this.isUserLoggedIn) {
                    // Afficher l'étoile
                    favoriteStar.classList.remove('favorite-star-hidden');
                    favoriteStar.classList.add('favorite-star-clickable');
                    
                    // Déclencher un événement pour que app.js mette à jour l'état de l'étoile
                    const event = new CustomEvent('popupOpened', {
                        detail: {
                            parkingId: parking.id,
                            starElement: favoriteStar
                        }
                    });
                    document.dispatchEvent(event);
                    
                    // Gérer le clic sur l'étoile
                    favoriteStar.onclick = (e) => {
                        e.stopPropagation();
                        const isFavorite = favoriteStar.getAttribute('data-is-favorite') === 'true';
                        const parkingId = favoriteStar.getAttribute('data-parking-id');
                        
                        // Déclencher un événement personnalisé pour que app.js puisse le gérer
                        const toggleEvent = new CustomEvent('favoriteToggle', {
                            detail: {
                                parkingId: parkingId,
                                isFavorite: isFavorite,
                                favoriteId: favoriteStar.getAttribute('data-favorite-id'),
                                starElement: favoriteStar
                            }
                        });
                        document.dispatchEvent(toggleEvent);
                    };
                } else if (favoriteStar) {
                    // Utilisateur non connecté, masquer l'étoile
                    favoriteStar.classList.add('favorite-star-hidden');
                    favoriteStar.classList.remove('favorite-star-clickable');
                }
            }
        });
        
        return marker;
    }
    
    /**
     * Détermine la couleur du marqueur selon la disponibilité (format standardisé)
     * 
     * @param {Object} parking Parking au format standardisé
     * @returns {string} Couleur hexadécimale
     */
    getParkingColorStandardized(parking) {
        const disponibles = parking.available_places;
        const total = parking.total_places;
        const status = parking.status;
        
        // Si le statut est CLOSED, retourner rouge
        if (status === 'CLOSED') {
            return '#dc3545';
        }
        
        // Si pas d'info, retourner gris
        if (disponibles === null || total === null) {
            return '#808080';
        }
        
        const pourcentage = (disponibles / total) * 100;
        
        if (pourcentage >= 50) {
            return '#28a745'; // Vert
        } else if (pourcentage >= 20) {
            return '#ffc107'; // Orange
        } else {
            return '#dc3545'; // Rouge
        }
    }
    
    /**
     * Retourne le libellé du statut
     * 
     * @param {string} status Statut du parking
     * @returns {string} Libellé en français
     */
    getStatusLabel(status) {
        const labels = {
            'OPEN': 'Ouvert',
            'CLOSED': 'Fermé',
            'UNKNOWN': 'Inconnu'
        };
        return labels[status] || status;
    }
    
    /**
     * Affiche les parkings sur la carte (format standardisé)
     * 
     * @param {Object} data Données des parkings au format standardisé {city, parkings, count}
     * @param {boolean} forceFitBounds Force l'ajustement de la vue (pour recherche)
     */
    displayParkings(data, forceFitBounds = false) {
        // Supprimer les marqueurs existants
        this.clearParkingMarkers();
        
        // Déclencher un événement pour que app.js puisse mettre à jour les boutons favori
        setTimeout(() => {
            const event = new CustomEvent('parkingsDisplayed');
            document.dispatchEvent(event);
        }, 500);
        
        // Gérer le nouveau format standardisé
        let parkings = [];
        if (data && Array.isArray(data.parkings)) {
            // Format nouveau : {city, parkings: [...], count}
            parkings = data.parkings;
        } else if (data && Array.isArray(data)) {
            // Format direct : tableau de parkings
            parkings = data;
        } else if (data && data.features && Array.isArray(data.features)) {
            // Format GeoJSON ancien (rétrocompatibilité)
            parkings = data.features.map(feature => ({
                id: feature.id || feature.properties?.id,
                name: this.cleanParkingName(feature.properties || {}),
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
            return;
        }
        
        // Créer un marqueur pour chaque parking
        parkings.forEach(parking => {
            const marker = this.createParkingMarker(parking);
            if (marker !== null) {
                this.parkingMarkers.push(marker);
            }
        });
        
        // Ajuster la vue seulement :
        // - Si pas de guidage actif
        // - Si c'est le premier chargement OU si l'utilisateur n'a pas interagi OU si forceFitBounds est true
        if (!this.isGuidanceActive && this.parkingMarkers.length > 0) {
            if (!this.initialLoadDone || !this.hasUserInteracted || forceFitBounds) {
                const group = new L.featureGroup(this.parkingMarkers);
                this.map.fitBounds(group.getBounds().pad(0.1));
                this.initialLoadDone = true;
            }
        }
    }
    
    /**
     * Recentre la carte sur une ville
     * 
     * @param {string} cityCode Code de la ville
     * @param {Object} citiesConfig Configuration des villes
     */
    centerOnCity(cityCode, citiesConfig) {
        const city = citiesConfig[cityCode];
        if (city && city.center) {
            this.map.setView([city.center.lat, city.center.lng], city.zoom || 13, { animate: true });
        }
    }
    
    /**
     * Active/désactive le filtre pour n'afficher que les vrais parkings
     * @param {boolean} flag
     */
    setFilterRealParkings(flag) {
        this.filterRealParkings = flag;
    }
    
    /**
     * Supprime tous les marqueurs de parkings
     */
    clearParkingMarkers() {
        this.parkingMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.parkingMarkers = [];
    }
    
    /**
     * Démarre le guidage vers une destination
     * 
     * @param {number} lat Latitude de destination
     * @param {number} lng Longitude de destination
     * @param {string} destinationName Nom de la destination (optionnel)
     */
    async startGuidance(lat, lng, destinationName = null) {
        if (!this.userPosition) {
            throw new Error('Position utilisateur non disponible');
        }
        
        this.isGuidanceActive = true;
        this.destinationName = destinationName || 'Destination';
        
        // Supprimer l'ancien marqueur de destination s'il existe
        if (this.destinationMarker) {
            this.map.removeLayer(this.destinationMarker);
        }
        
        // Créer le marqueur de destination
        const destinationIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [0, -41]
        });
        
        this.destinationMarker = L.marker([lat, lng], { icon: destinationIcon })
            .addTo(this.map)
            .bindPopup(this.destinationName);
        
        // Supprimer l'ancien contrôle de routage s'il existe
        if (this.routeControl) {
            this.map.removeControl(this.routeControl);
        }
        
        // Créer le contrôle de routage Leaflet Routing Machine
        this.routeControl = L.Routing.control({
            waypoints: [
                L.latLng(this.userPosition[0], this.userPosition[1]),
                L.latLng(lat, lng)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            draggableWaypoints: false,
            createMarker: () => null, // Ne pas créer de marqueurs (on les gère nous-mêmes)
            lineOptions: {
                styles: [
                    {
                        color: '#8A0808',
                        weight: 5,
                        opacity: 0.7
                    }
                ]
            },
            // Masquer le panneau par défaut de Leaflet Routing Machine
            show: false,
            // Utiliser OSRM comme service de routage
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1'
            })
        }).addTo(this.map);
        
        // Écouter les événements de routage
        this.routeControl.on('routesfound', (e) => {
            const routes = e.routes;
            if (routes && routes.length > 0) {
                const route = routes[0];
                const distance = Math.round(route.summary.totalDistance);
                const time = Math.round(route.summary.totalTime / 60); // en minutes
                
                // Extraire les instructions depuis la route
                const instructions = [];
                
                // Leaflet Routing Machine fournit les instructions dans route.instructions
                if (route.instructions && route.instructions.length > 0) {
                    route.instructions.forEach((instruction, index) => {
                        instructions.push({
                            text: instruction.text || 'Continuez',
                            distance: instruction.distance ? Math.round(instruction.distance) : 0
                        });
                    });
                } else if (route.coordinates && route.coordinates.length > 1) {
                    // Fallback : créer des instructions basiques depuis les segments
                    const segments = Math.min(route.coordinates.length - 1, 5);
                    for (let i = 0; i < segments; i++) {
                        const segmentDistance = this.calculateDistance(
                            route.coordinates[i].lat,
                            route.coordinates[i].lng,
                            route.coordinates[i + 1].lat,
                            route.coordinates[i + 1].lng
                        );
                        
                        let text = '';
                        if (i === 0) {
                            text = 'Départ';
                        } else if (i === segments - 1) {
                            text = 'Arrivée à destination';
                        } else {
                            // Calculer la direction
                            const bearing = this.calculateBearing(
                                route.coordinates[i].lat,
                                route.coordinates[i].lng,
                                route.coordinates[i + 1].lat,
                                route.coordinates[i + 1].lng
                            );
                            text = this.getDirectionText(bearing);
                        }
                        
                        instructions.push({
                            text: text,
                            distance: Math.round(segmentDistance)
                        });
                    }
                }
                
                // Émettre un événement avec les informations de l'itinéraire
                this.map.fire('guidance:routefound', {
                    route: route,
                    distance: distance,
                    time: time,
                    instructions: instructions
                });
            }
        });
        
        // Centrer sur la position utilisateur
        this.map.setView(this.userPosition, 17);
        
        // Émettre un événement personnalisé
        this.map.fire('guidance:started', { lat, lng, destinationName: this.destinationName });
    }
    
    /**
     * Arrête le guidage
     */
    stopGuidance() {
        this.isGuidanceActive = false;
        this.lastRouteUpdate = null;
        
        if (this.routeControl) {
            this.map.removeControl(this.routeControl);
            this.routeControl = null;
        }
        
        // Supprimer le marqueur de destination
        if (this.destinationMarker) {
            this.map.removeLayer(this.destinationMarker);
            this.destinationMarker = null;
        }
        
        this.destinationName = null;
        
        // Émettre un événement personnalisé
        this.map.fire('guidance:stopped');
    }
    
    /**
     * Met à jour l'itinéraire en temps réel quand l'utilisateur bouge
     * 
     * @param {number} lat Nouvelle latitude de l'utilisateur
     * @param {number} lng Nouvelle longitude de l'utilisateur
     */
    updateRouteInRealTime(lat, lng) {
        if (!this.destinationMarker || !this.routeControl) {
            return;
        }
        
        // Vérifier si on est en mode avion (pas de connexion internet)
        if (!navigator.onLine) {
            console.warn('Mode avion détecté : impossible de mettre à jour l\'itinéraire');
            // L'itinéraire reste affiché mais ne se met pas à jour
            return;
        }
        
        // Éviter de mettre à jour trop souvent (limiter à toutes les 30 secondes)
        const now = Date.now();
        if (this.lastRouteUpdate && (now - this.lastRouteUpdate) < this.routeUpdateInterval) {
            return;
        }
        
        this.lastRouteUpdate = now;
        
        // Obtenir la position de destination
        const destLatLng = this.destinationMarker.getLatLng();
        
        // Mettre à jour les waypoints du routage
        this.routeControl.setWaypoints([
            L.latLng(lat, lng),
            destLatLng
        ]);
        
        console.log('Itinéraire mis à jour en temps réel (position utilisateur changée)');
    }
    
    /**
     * Arrête le suivi de la position (pour économiser la batterie si nécessaire)
     */
    stopWatchingPosition() {
        if (this.watchPositionId !== null) {
            navigator.geolocation.clearWatch(this.watchPositionId);
            this.watchPositionId = null;
            console.log('Suivi de position arrêté');
        }
    }
    
    /**
     * Redémarre le suivi de la position
     */
    restartWatchingPosition() {
        if (this.watchPositionId === null) {
            this.requestUserLocation();
            console.log('Suivi de position redémarré');
        }
    }
    
    /**
     * Active/désactive le suivi de l'utilisateur
     * 
     * @param {boolean} follow True pour suivre, false sinon
     */
    setFollowUser(follow) {
        this.followUser = follow;
        if (follow && this.userPosition) {
            this.map.setView(this.userPosition, 17, { animate: true });
        }
    }
    
    /**
     * Trouve le parking le plus proche d'un point
     * 
     * @param {number} lat Latitude
     * @param {number} lng Longitude
     * @returns {Object|null} Feature du parking le plus proche ou null
     */
    findNearestParking(lat, lng) {
        if (this.parkingMarkers.length === 0) {
            return null;
        }
        
        let nearest = null;
        let minDistance = Infinity;
        
        this.parkingMarkers.forEach(marker => {
            const parkingData = marker.parkingData;
            if (!parkingData) {
                return;
            }
            
            // Si le filtre est actif, ignorer les parkings de rue (uniquement pour format GeoJSON)
            if (this.filterRealParkings && parkingData.properties && !this.isValidParking(parkingData.properties)) {
                return;
            }
            
            let markerLat, markerLng;
            
            // Gérer le nouveau format standardisé
            if (parkingData.lat !== undefined && parkingData.lng !== undefined) {
                markerLat = parkingData.lat;
                markerLng = parkingData.lng;
            } else {
                // Format GeoJSON ancien (rétrocompatibilité)
                const markerLatLng = marker.getLatLng();
                markerLat = markerLatLng.lat;
                markerLng = markerLatLng.lng;
            }
            
            if (markerLat === null || markerLng === null) {
                return;
            }
            
            const distance = this.calculateDistance(lat, lng, markerLat, markerLng);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearest = parkingData;
            }
        });
        
        return nearest;
    }
    
    /**
     * Calcule la distance entre deux points (formule de Haversine)
     * 
     * @param {number} lat1 Latitude point 1
     * @param {number} lng1 Longitude point 1
     * @param {number} lat2 Latitude point 2
     * @param {number} lng2 Longitude point 2
     * @returns {number} Distance en mètres
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000; // Rayon de la Terre en mètres
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    
    /**
     * Calcule le cap (bearing) entre deux points
     * 
     * @param {number} lat1 Latitude point 1
     * @param {number} lng1 Longitude point 1
     * @param {number} lat2 Latitude point 2
     * @param {number} lng2 Longitude point 2
     * @returns {number} Cap en degrés (0-360)
     */
    calculateBearing(lat1, lng1, lat2, lng2) {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }
    
    /**
     * Convertit un cap en texte de direction
     * 
     * @param {number} bearing Cap en degrés
     * @returns {string} Texte de direction
     */
    getDirectionText(bearing) {
        if (bearing >= 337.5 || bearing < 22.5) return 'Continuez tout droit vers le nord';
        if (bearing >= 22.5 && bearing < 67.5) return 'Continuez vers le nord-est';
        if (bearing >= 67.5 && bearing < 112.5) return 'Continuez vers l\'est';
        if (bearing >= 112.5 && bearing < 157.5) return 'Continuez vers le sud-est';
        if (bearing >= 157.5 && bearing < 202.5) return 'Continuez vers le sud';
        if (bearing >= 202.5 && bearing < 247.5) return 'Continuez vers le sud-ouest';
        if (bearing >= 247.5 && bearing < 292.5) return 'Continuez vers l\'ouest';
        if (bearing >= 292.5 && bearing < 337.5) return 'Continuez vers le nord-ouest';
        return 'Continuez tout droit';
    }
}

// Export pour utilisation dans d'autres modules
export default MapManager;
