// Supabase client comes from supabase-client.js, loaded before this file.

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
const goToSignupLink = document.getElementById("go-to-signup-link");

// DOM elements - sign up
const signupScreen = document.getElementById("signup-screen");
const signupName = document.getElementById("signup-name");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const signupConfirmPassword = document.getElementById("signup-confirm-password");
const signupBtn = document.getElementById("signup-btn");
const backToLoginFromSignupLink = document.getElementById("back-to-login-from-signup-link");
const signupMsg = document.getElementById("signup-msg");
const signupMsgText = document.getElementById("signup-msg-text");

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
const allScreens = [loginScreen, signupScreen, forgotPasswordScreen, newPasswordScreen, appContent];

function showScreen(screen) {
    allScreens.forEach((s) => (s.style.display = "none"));
    screen.style.display = "block";
}

function showApp(user) {
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
        showApp(data.session.user);
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

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

    loginBtn.disabled = false;
    loginBtn.innerText = "Log In";

    if (error) {
        showLoginError("Invalid email or password.");
        return;
    }

    loginPassword.value = "";
    showApp(data.user);
}

// Handle sign up: creates the auth user and stores their full name in
// user_metadata so it can be shown as "Hello, {name}" after login.
async function handleSignup() {
    signupMsg.style.display = "none";

    const fullName = signupName.value.trim();
    const email = signupEmail.value.trim();
    const password = signupPassword.value;
    const confirmPassword = signupConfirmPassword.value;

    if (!fullName || !email || !password) {
        showMessage(signupMsg, signupMsgText, "Please fill in all fields.", true);
        return;
    }

    if (password.length < 6) {
        showMessage(signupMsg, signupMsgText, "Password must be at least 6 characters.", true);
        return;
    }

    if (password !== confirmPassword) {
        showMessage(signupMsg, signupMsgText, "Passwords don't match.", true);
        return;
    }

    signupBtn.disabled = true;
    signupBtn.innerText = "Creating account...";

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: fullName }
        }
    });

    signupBtn.disabled = false;
    signupBtn.innerText = "Sign Up";

    if (error) {
        showMessage(signupMsg, signupMsgText, error.message || "Couldn't create account. Try again.", true);
        return;
    }

    // If email confirmation is OFF in your Supabase auth settings, signUp
    // returns an active session immediately - log the user straight in.
    if (data.session) {
        signupName.value = "";
        signupEmail.value = "";
        signupPassword.value = "";
        signupConfirmPassword.value = "";
        showApp(data.user);
        return;
    }

    // Otherwise (confirmation emails ON), tell them to check their inbox.
    showMessage(
        signupMsg,
        signupMsgText,
        "Account created! Check your email to confirm before logging in.",
        false
    );
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
signupBtn.addEventListener("click", handleSignup);
logoutBtn.addEventListener("click", handleLogout);
sendResetBtn.addEventListener("click", handleSendReset);
saveNewPasswordBtn.addEventListener("click", handleSaveNewPassword);

goToSignupLink.addEventListener("click", (e) => {
    e.preventDefault();
    signupMsg.style.display = "none";
    showScreen(signupScreen);
});

backToLoginFromSignupLink.addEventListener("click", (e) => {
    e.preventDefault();
    showLogin();
});

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
        showApp(session.user);
    } else {
        showLogin();
    }
});

checkSession();
