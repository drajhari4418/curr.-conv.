// ====== Theme toggle ======
// Applies/persists a light or dark theme via a data-theme attribute on
// <html>, which the CSS custom properties in style.css key off of.
// The actual theme is set as early as possible via an inline script in
// each page's <head> (before this file loads) to avoid a flash of the
// wrong theme - this file just wires up the toggle button.

const themeToggleBtn = document.getElementById("theme-toggle");

function updateToggleIcon() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    themeToggleBtn.innerText = isDark ? "☀️" : "🌙";
    themeToggleBtn.title = isDark ? "Switch to light mode" : "Switch to dark mode";
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const newTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateToggleIcon();
}

themeToggleBtn.addEventListener("click", toggleTheme);
updateToggleIcon();
