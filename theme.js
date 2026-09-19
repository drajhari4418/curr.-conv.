// ====== Dark / light mode ======
// Shared by index.html and dashboard.html. Load this in <head> (no defer) so
// the saved theme is applied before the page paints - no light-mode flash.
(function () {
    const STORAGE_KEY = "theme";

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (e) {
            return null; // storage blocked - fall back to the OS preference
        }
    }

    function getInitialTheme() {
        const saved = getSavedTheme();
        if (saved === "dark" || saved === "light") return saved;
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        return prefersDark ? "dark" : "light";
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);

        const btn = document.getElementById("theme-toggle");
        if (btn) {
            const goingDark = theme === "light";
            btn.innerText = goingDark ? "🌙" : "☀️";
            btn.title = goingDark ? "Switch to dark mode" : "Switch to light mode";
            btn.setAttribute("aria-label", btn.title);
        }
    }

    // Apply immediately (runs while <head> is still being parsed)
    applyTheme(getInitialTheme());

    // Wire up the button once the DOM exists
    document.addEventListener("DOMContentLoaded", function () {
        const btn = document.getElementById("theme-toggle");
        if (!btn) return;

        applyTheme(document.documentElement.getAttribute("data-theme")); // refresh icon

        btn.addEventListener("click", function () {
            const current = document.documentElement.getAttribute("data-theme");
            const next = current === "dark" ? "light" : "dark";
            try {
                localStorage.setItem(STORAGE_KEY, next);
            } catch (e) {
                // ignore - the theme still switches for this visit
            }
            applyTheme(next);
        });
    });
})();
