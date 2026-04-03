<?php
/**
 * Interface pour les providers de parkings
 * 
 * Principe SOLID appliqué : 
 * - Open/Closed Principle (OCP) : Ouvert à l'extension, fermé à la modification
 * - Dependency Inversion Principle (DIP) : Dépendre d'abstractions, pas de concrétions
 * 
 * Pattern Design : Strategy
 * Cette interface définit le contrat que tous les providers doivent respecter
 */

interface ParkingProviderInterface {
    /**
     * Récupère tous les parkings disponibles
     * 
     * @return array Liste de parkings au format standardisé
     */
    public function getAllParkings(): array;
    
    /**
     * Recherche des parkings par terme
     * 
     * @param string $query Terme de recherche
     * @return array Liste de parkings filtrés
     */
    public function searchParkings(string $query): array;
    
    /**
     * Retourne le code de la ville gérée par ce provider
     * 
     * @return string Code de la ville (ex: 'metz', 'london')
     */
    public function getCityCode(): string;
}
