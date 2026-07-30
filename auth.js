// ====== Supabase config ======
// Replace these two values with the ones from your Supabase project:
// Project Settings -> API -> Project URL / anon public key
const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM elements - login
const loginScreen = document.getElementById("login-screen");
const appContent = document.getElementById("app-content");
const loginEmail = document.getElementById("login-email");
const loginPassword = document.getElementById("login-password");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginError = document.getElementById("login-error");
const loginErrorText = document.getElementById("login-error-text");
const forgotPasswordLink = document.getElementById("forgot-password-link");

// DOM elements - forgot password (request)
const forgotPasswordScreen = document.getElementById("forgot-password-screen");
const resetEmail = document.getElementById("reset-email");
const sendResetBtn = document.getElementById("send-reset-btn");
const backToLoginLink = document.getElementById("back-to-login-link");
const resetRequestMsg = document.getElementById("reset-request-msg");
const resetRequestMsgText = document.getElementById("reset-request-msg-text");

// DOM elements - new password (after clicking email link)
const newPasswordScreen = document.getElementById("new-password-screen");
const newPasswordInput = document.getElementById("new-password");
const confirmPasswordInput = document.getElementById("confirm-password");
const saveNewPasswordBtn = document.getElementById("save-new-password-btn");
const newPasswordMsg = document.getElementById("new-password-msg");
const newPasswordMsgText = document.getElementById("new-password-msg-text");

// All gate screens, for easy show/hide
const allScreens = [loginScreen, forgotPasswordScreen, newPasswordScreen, appContent];

function showScreen(screen) {
    allScreens.forEach((s) => (s.style.display = "none"));
    screen.style.display = "block";
}

function showApp() {
    showScreen(appContent);
}

function showLogin() {
    showScreen(loginScreen);
}

function showLoginError(message) {
    loginErrorText.innerText = message;
    loginError.style.display = "block";
}

function showMessage(el, textEl, message, isError) {
    textEl.innerText = message;
    el.style.display = "block";
    el.style.borderLeftColor = isError ? "#e53e3e" : "#667eea";
    textEl.style.color = isError ? "#e53e3e" : "#2d3748";
}

// Check for an existing session on page load.
// Supabase fires a PASSWORD_RECOVERY event (handled below) if the user
// arrived via a reset-password email link, so that case is handled separately.
async function checkSession() {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) {
        showApp();
    } else {
        showLogin();
    }
}

// Handle login
async function handleLogin() {
    loginError.style.display = "none";
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
        showLoginError("Please enter your email and password.");
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerText = "Signing in...";

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    loginBtn.disabled = false;
    loginBtn.innerText = "Log In";

    if (error) {
        showLoginError("Invalid email or password.");
        return;
    }

    loginPassword.value = "";
    showApp();
}

// Handle logout
async function handleLogout() {
    await supabaseClient.auth.signOut();
    showLogin();
}

// Handle "send reset link" request
async function handleSendReset() {
    resetRequestMsg.style.display = "none";
    const email = resetEmail.value.trim();

    if (!email) {
        showMessage(resetRequestMsg, resetRequestMsgText, "Please enter your email.", true);
        return;
    }

    sendResetBtn.disabled = true;
    sendResetBtn.innerText = "Sending...";

    // redirectTo brings the user back to this same page with a recovery
    // token in the URL, which triggers the PASSWORD_RECOVERY event below.
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname,
    });

    sendResetBtn.disabled = false;
    sendResetBtn.innerText = "Send Reset Link";

    if (error) {
        showMessage(resetRequestMsg, resetRequestMsgText, "Something went wrong. Try again.", true);
        return;
    }

    showMessage(
        resetRequestMsg,
        resetRequestMsgText,
        "If that email has an account, a reset link is on its way.",
        false
    );
}

// Handle setting a new password after arriving via the reset link
async function handleSaveNewPassword() {
    newPasswordMsg.style.display = "none";
    const newPass = newPasswordInput.value;
    const confirmPass = confirmPasswordInput.value;

    if (!newPass || newPass.length < 6) {
        showMessage(newPasswordMsg, newPasswordMsgText, "Password must be at least 6 characters.", true);
        return;
    }

    if (newPass !== confirmPass) {
        showMessage(newPasswordMsg, newPasswordMsgText, "Passwords don't match.", true);
        return;
    }

    saveNewPasswordBtn.disabled = true;
    saveNewPasswordBtn.innerText = "Saving...";

    const { error } = await supabaseClient.auth.updateUser({ password: newPass });

    saveNewPasswordBtn.disabled = false;
    saveNewPasswordBtn.innerText = "Save Password";

    if (error) {
        showMessage(newPasswordMsg, newPasswordMsgText, "Couldn't update password. Try again.", true);
        return;
    }

    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    showApp();
}

loginBtn.addEventListener("click", handleLogin);
logoutBtn.addEventListener("click", handleLogout);
sendResetBtn.addEventListener("click", handleSendReset);
saveNewPasswordBtn.addEventListener("click", handleSaveNewPassword);

forgotPasswordLink.addEventListener("click", (e) => {
    e.preventDefault();
    resetRequestMsg.style.display = "none";
    resetEmail.value = "";
    showScreen(forgotPasswordScreen);
});

backToLoginLink.addEventListener("click", (e) => {
    e.preventDefault();
    showLogin();
});

// Allow pressing Enter to submit on each relevant field
loginPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleLogin();
});
resetEmail.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSendReset();
});
confirmPasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSaveNewPassword();
});

// Keep the app in sync as auth state changes.
// PASSWORD_RECOVERY fires when the user lands here via the emailed reset
// link - show the "set new password" screen instead of the normal app/login.
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
        showScreen(newPasswordScreen);
        return;
    }
    if (session) {
        showApp();
    } else {
        showLogin();
    }
});

checkSession();
