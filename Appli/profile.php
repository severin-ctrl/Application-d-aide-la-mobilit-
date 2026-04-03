<?php
/**
 * Page de profil utilisateur
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Cette page permet à l'utilisateur de modifier son profil et ses véhicules
 */

require_once __DIR__ . '/config/Auth.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/modele/User.php';

Auth::startSession();
Auth::requireLogin();

$userModel = new User();
$userId = Auth::getUserId();

// Vérification de sécurité
if (!$userId) {
    header('Location: login.php');
    exit;
}

// Récupérer le profil utilisateur
$user = $userModel->getFullProfile($userId);

// Si getFullProfile ne retourne pas les véhicules, les récupérer directement
if ($user && isset($user['vehicules'])) {
    $vehicles = $user['vehicules'];
} else {
    // Fallback : récupérer directement les véhicules
    $vehicles = $userModel->getVehicles($userId);
    // Si on a récupéré l'utilisateur mais sans véhicules, les ajouter
    if ($user && is_array($user)) {
        $user['vehicules'] = $vehicles;
    }
}

// Si $user est false, récupérer au moins les données de base
if (!$user) {
    $user = $userModel->getById($userId);
    if ($user) {
        $user['vehicules'] = $vehicles;
    } else {
        // Erreur critique
        header('Location: login.php');
        exit;
    }
}

// Debug : Vérifier que les véhicules sont bien récupérés
error_log("Profile.php - User ID: $userId, Nombre de véhicules: " . count($vehicles));

$error = '';
$success = '';

// Traitement de la mise à jour du profil
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_profile') {
    $pseudo = trim($_POST['pseudo'] ?? '');
    $estPmr = isset($_POST['est_pmr']) && $_POST['est_pmr'] === '1';
    $preferenceCout = $_POST['preference_cout'] ?? 'INDIFFERENT';
    
    if (empty($pseudo)) {
        $error = 'Le pseudo est obligatoire';
    } else {
        if ($userModel->updateProfile($userId, [
            'pseudo' => $pseudo,
            'est_pmr' => $estPmr,
            'preference_cout' => $preferenceCout
        ])) {
            $success = 'Profil mis à jour avec succès';
            
            // Recharger les données depuis la BDD
            $user = $userModel->getFullProfile($userId);
            
            // Si getFullProfile ne retourne pas les véhicules, les récupérer directement
            if ($user && isset($user['vehicules'])) {
                $vehicles = $user['vehicules'];
            } else {
                // Fallback : récupérer directement les véhicules
                $vehicles = $userModel->getVehicles($userId);
                // Si on a récupéré l'utilisateur mais sans véhicules, les ajouter
                if ($user && is_array($user)) {
                    $user['vehicules'] = $vehicles;
                }
            }
            
            // Mettre à jour la session avec les nouvelles données
            if ($user) {
                // Préparer les données pour la session (sans mot de passe ni véhicules)
                $sessionData = [
                    'id_utilisateur' => $user['id_utilisateur'],
                    'email' => $user['email'],
                    'pseudo' => $user['pseudo'],
                    'est_pmr' => $user['est_pmr'],
                    'preference_cout' => $user['preference_cout']
                ];
                Auth::login($sessionData);
            }
        } else {
            $error = 'Erreur lors de la mise à jour';
        }
    }
}

// Récupérer les types de véhicules et motorisations
$db = Database::getInstance();
$typesVehicules = $db->query("SELECT * FROM Ref_Type_Vehicule ORDER BY id_type_veh")->fetchAll();
// Exclure "Sans moteur" (id_motorisation = 4) de la liste car elle est assignée automatiquement pour les vélos
$motorisations = $db->query("SELECT * FROM Ref_Motorisation WHERE id_motorisation != 4 ORDER BY id_motorisation")->fetchAll();

// Traitement de l'ajout d'un véhicule
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'add_vehicle') {
    $nomVehicule = trim($_POST['nom_vehicule'] ?? '');
    $idTypeVeh = (int)($_POST['id_type_veh'] ?? 0);
    $idMotorisation = (int)($_POST['id_motorisation'] ?? 0);
    
    // Vérifier le type de véhicule
    $typeVeh = null;
    foreach ($typesVehicules as $type) {
        if ($type['id_type_veh'] == $idTypeVeh) {
            $typeVeh = strtolower($type['libelle_type']);
            break;
        }
    }
    
    // Pour un vélo, utiliser "Sans moteur" (id_motorisation = 4)
    if ($typeVeh === 'velo') {
        $idMotorisation = 4; // "Sans moteur"
    }
    
    if (empty($nomVehicule) || $idTypeVeh === 0) {
        $error = 'Le nom et le type de véhicule sont obligatoires';
    } elseif ($typeVeh !== 'velo' && $idMotorisation === 0) {
        $error = 'La motorisation est obligatoire pour ce type de véhicule';
    } else {
        if ($userModel->addVehicle($userId, $nomVehicule, $idTypeVeh, $idMotorisation)) {
            $success = 'Véhicule ajouté avec succès';
            // Recharger les données
            $user = $userModel->getFullProfile($userId);
            // Si getFullProfile ne retourne pas les véhicules, les récupérer directement
            if ($user && isset($user['vehicules'])) {
                $vehicles = $user['vehicules'];
            } else {
                $vehicles = $userModel->getVehicles($userId);
                if ($user && is_array($user)) {
                    $user['vehicules'] = $vehicles;
                }
            }
        } else {
            $error = 'Erreur lors de l\'ajout du véhicule';
        }
    }
}

// Traitement de la modification d'un véhicule
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'update_vehicle') {
    $vehicleId = (int)($_POST['vehicle_id'] ?? 0);
    $nomVehicule = trim($_POST['nom_vehicule'] ?? '');
    $idTypeVeh = (int)($_POST['id_type_veh'] ?? 0);
    $idMotorisation = (int)($_POST['id_motorisation'] ?? 0);
    
    // Vérifier le type de véhicule
    $typeVeh = null;
    foreach ($typesVehicules as $type) {
        if ($type['id_type_veh'] == $idTypeVeh) {
            $typeVeh = strtolower($type['libelle_type']);
            break;
        }
    }
    
    // Pour un vélo, utiliser "Sans moteur" (id_motorisation = 4)
    if ($typeVeh === 'velo') {
        $idMotorisation = 4; // "Sans moteur"
    }
    
    if ($vehicleId === 0 || empty($nomVehicule) || $idTypeVeh === 0) {
        $error = 'Tous les champs sont obligatoires';
    } elseif ($typeVeh !== 'velo' && $idMotorisation === 0) {
        $error = 'La motorisation est obligatoire pour ce type de véhicule';
    } else {
        if ($userModel->updateVehicle($vehicleId, $userId, $nomVehicule, $idTypeVeh, $idMotorisation)) {
            $success = 'Véhicule modifié avec succès';
            // Recharger les données
            $user = $userModel->getFullProfile($userId);
            // Si getFullProfile ne retourne pas les véhicules, les récupérer directement
            if ($user && isset($user['vehicules'])) {
                $vehicles = $user['vehicules'];
            } else {
                $vehicles = $userModel->getVehicles($userId);
                if ($user && is_array($user)) {
                    $user['vehicules'] = $vehicles;
                }
            }
        } else {
            $error = 'Erreur lors de la modification du véhicule';
        }
    }
}

// Traitement de la suppression d'un véhicule
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'delete_vehicle') {
    $vehicleId = (int)($_POST['vehicle_id'] ?? 0);
    
    if ($vehicleId === 0) {
        $error = 'ID de véhicule invalide';
    } else {
        if ($userModel->deleteVehicle($vehicleId, $userId)) {
            $success = 'Véhicule supprimé avec succès';
            // Recharger les données
            $user = $userModel->getFullProfile($userId);
            // Si getFullProfile ne retourne pas les véhicules, les récupérer directement
            if ($user && isset($user['vehicules'])) {
                $vehicles = $user['vehicules'];
            } else {
                $vehicles = $userModel->getVehicles($userId);
                if ($user && is_array($user)) {
                    $user['vehicules'] = $vehicles;
                }
            }
        } else {
            $error = 'Erreur lors de la suppression du véhicule';
        }
    }
}

$pageTitle = 'Mon Profil - Parking Metz';
require_once __DIR__ . '/includes/header.php';
?>

<div class="profile-container">
    <div class="profile-box">
        <h1>Mon Profil</h1>
        
        <?php if ($error): ?>
            <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <?php if ($success): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>
        
        <!-- Debug temporaire -->
        <?php if (isset($_GET['debug'])): ?>
            <div style="background: #f0f0f0; padding: 15px; margin: 15px 0; border: 1px solid #ccc; border-radius: 5px;">
                <h3>Debug Info</h3>
                <p><strong>User ID connecté:</strong> <?php echo $userId; ?></p>
                <p><strong>Email:</strong> <?php echo htmlspecialchars($user['email'] ?? 'N/A'); ?></p>
                <p><strong>Pseudo:</strong> <?php echo htmlspecialchars($user['pseudo'] ?? 'N/A'); ?></p>
                <p><strong>Nombre de véhicules récupérés:</strong> <?php echo count($vehicles); ?></p>
                <pre style="background: white; padding: 10px; overflow: auto;"><?php print_r($vehicles); ?></pre>
                <p><a href="debug_vehicles.php" target="_blank">Ouvrir le script de debug complet</a></p>
            </div>
        <?php endif; ?>
        
        <!-- Formulaire de mise à jour du profil -->
        <section class="profile-section">
            <h2>Informations personnelles</h2>
            <form method="POST" action="profile.php" class="profile-form">
                <input type="hidden" name="action" value="update_profile">
                
                <div class="form-group">
                    <label for="pseudo">Pseudo</label>
                    <input 
                        type="text" 
                        id="pseudo" 
                        name="pseudo" 
                        required 
                        value="<?php echo htmlspecialchars($user['pseudo'] ?? ''); ?>"
                    >
                </div>
                
                <div class="form-group">
                    <label for="email">Email</label>
                    <input 
                        type="email" 
                        id="email" 
                        value="<?php echo htmlspecialchars($user['email'] ?? ''); ?>"
                        disabled
                    >
                    <small>L'email ne peut pas être modifié</small>
                </div>
                
                <div class="form-group">
                    <label for="preference_cout">Préférence de coût</label>
                    <select id="preference_cout" name="preference_cout">
                        <option value="INDIFFERENT" <?php echo ($user['preference_cout'] ?? 'INDIFFERENT') === 'INDIFFERENT' ? 'selected' : ''; ?>>Peu importe</option>
                        <option value="GRATUIT" <?php echo ($user['preference_cout'] ?? '') === 'GRATUIT' ? 'selected' : ''; ?>>Gratuit uniquement</option>
                        <option value="PAYANT" <?php echo ($user['preference_cout'] ?? '') === 'PAYANT' ? 'selected' : ''; ?>>Payant uniquement</option>
                    </select>
                </div>
                
                <div class="form-group checkbox-group">
                    <label>
                        <input 
                            type="checkbox" 
                            name="est_pmr" 
                            value="1"
                            <?php echo ($user['est_pmr'] ?? 0) ? 'checked' : ''; ?>
                        >
                        <span>Situation de handicap (PMR)</span>
                    </label>
                </div>
                
                <button type="submit" class="btn-primary">Mettre à jour</button>
            </form>
        </section>
        
        <!-- Gestion des véhicules -->
        <section class="profile-section">
            <h2>Mes véhicules</h2>
            
            <?php if (!empty($vehicles)): ?>
                <div class="vehicles-list">
                    <?php foreach ($vehicles as $vehicle): ?>
                        <div class="vehicle-item" data-vehicle-id="<?php echo $vehicle['id_vehicule']; ?>">
                            <div class="vehicle-content">
                                <div class="vehicle-header">
                                    <strong><?php echo htmlspecialchars($vehicle['nom_vehicule'] ?? 'Véhicule'); ?></strong>
                                </div>
                                <div class="vehicle-details">
                                    <span class="vehicle-type">
                                        <strong>Type :</strong> <?php echo htmlspecialchars($vehicle['libelle_type'] ?? 'Non spécifié'); ?>
                                    </span>
                                    <?php if (strtolower($vehicle['libelle_type'] ?? '') !== 'velo'): ?>
                                        <span class="vehicle-motorization">
                                            <strong>Motorisation :</strong> <?php echo htmlspecialchars($vehicle['libelle_moto'] ?? 'Non spécifiée'); ?>
                                        </span>
                                    <?php endif; ?>
                                </div>
                            </div>
                            <div class="vehicle-actions">
                                <button type="button" class="btn-edit-vehicle" data-vehicle-id="<?php echo $vehicle['id_vehicule']; ?>" title="Modifier">
                                    ✏️
                                </button>
                                <form method="POST" action="profile.php" style="display: inline;" onsubmit="return confirm('Êtes-vous sûr de vouloir supprimer ce véhicule ?');">
                                    <input type="hidden" name="action" value="delete_vehicle">
                                    <input type="hidden" name="vehicle_id" value="<?php echo $vehicle['id_vehicule']; ?>">
                                    <button type="submit" class="btn-delete-vehicle" title="Supprimer">
                                        🗑️
                                    </button>
                                </form>
                            </div>
                        </div>
                        
                        <!-- Formulaire de modification (caché par défaut) -->
                        <div class="vehicle-edit-form hidden" id="edit-form-<?php echo $vehicle['id_vehicule']; ?>">
                            <form method="POST" action="profile.php" class="profile-form">
                                <input type="hidden" name="action" value="update_vehicle">
                                <input type="hidden" name="vehicle_id" value="<?php echo $vehicle['id_vehicule']; ?>">
                                
                                <div class="form-group">
                                    <label for="edit_nom_vehicule_<?php echo $vehicle['id_vehicule']; ?>">Nom du véhicule</label>
                                    <input 
                                        type="text" 
                                        id="edit_nom_vehicule_<?php echo $vehicle['id_vehicule']; ?>" 
                                        name="nom_vehicule" 
                                        value="<?php echo htmlspecialchars($vehicle['nom_vehicule'] ?? ''); ?>"
                                        required
                                    >
                                </div>
                                
                                <div class="form-group">
                                    <label for="edit_id_type_veh_<?php echo $vehicle['id_vehicule']; ?>">Type de véhicule</label>
                                    <select id="edit_id_type_veh_<?php echo $vehicle['id_vehicule']; ?>" name="id_type_veh" required>
                                        <option value="">-- Sélectionner --</option>
                                        <?php foreach ($typesVehicules as $type): ?>
                                            <option value="<?php echo $type['id_type_veh']; ?>" 
                                                data-libelle="<?php echo htmlspecialchars(strtolower($type['libelle_type'])); ?>"
                                                <?php echo ($vehicle['id_type_veh'] == $type['id_type_veh']) ? 'selected' : ''; ?>>
                                                <?php echo htmlspecialchars($type['libelle_type']); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                
                                <div class="form-group" id="edit_motorisation-group_<?php echo $vehicle['id_vehicule']; ?>">
                                    <label for="edit_id_motorisation_<?php echo $vehicle['id_vehicule']; ?>">Motorisation</label>
                                    <select id="edit_id_motorisation_<?php echo $vehicle['id_vehicule']; ?>" name="id_motorisation">
                                        <option value="">-- Sélectionner --</option>
                                        <?php foreach ($motorisations as $moto): ?>
                                            <option value="<?php echo $moto['id_motorisation']; ?>"
                                                <?php echo ($vehicle['id_motorisation'] == $moto['id_motorisation']) ? 'selected' : ''; ?>>
                                                <?php echo htmlspecialchars($moto['libelle_moto']); ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="submit" class="btn-primary">Enregistrer</button>
                                    <button type="button" class="btn-cancel-edit" data-vehicle-id="<?php echo $vehicle['id_vehicule']; ?>">Annuler</button>
                                </div>
                            </form>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php else: ?>
                <p class="no-vehicles">Aucun véhicule enregistré. Ajoutez votre premier véhicule ci-dessous.</p>
            <?php endif; ?>
            
            <h3>Ajouter un véhicule</h3>
            <form method="POST" action="profile.php" class="profile-form" id="add-vehicle-form">
                <input type="hidden" name="action" value="add_vehicle">
                
                <div class="form-group">
                    <label for="nom_vehicule">Nom du véhicule</label>
                    <input 
                        type="text" 
                        id="nom_vehicule" 
                        name="nom_vehicule" 
                        placeholder="Ex: Ma Clio, Mon VTT..."
                        required
                    >
                </div>
                
                <div class="form-group">
                    <label for="id_type_veh">Type de véhicule</label>
                    <select id="id_type_veh" name="id_type_veh" required>
                        <option value="">-- Sélectionner --</option>
                        <?php foreach ($typesVehicules as $type): ?>
                            <option value="<?php echo $type['id_type_veh']; ?>" data-libelle="<?php echo htmlspecialchars(strtolower($type['libelle_type'])); ?>">
                                <?php echo htmlspecialchars($type['libelle_type']); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <div class="form-group" id="motorisation-group">
                    <label for="id_motorisation">Motorisation</label>
                    <select id="id_motorisation" name="id_motorisation">
                        <option value="">-- Sélectionner --</option>
                        <?php foreach ($motorisations as $moto): ?>
                            <option value="<?php echo $moto['id_motorisation']; ?>">
                                <?php echo htmlspecialchars($moto['libelle_moto']); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </div>
                
                <button type="submit" class="btn-primary">Ajouter</button>
            </form>
        </section>
        
        <div class="profile-actions">
            <a href="index.php" class="btn-secondary">Retour à la carte</a>
            <a href="logout.php" class="btn-danger">Se déconnecter</a>
        </div>
    </div>
</div>

<script>
// Fonction pour gérer l'affichage du champ motorisation
function toggleMotorisation(selectId, groupId) {
    const typeSelect = document.getElementById(selectId);
    const motorisationGroup = document.getElementById(groupId);
    const motorisationSelect = motorisationGroup ? motorisationGroup.querySelector('select') : null;
    
    if (typeSelect && motorisationGroup && motorisationSelect) {
        const selectedOption = typeSelect.options[typeSelect.selectedIndex];
        const libelle = selectedOption.getAttribute('data-libelle');
        
        if (libelle === 'velo') {
            motorisationGroup.classList.add('hidden');
            motorisationSelect.removeAttribute('required');
        } else {
            motorisationGroup.classList.remove('hidden');
            motorisationSelect.setAttribute('required', 'required');
        }
    }
}

// Masquer le champ motorisation si le type est "Vélo" (formulaire d'ajout)
document.addEventListener('DOMContentLoaded', function() {
    const typeSelect = document.getElementById('id_type_veh');
    const motorisationGroup = document.getElementById('motorisation-group');
    
    if (typeSelect && motorisationGroup) {
        typeSelect.addEventListener('change', function() {
            toggleMotorisation('id_type_veh', 'motorisation-group');
        });
        
        // Vérifier au chargement si un vélo est déjà sélectionné
        if (typeSelect.value) {
            toggleMotorisation('id_type_veh', 'motorisation-group');
        }
    }
    
    // Gérer les formulaires de modification
    document.querySelectorAll('.btn-edit-vehicle').forEach(btn => {
        btn.addEventListener('click', function() {
            const vehicleId = this.getAttribute('data-vehicle-id');
            const editForm = document.getElementById('edit-form-' + vehicleId);
            const vehicleItem = this.closest('.vehicle-item');
            
            if (editForm && vehicleItem) {
                editForm.classList.remove('hidden');
                vehicleItem.style.display = 'none';
                
                // Gérer le champ motorisation pour le formulaire de modification
                const editTypeSelect = document.getElementById('edit_id_type_veh_' + vehicleId);
                if (editTypeSelect) {
                    editTypeSelect.addEventListener('change', function() {
                        toggleMotorisation('edit_id_type_veh_' + vehicleId, 'edit_motorisation-group_' + vehicleId);
                    });
                    // Vérifier au chargement
                    toggleMotorisation('edit_id_type_veh_' + vehicleId, 'edit_motorisation-group_' + vehicleId);
                }
            }
        });
    });
    
    // Gérer les boutons d'annulation
    document.querySelectorAll('.btn-cancel-edit').forEach(btn => {
        btn.addEventListener('click', function() {
            const vehicleId = this.getAttribute('data-vehicle-id');
            const editForm = document.getElementById('edit-form-' + vehicleId);
            const vehicleItem = document.querySelector('.vehicle-item[data-vehicle-id="' + vehicleId + '"]');
            
            if (editForm && vehicleItem) {
                editForm.classList.add('hidden');
                vehicleItem.style.display = 'flex';
            }
        });
    });
    
    // Initialiser les champs motorisation pour tous les formulaires de modification
    document.querySelectorAll('[id^="edit_id_type_veh_"]').forEach(select => {
        const vehicleId = select.id.replace('edit_id_type_veh_', '');
        toggleMotorisation('edit_id_type_veh_' + vehicleId, 'edit_motorisation-group_' + vehicleId);
    });
});
</script>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
