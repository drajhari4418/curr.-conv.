// Supabase client comes from supabase-client.js, loaded before this file.

const loadingEl = document.getElementById("dashboard-loading");
const bodyEl = document.getElementById("dashboard-body");
const emptyEl = document.getElementById("dashboard-empty");
const tableEl = document.getElementById("history-table");
const tableBodyEl = document.getElementById("history-table-body");
const logoutBtn = document.getElementById("logout-btn");
const userGreeting = document.getElementById("user-greeting");

const statTotal = document.getElementById("stat-total");
const statFavoritePair = document.getElementById("stat-favorite-pair");
const statFavoriteCurrency = document.getElementById("stat-favorite-currency");
const statLastConversion = document.getElementById("stat-last-conversion");

const HISTORY_LIMIT = 20; // how many recent rows to display in the table

let currentRows = []; // rows currently loaded for the logged-in user

// Guard: redirect to the converter/login page if there's no active session
async function requireSession() {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
        window.location.href = "index.html";
        return null;
    }
    userGreeting.innerText = `Hello, ${getDisplayName(data.session.user)}`;
    return data.session.user;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// Compute the summary stats shown in the stat cards from the full list of rows
function computeStats(rows) {
    if (rows.length === 0) {
        return { total: 0, favoritePair: "—", favoriteCurrency: "—", lastConversion: "—" };
    }

    const pairCounts = {};
    const currencyCounts = {};

    rows.forEach((row) => {
        const pairKey = `${row.from_currency} → ${row.to_currency}`;
        pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;

        currencyCounts[row.from_currency] = (currencyCounts[row.from_currency] || 0) + 1;
        currencyCounts[row.to_currency] = (currencyCounts[row.to_currency] || 0) + 1;
    });

    const favoritePair = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])[0][0];
    const favoriteCurrency = Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0][0];

    // rows are already sorted newest-first from the query
    const lastConversion = formatDate(rows[0].created_at);

    return { total: rows.length, favoritePair, favoriteCurrency, lastConversion };
}

function renderStats(stats) {
    statTotal.innerText = stats.total;
    statFavoritePair.innerText = stats.favoritePair;
    statFavoriteCurrency.innerText = stats.favoriteCurrency;
    statLastConversion.innerText = stats.lastConversion;
}

function renderTable(rows) {
    tableBodyEl.innerHTML = "";

    rows.slice(0, HISTORY_LIMIT).forEach((row) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${formatDate(row.created_at)}</td>
            <td>${row.amount}</td>
            <td>${row.from_currency}</td>
            <td>${row.to_currency}</td>
            <td>${row.result}</td>
            <td><button class="delete-btn" data-id="${row.id}" title="Delete this conversion">🗑</button></td>
        `;
        tableBodyEl.appendChild(tr);
    });
}

async function loadDashboard() {
    const user = await requireSession();
    if (!user) return; // already redirected

    const { data: rows, error } = await supabaseClient
        .from("conversions")
        .select("id, amount, from_currency, to_currency, result, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    loadingEl.style.display = "none";
    bodyEl.style.display = "block";

    if (error) {
        console.error("Failed to load conversion history:", error);
        emptyEl.innerText = "Couldn't load your history right now. Try refreshing.";
        emptyEl.style.display = "block";
        tableEl.style.display = "none";
        return;
    }

    currentRows = rows || [];
    renderDashboard();
}

// Redraws stats + table + empty state from the current in-memory rows.
// Called after the initial load and again after a delete, so we don't
// need a full round trip to Supabase just to reflect a removed row.
function renderDashboard() {
    if (currentRows.length === 0) {
        emptyEl.innerText = "No conversions yet. Head back to the converter and make your first one!";
        emptyEl.style.display = "block";
        tableEl.style.display = "none";
        renderStats(computeStats([]));
        return;
    }

    emptyEl.style.display = "none";
    tableEl.style.display = "table";
    renderStats(computeStats(currentRows));
    renderTable(currentRows);
}

// Delete a single conversion row (both from Supabase and from the
// in-memory list), then redraw the stats/table to reflect the removal.
async function deleteConversion(id) {
    const { error } = await supabaseClient
        .from("conversions")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Failed to delete conversion:", error);
        alert("Couldn't delete that entry. Please try again.");
        return;
    }

    currentRows = currentRows.filter((row) => row.id !== Number(id));
    renderDashboard();
}

// Event delegation: catches clicks on any .delete-btn, including ones
// added after the initial render, without re-binding listeners each time.
tableBodyEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-btn");
    if (!btn) return;

    const id = btn.dataset.id;
    if (confirm("Delete this conversion from your history?")) {
        deleteConversion(id);
    }
});

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

logoutBtn.addEventListener("click", handleLogout);

loadDashboard();
