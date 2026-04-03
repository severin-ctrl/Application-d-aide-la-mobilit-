<?php
/**
 * Configuration des villes supportées
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Ce fichier a une seule responsabilité : définir les villes et leurs configurations
 */

return [
    'metz' => [
        'name' => 'Metz',
        'code' => 'metz',
        'center' => [
            'lat' => 49.119,
            'lng' => 6.176
        ],
        'zoom' => 13,
        'provider' => 'MetzParkingProvider'
    ],
    'london' => [
        'name' => 'Londres',
        'code' => 'london',
        'center' => [
            'lat' => 51.507,
            'lng' => -0.127
        ],
        'zoom' => 12,
        'provider' => 'LondonParkingProvider'
    ]
];
