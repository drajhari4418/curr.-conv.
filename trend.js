// ====== AI-style trend forecasting (linear regression) ======
// Fetches the last 7 days of historical exchange rates for the selected
// currency pair, fits a simple linear regression line through them, and
// uses it to predict tomorrow's likely direction and value.
//
// This is a genuine (if simple) ML technique - least-squares linear
// regression - run entirely in the browser, so no external AI API key or
// backend is needed. It is a naive trend extrapolation, not a real
// financial forecasting model, and is presented to the user as such.

const trendBtn = document.getElementById("trend-btn");
const trendPanel = document.getElementById("trend-panel");
const trendLabel = document.getElementById("trend-label");
const trendChange = document.getElementById("trend-change");
const trendForecast = document.getElementById("trend-forecast");
const trendSparkline = document.getElementById("trend-sparkline");
const trendError = document.getElementById("trend-error");

const TREND_DAYS = 7; // how many past days of history to pull

// Historical endpoint: same API, but pinned to a specific past date
// instead of "@latest".
function historicalUrl(dateStr, fromCurr) {
    return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/${fromCurr}.json`;
}

// Returns an array of YYYY-MM-DD strings for the last `days` days,
// oldest first, ending yesterday (today's dated snapshot may not be
// published yet, so "today" is fetched separately via @latest).
function pastDateStrings(days) {
    const dates = [];
    for (let i = days; i >= 1; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

// Fetch one historical rate; returns null (instead of throwing) on
// failure so a single missing day doesn't break the whole trend.
async function fetchRateForDate(dateStr, fromCurr, toCurr) {
    try {
        const res = await fetch(historicalUrl(dateStr, fromCurr));
        if (!res.ok) return null;
        const data = await res.json();
        return data?.[fromCurr]?.[toCurr] ?? null;
    } catch {
        return null;
    }
}

// Simple least-squares linear regression over points (0,y0), (1,y1)...
// Returns { slope, intercept, predict(x) }.
function linearRegression(values) {
    const n = values.length;
    const xs = values.map((_, i) => i);
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumXX = xs.reduce((sum, x) => sum + x * x, 0);

    const denom = n * sumXX - sumX * sumX;
    const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    return {
        slope,
        intercept,
        predict: (x) => intercept + slope * x
    };
}

// Builds a small SVG sparkline (polyline) from the rate values.
function renderSparkline(values) {
    const width = 300;
    const height = 80;
    const padding = 6;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1; // avoid divide-by-zero if all values equal

    const points = values.map((v, i) => {
        const x = padding + (i / (values.length - 1)) * (width - padding * 2);
        const y = height - padding - ((v - min) / range) * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    trendSparkline.setAttribute("viewBox", `0 0 ${width} ${height}`);
    trendSparkline.innerHTML = `
        <polyline points="${points.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="${points[points.length - 1].split(",")[0]}" cy="${points[points.length - 1].split(",")[1]}" r="4" fill="var(--accent)" />
    `;
}

async function showTrend() {
    const fromCurr = fromSelect.value.toLowerCase();
    const toCurr = toSelect.value.toLowerCase();

    trendError.style.display = "none";
    trendPanel.style.display = "none";
    trendBtn.disabled = true;
    trendBtn.innerText = "Loading trend...";

    try {
        const dateStrings = pastDateStrings(TREND_DAYS);

        // Fetch all past days in parallel, then today's live rate via @latest
        const historicalResults = await Promise.all(
            dateStrings.map((d) => fetchRateForDate(d, fromCurr, toCurr))
        );

        const todayResponse = await fetch(`${BASE_URL}/${fromCurr}.json`);
        const todayData = await todayResponse.json();
        const todayRate = todayData?.[fromCurr]?.[toCurr] ?? null;

        // Combine, dropping any days that failed to fetch
        const rates = [...historicalResults, todayRate].filter((r) => r !== null && r !== undefined);

        if (rates.length < 3) {
            throw new Error("Not enough historical data for this pair.");
        }

        const regression = linearRegression(rates);
        const predictedNext = regression.predict(rates.length);
        const percentChange = ((rates[rates.length - 1] - rates[0]) / rates[0]) * 100;

        const DIRECTION_EPSILON = 0.0005; // ignore near-zero slope as "stable"
        let directionLabel;
        if (regression.slope > DIRECTION_EPSILON) {
            directionLabel = "📈 Rising";
        } else if (regression.slope < -DIRECTION_EPSILON) {
            directionLabel = "📉 Falling";
        } else {
            directionLabel = "➖ Stable";
        }

        trendLabel.innerText = `${fromCurr.toUpperCase()} → ${toCurr.toUpperCase()}: ${directionLabel}`;
        trendChange.innerText = `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}% over ${rates.length} days`;
        trendForecast.innerText = `Forecast: 1 ${fromCurr.toUpperCase()} ≈ ${predictedNext.toFixed(4)} ${toCurr.toUpperCase()} tomorrow, based on the recent trend.`;

        renderSparkline(rates);
        trendPanel.style.display = "block";
    } catch (error) {
        console.error("Trend fetch failed:", error);
        trendError.innerText = "Couldn't load trend data for this pair. Try a different currency or try again shortly.";
        trendError.style.display = "block";
    } finally {
        trendBtn.disabled = false;
        trendBtn.innerText = "📈 Show Trend & Forecast";
    }
}

trendBtn.addEventListener("click", showTrend);
