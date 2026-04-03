-- Script SQL pour réinitialiser l'AUTO_INCREMENT de la table Vehicule
-- 
-- Ce script réinitialise l'AUTO_INCREMENT au prochain ID disponible
-- basé sur le maximum ID actuel dans la table.
-- 
-- Exemple : Si le maximum ID est 7, le prochain ID sera 8 (au lieu de 9, 10, etc.)
-- 
-- ATTENTION : Ce script ne réorganise PAS les IDs existants.
-- Les IDs manquants (5, 6, etc.) resteront manquants.
-- C'est le comportement normal de MySQL AUTO_INCREMENT.

-- Réinitialiser l'AUTO_INCREMENT au prochain ID disponible
SET @max_id = (SELECT COALESCE(MAX(id_vehicule), 0) FROM Vehicule);
SET @sql = CONCAT('ALTER TABLE Vehicule AUTO_INCREMENT = ', @max_id + 1);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vérification (optionnel)
SELECT CONCAT('AUTO_INCREMENT réinitialisé. Prochain ID sera : ', @max_id + 1) AS message;
