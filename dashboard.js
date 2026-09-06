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
        `;
        tableBodyEl.appendChild(tr);
    });
}

async function loadDashboard() {
    const user = await requireSession();
    if (!user) return; // already redirected

    const { data: rows, error } = await supabaseClient
        .from("conversions")
        .select("amount, from_currency, to_currency, result, created_at")
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

    if (!rows || rows.length === 0) {
        emptyEl.style.display = "block";
        tableEl.style.display = "none";
        renderStats(computeStats([]));
        return;
    }

    renderStats(computeStats(rows));
    renderTable(rows);
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

logoutBtn.addEventListener("click", handleLogout);

loadDashboard();
