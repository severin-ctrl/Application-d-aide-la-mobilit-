<?php
/**
 * Fichier de configuration exemple
 * 
 * Copier ce fichier en config.php et remplir les valeurs appropriées
 */

// Configuration de la base de données
define('DB_HOST', 'devbdd.iutmetz.univ-lorraine.fr');
define('DB_NAME', 'e40250u_sae301');
define('DB_USER', 'votre_identifiant');
define('DB_PASS', 'votre_mot_de_passe');
define('DB_CHARSET', 'utf8mb4');

// Configuration de l'application
define('APP_NAME', 'Parking Metz - Mobilité');
define('APP_VERSION', '1.0.0');
define('APP_ENV', 'development'); // 'development' ou 'production'

// URLs des APIs externes
define('API_PARKING_TEMPS_REEL', 'https://maps.eurometropolemetz.eu/public/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=public:pub_tsp_sta&srsName=EPSG:4326&outputFormat=application%2Fjson&cql_filter=id%20is%20not%20null');
define('API_PARKING_STATIQUE', 'https://maps.eurometropolemetz.eu/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=public:pub_acc_sta&srsName=EPSG:4326&outputFormat=json');
define('OSRM_API_URL', 'https://router.project-osrm.org/route/v1/driving');

// Configuration de la géolocalisation
define('GEOLOCATION_TIMEOUT', 10000); // millisecondes
define('GEOLOCATION_MAX_AGE', 5000); // millisecondes

// Intervalle de rafraîchissement des parkings (millisecondes)
define('PARKING_REFRESH_INTERVAL', 30000); // 30 secondes
