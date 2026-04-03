<?php
/**
 * Page d'inscription
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Cette page a une seule responsabilité : gérer l'inscription des utilisateurs
 */

require_once __DIR__ . '/config/Auth.php';
require_once __DIR__ . '/modele/User.php';

Auth::startSession();

// Si déjà connecté, rediriger vers la page principale
if (Auth::isLoggedIn()) {
    header('Location: index.php');
    exit;
}

$error = '';
$success = '';

// Traitement du formulaire
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    $passwordConfirm = $_POST['password_confirm'] ?? '';
    $pseudo = trim($_POST['pseudo'] ?? '');
    $estPmr = isset($_POST['est_pmr']) && $_POST['est_pmr'] === '1';
    $preferenceCout = $_POST['preference_cout'] ?? 'INDIFFERENT';
    
    // Validation
    if (empty($email) || empty($password) || empty($pseudo)) {
        $error = 'Tous les champs obligatoires doivent être remplis';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Email invalide';
    } elseif (strlen($password) < 6) {
        $error = 'Le mot de passe doit contenir au moins 6 caractères';
    } elseif ($password !== $passwordConfirm) {
        $error = 'Les mots de passe ne correspondent pas';
    } else {
        $userModel = new User();
        
        if ($userModel->emailExists($email)) {
            $error = 'Cet email est déjà utilisé';
        } else {
            $userId = $userModel->create($email, $password, $pseudo, $estPmr, $preferenceCout);
            
            if ($userId) {
                // Connecter automatiquement l'utilisateur
                $user = $userModel->getById($userId);
                if ($user) {
                    Auth::login($user);
                    header('Location: index.php');
                    exit;
                }
                $success = 'Inscription réussie ! Vous pouvez maintenant vous connecter.';
            } else {
                $error = 'Erreur lors de l\'inscription. Veuillez réessayer.';
            }
        }
    }
}

$pageTitle = 'Inscription - Parking Metz';
require_once __DIR__ . '/includes/header.php';
?>

<div class="auth-container">
    <div class="auth-box">
        <h1>Créer un compte</h1>
        
        <?php if ($error): ?>
            <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <?php if ($success): ?>
            <div class="alert alert-success"><?php echo htmlspecialchars($success); ?></div>
        <?php endif; ?>
        
        <form method="POST" action="register.php" class="auth-form">
            <div class="form-group">
                <label for="email">Email *</label>
                <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    required 
                    value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>"
                    autocomplete="email"
                >
            </div>
            
            <div class="form-group">
                <label for="pseudo">Pseudo *</label>
                <input 
                    type="text" 
                    id="pseudo" 
                    name="pseudo" 
                    required 
                    value="<?php echo htmlspecialchars($_POST['pseudo'] ?? ''); ?>"
                    autocomplete="username"
                >
            </div>
            
            <div class="form-group">
                <label for="password">Mot de passe *</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    required 
                    minlength="6"
                    autocomplete="new-password"
                >
                <small>Minimum 6 caractères</small>
            </div>
            
            <div class="form-group">
                <label for="password_confirm">Confirmer le mot de passe *</label>
                <input 
                    type="password" 
                    id="password_confirm" 
                    name="password_confirm" 
                    required 
                    minlength="6"
                    autocomplete="new-password"
                >
            </div>
            
            <div class="form-group">
                <label for="preference_cout">Préférence de coût</label>
                <select id="preference_cout" name="preference_cout">
                    <option value="INDIFFERENT" <?php echo ($_POST['preference_cout'] ?? 'INDIFFERENT') === 'INDIFFERENT' ? 'selected' : ''; ?>>Peu importe</option>
                    <option value="GRATUIT" <?php echo ($_POST['preference_cout'] ?? '') === 'GRATUIT' ? 'selected' : ''; ?>>Gratuit uniquement</option>
                    <option value="PAYANT" <?php echo ($_POST['preference_cout'] ?? '') === 'PAYANT' ? 'selected' : ''; ?>>Payant uniquement</option>
                </select>
            </div>
            
            <div class="form-group checkbox-group">
                <label>
                    <input 
                        type="checkbox" 
                        name="est_pmr" 
                        value="1"
                        <?php echo isset($_POST['est_pmr']) ? 'checked' : ''; ?>
                    >
                    <span>Situation de handicap (PMR)</span>
                </label>
            </div>
            
            <button type="submit" class="btn-primary">S'inscrire</button>
        </form>
        
        <p class="auth-link">
            Déjà un compte ? <a href="login.php">Se connecter</a>
        </p>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
