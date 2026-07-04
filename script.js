// Base API URL 
const BASE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";

// Popular currencies to populate selectors
const popularCurrencies = {
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    INR: "Indian Rupee",
    AUD: "Australian Dollar",
    CAD: "Canadian Dollar",
    JPY: "Japanese Yen",
    CNY: "Chinese Yuan",
    AED: "UAE Dirham"
};

// DOM Elements
const amountInput = document.getElementById("amount");
const fromSelect = document.getElementById("from-currency");
const toSelect = document.getElementById("to-currency");
const convertBtn = document.getElementById("convert-btn");
const swapBtn = document.getElementById("swap-btn");
const resultText = document.getElementById("result-text");

// Populate standard dropdown list options
function populateDropdowns() {
    Object.keys(popularCurrencies).forEach(currencyCode => {
        const optionFrom = new Option(`${currencyCode} - ${popularCurrencies[currencyCode]}`, currencyCode);
        const optionTo = new Option(`${currencyCode} - ${popularCurrencies[currencyCode]}`, currencyCode);
        
        fromSelect.add(optionFrom);
        toSelect.add(optionTo);
    });

    // Set standard default selections
    fromSelect.value = "USD";
    toSelect.value = "INR";
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
populateDropdowns();
window.addEventListener("load", convertCurrency);