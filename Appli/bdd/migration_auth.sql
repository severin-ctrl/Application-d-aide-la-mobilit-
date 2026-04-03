-- ============================================================
-- Script de migration pour l'authentification et les profils
-- ============================================================
-- 
-- Ce script met à jour la structure de la base de données
-- pour supporter l'authentification sécurisée et les préférences utilisateur
--
-- Date : 2024
-- Auteur : Équipe SAé 3.01
-- ============================================================

-- ============================================================
-- 1. MISE À JOUR DE LA TABLE Utilisateur
-- ============================================================

-- Vérifier si la colonne mot_de_passe est assez grande pour les hash
-- (password_hash génère des hash de 60 caractères minimum)
ALTER TABLE `Utilisateur` 
MODIFY COLUMN `mot_de_passe` VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt du mot de passe';

-- Ajouter une colonne pour la date de création (optionnel mais recommandé)
ALTER TABLE `Utilisateur` 
ADD COLUMN `date_creation` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création du compte' AFTER `preference_cout`;

-- Ajouter une colonne pour la date de dernière connexion (optionnel)
ALTER TABLE `Utilisateur` 
ADD COLUMN `derniere_connexion` DATETIME NULL COMMENT 'Date de dernière connexion' AFTER `date_creation`;

-- ============================================================
-- 2. VÉRIFICATION DES TABLES DE RÉFÉRENCE
-- ============================================================

-- Les tables Ref_Type_Vehicule et Ref_Motorisation existent déjà
-- Vérification des valeurs :

-- Ref_Type_Vehicule doit contenir : Voiture (1), Moto (2), Vélo (3)
-- Ref_Motorisation doit contenir : Thermique (1), Electrique (2), Hybride (3), Sans moteur (4)

-- ============================================================
-- 3. MISE À JOUR DES DONNÉES EXISTANTES
-- ============================================================

-- IMPORTANT : Les mots de passe existants sont en clair dans le script original
-- Il faut les remplacer par des hash bcrypt lors de la première connexion
-- ou les mettre à jour manuellement

-- Exemple de hash pour "password123" (à remplacer par de vrais hash)
-- UPDATE Utilisateur SET mot_de_passe = '$2y$10$...' WHERE id_utilisateur = 1;

-- ============================================================
-- 4. CRÉATION D'INDEX POUR OPTIMISER LES REQUÊTES
-- ============================================================

-- Index sur email (déjà unique, mais vérifions)
-- L'index unique existe déjà dans le script original

-- ============================================================
-- NOTES IMPORTANTES
-- ============================================================
-- 
-- 1. Les mots de passe doivent être hachés avec password_hash() en PHP
--    Exemple : $hash = password_hash($password, PASSWORD_BCRYPT);
--
-- 2. La vérification se fait avec password_verify() en PHP
--    Exemple : if (password_verify($password, $hash)) { ... }
--
-- 3. La structure actuelle permet déjà de gérer :
--    - Type de véhicule via la table Vehicule + Ref_Type_Vehicule
--    - Motorisation via la table Vehicule + Ref_Motorisation
--    - PMR via est_pmr (TINYINT)
--    - Budget via preference_cout (ENUM)
--
-- 4. Un utilisateur peut avoir plusieurs véhicules (relation 1-N)
--    Pour simplifier, on prendra le premier véhicule pour les filtres
--
-- ============================================================
