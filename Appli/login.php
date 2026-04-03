<?php
/**
 * Page de connexion
 * 
 * Principe SOLID appliqué : Single Responsibility Principle (SRP)
 * Cette page a une seule responsabilité : gérer la connexion des utilisateurs
 */

require_once __DIR__ . '/config/Auth.php';

Auth::startSession();

// Si déjà connecté, rediriger
if (Auth::isLoggedIn()) {
    $redirect = $_GET['redirect'] ?? 'index.php';
    header('Location: ' . $redirect);
    exit;
}

$error = '';

// Traitement du formulaire
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';
    
    if (empty($email) || empty($password)) {
        $error = 'Veuillez remplir tous les champs';
    } else {
        $user = Auth::attemptLogin($email, $password);
        
        if ($user) {
            $redirect = $_GET['redirect'] ?? 'index.php';
            header('Location: ' . $redirect);
            exit;
        } else {
            $error = 'Email ou mot de passe incorrect';
        }
    }
}

$pageTitle = 'Connexion - Parking Metz';
require_once __DIR__ . '/includes/header.php';
?>

<div class="auth-container">
    <div class="auth-box">
        <h1>Connexion</h1>
        
        <?php if ($error): ?>
            <div class="alert alert-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>
        
        <form method="POST" action="login.php<?php echo isset($_GET['redirect']) ? '?redirect=' . urlencode($_GET['redirect']) : ''; ?>" class="auth-form">
            <div class="form-group">
                <label for="email">Email</label>
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
                <label for="password">Mot de passe</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    required
                    autocomplete="current-password"
                >
            </div>
            
            <button type="submit" class="btn-primary">Se connecter</button>
        </form>
        
        <p class="auth-link">
            Pas encore de compte ? <a href="register.php">S'inscrire</a>
        </p>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
