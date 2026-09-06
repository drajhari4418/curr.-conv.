// Base API URL 
const BASE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";

// Full currency list endpoint - returns { usd: "US Dollar", eur: "Euro", ... }
// for every currency the API supports (150+).
const ALL_CURRENCIES_URL = `${BASE_URL}.json`;

// Fallback list used only if the full-list fetch fails (e.g. offline).
// Keys are lowercase to match the shape the live API returns.
const fallbackCurrencies = {
    usd: "US Dollar",
    eur: "Euro",
    gbp: "British Pound",
    inr: "Indian Rupee",
    aud: "Australian Dollar",
    cad: "Canadian Dollar",
    jpy: "Japanese Yen",
    cny: "Chinese Yuan",
    aed: "UAE Dirham"
};

// DOM Elements
const amountInput = document.getElementById("amount");
const fromSelect = document.getElementById("from-currency");
const toSelect = document.getElementById("to-currency");
const convertBtn = document.getElementById("convert-btn");
const swapBtn = document.getElementById("swap-btn");
const resultText = document.getElementById("result-text");

// Fill both dropdowns from a { code: name } map, sorted alphabetically by code
function fillDropdowns(currencyMap) {
    fromSelect.innerHTML = "";
    toSelect.innerHTML = "";

    const sortedCodes = Object.keys(currencyMap).sort();

    sortedCodes.forEach(code => {
        const upperCode = code.toUpperCase();
        const label = `${upperCode} - ${currencyMap[code]}`;

        fromSelect.add(new Option(label, upperCode));
        toSelect.add(new Option(label, upperCode));
    });

    // Set standard default selections (fall back gracefully if not present)
    fromSelect.value = sortedCodes.includes("usd") ? "USD" : sortedCodes[0].toUpperCase();
    toSelect.value = sortedCodes.includes("inr") ? "INR" : sortedCodes[1]?.toUpperCase() || sortedCodes[0].toUpperCase();
}

// Fetch the full list of supported currencies from the API and populate the
// dropdowns with all of them. Falls back to a small hardcoded list if the
// fetch fails (e.g. no internet), so the app still works.
async function populateDropdowns() {
    convertBtn.disabled = true;
    resultText.innerText = "Loading currency list...";

    try {
        const response = await fetch(ALL_CURRENCIES_URL);
        if (!response.ok) throw new Error("Failed to fetch currency list.");

        const allCurrencies = await response.json(); // e.g. { usd: "US Dollar", ... }
        fillDropdowns(allCurrencies);
    } catch (error) {
        console.warn("Falling back to default currency list:", error);
        fillDropdowns(fallbackCurrencies);
    } finally {
        convertBtn.disabled = false;
    }
}

// Fire-and-forget: save a completed conversion to the user's history.
// Never blocks or breaks the UI if it fails (e.g. offline, RLS issue) -
// history logging is a bonus feature, not core functionality.
async function logConversion(amount, fromCurr, toCurr, result) {
    try {
        const { data: userData } = await supabaseClient.auth.getUser();
        const user = userData?.user;
        if (!user) return; // not logged in somehow, skip silently

        const { error } = await supabaseClient.from("conversions").insert({
            user_id: user.id,
            amount: amount,
            from_currency: fromCurr.toUpperCase(),
            to_currency: toCurr.toUpperCase(),
            result: parseFloat(result)
        });

        if (error) {
            console.warn("Could not log conversion to history:", error.message);
        }
    } catch (err) {
        console.warn("Could not log conversion to history:", err);
    }
}

// Perform calculation business logic
async function convertCurrency() {
    const amount = parseFloat(amountInput.value);
    const fromCurr = fromSelect.value.toLowerCase();
    const toCurr = toSelect.value.toLowerCase();

    // Validation guard clause
    if (isNaN(amount) || amount <= 0) {
        resultText.innerText = "Please enter a valid amount.";
        return;
    }

    resultText.innerText = "Converting...";

    try {
        // Fetch target rates relative to base currency
        const response = await fetch(`${BASE_URL}/${fromCurr}.json`);
        if (!response.ok) throw new Error("Network response encountered problems.");
        
        const data = await response.json();
        const rate = data[fromCurr][toCurr];
        
        const total = (amount * rate).toFixed(2);
        
        resultText.innerText = `${amount} ${fromCurr.toUpperCase()} = ${total} ${toCurr.toUpperCase()}`;

        // Save to history (non-blocking)
        logConversion(amount, fromCurr, toCurr, total);
    } catch (error) {
        console.error("Error fetching data: ", error);
        resultText.innerText = "Error loading exchange rates. Try again.";
    }
}

// Add event handlers
swapBtn.addEventListener("click", () => {
    const temp = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = temp;
    convertCurrency();
});

convertBtn.addEventListener("click", (e) => {
    e.preventDefault();
    convertCurrency();
});

// App Initialization
// Wait for the dropdowns to be fully populated before running the first
// conversion, since convertCurrency() depends on fromSelect/toSelect
// already having values.
async function initApp() {
    await populateDropdowns();
    convertCurrency();
}

initApp();
