# Application d’aide à la mobilité — SAé 3.01

Projet réalisé dans le cadre de la **SAé 3.01** (B.U.T.) : une application **client / serveur** qui aide à **trouver une place de parking** et à s’y **orienter** sur une carte.

## En une phrase

L’utilisateur voit les parkings (données ouvertes), peut être **géolocalisé**, lancer un **itinéraire** vers le parking le plus adapté, et **créer un compte** pour conserver favoris et préférences.

## Lien avec le sujet

Le cahier des charges minimal prévoit notamment :

- géolocalisation ;
- repérage d’une place / parking disponible proche ;
- guidage vers cette destination.

Le sujet laisse la porte ouverte à des **évolutions** (profil, préférences, réactivité si un parking devient indisponible, etc.). Cette application en intègre une partie (compte utilisateur, préférences, villes multiples, etc.).

## Technique (aperçu)

| Partie | Choix |
|--------|--------|
| Serveur | PHP |
| Données | MySQL (comptes, favoris, historique, préférences) |
| Carte | Leaflet + OpenStreetMap |
| Parkings | Flux WFS Eurométropole de Metz ; Londres via API TfL (clé requise) |
| Itinéraires | OSRM (service public de routage) |

## Structure utile

- `Appli/index.php` — page principale (carte, recherche, guidage)
- `Appli/api/` — points d’entrée JSON pour le front
- `Appli/config/` — configuration (exemples versionnés, secrets en local)
- `Appli/bdd/` — scripts SQL de migration / maintenance

---

*Contexte officiel : SAé 3.01 — application communicante, qualité, sécurité, données ; sujet type « guidage vers les parkings disponibles » (IUT de Metz, univ-lorraine).*