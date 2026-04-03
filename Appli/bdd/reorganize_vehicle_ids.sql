-- Script SQL pour réorganiser les IDs de véhicules de manière séquentielle
-- 
-- ATTENTION : Ce script modifie les IDs existants pour combler les trous
-- 
-- AVANT D'EXÉCUTER CE SCRIPT :
-- 1. Faites une sauvegarde complète de la base de données
-- 2. Testez d'abord sur une copie de la base de données
--
-- Ce script :
-- 1. Crée une table temporaire avec les nouveaux IDs séquentiels (1, 2, 3, 4, 5...)
-- 2. Supprime tous les véhicules existants
-- 3. Réinsère les véhicules avec les nouveaux IDs séquentiels
-- 4. Réinitialise l'AUTO_INCREMENT au prochain ID disponible

-- Étape 1 : Afficher l'état actuel (pour vérification)
SELECT 'État AVANT réorganisation :' AS info;
SELECT * FROM Vehicule ORDER BY id_vehicule;

-- Étape 2 : Créer une table temporaire avec les données actuelles et les nouveaux IDs séquentiels
-- Utilisation d'une variable pour générer les IDs séquentiels (compatible MariaDB 10.3)
SET @row_number = 0;

CREATE TEMPORARY TABLE temp_vehicles_reorganized (
    new_id_vehicule INT,
    nom_vehicule VARCHAR(50),
    id_utilisateur INT,
    id_type_veh INT,
    id_motorisation INT
);

INSERT INTO temp_vehicles_reorganized (new_id_vehicule, nom_vehicule, id_utilisateur, id_type_veh, id_motorisation)
SELECT 
    (@row_number := @row_number + 1) AS new_id_vehicule,
    v.nom_vehicule,
    v.id_utilisateur,
    v.id_type_veh,
    v.id_motorisation
FROM Vehicule v
ORDER BY v.id_vehicule;

-- Étape 3 : Afficher le mapping (pour vérification avant suppression)
-- Créer une table temporaire avec les anciens IDs pour le mapping
SET @row_num = 0;
CREATE TEMPORARY TABLE temp_old_ids AS
SELECT 
    (@row_num := @row_num + 1) AS row_num,
    id_vehicule AS old_id
FROM Vehicule
ORDER BY id_vehicule;

SELECT 
    'Mapping des IDs (ancien -> nouveau) :' AS info;
SELECT 
    t_old.old_id AS ancien_id,
    t.new_id_vehicule AS nouveau_id,
    t.nom_vehicule
FROM temp_vehicles_reorganized t
LEFT JOIN temp_old_ids t_old ON t_old.row_num = t.new_id_vehicule
ORDER BY t.new_id_vehicule;

-- Étape 4 : Désactiver temporairement les vérifications de clés étrangères
SET FOREIGN_KEY_CHECKS = 0;

-- Étape 5 : Supprimer tous les véhicules existants
DELETE FROM Vehicule;

-- Étape 6 : Réinitialiser l'AUTO_INCREMENT à 1
ALTER TABLE Vehicule AUTO_INCREMENT = 1;

-- Étape 7 : Réinsérer les véhicules avec les nouveaux IDs séquentiels
INSERT INTO Vehicule (id_vehicule, nom_vehicule, id_utilisateur, id_type_veh, id_motorisation)
SELECT 
    new_id_vehicule,
    nom_vehicule,
    id_utilisateur,
    id_type_veh,
    id_motorisation
FROM temp_vehicles_reorganized
ORDER BY new_id_vehicule;

-- Étape 8 : Réinitialiser l'AUTO_INCREMENT au prochain ID disponible
SET @max_id = (SELECT COALESCE(MAX(id_vehicule), 0) FROM Vehicule);
SET @sql = CONCAT('ALTER TABLE Vehicule AUTO_INCREMENT = ', @max_id + 1);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Étape 9 : Réactiver les vérifications de clés étrangères
SET FOREIGN_KEY_CHECKS = 1;

-- Étape 10 : Nettoyer les tables temporaires
DROP TEMPORARY TABLE IF EXISTS temp_vehicles_reorganized;
DROP TEMPORARY TABLE IF EXISTS temp_old_ids;

-- Étape 11 : Vérification finale
SELECT 
    'Réorganisation terminée !' AS message,
    COUNT(*) AS nombre_vehicules,
    MIN(id_vehicule) AS min_id,
    MAX(id_vehicule) AS max_id,
    CONCAT('Prochain ID sera : ', @max_id + 1) AS prochain_id
FROM Vehicule;

SELECT 'État APRÈS réorganisation :' AS info;
SELECT * FROM Vehicule ORDER BY id_vehicule;
