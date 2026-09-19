// ====== 30-day trend & forecast ======
// Fetches the last 30 days of daily rates for the selected currency pair
// (the jsDelivr API publishes one snapshot per day, addressable by date),
// fits a straight trend line through them, and extends that line forward.
//
// This is a simple linear-trend extrapolation, NOT a real market prediction -
// exchange rates move on news, interest rates, etc., which a trend line can't see.
//
// Change these two numbers to adjust the window:
const HISTORY_DAYS = 30;   // how many past days to fetch
const FORECAST_DAYS = 7;   // how many days ahead to project

const HISTORY_PRIMARY = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@";
const forecastCache = new Map(); // "usd_inr" -> history points, so repeat clicks are instant

/* ---------- data ---------- */

function toISODate(d) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

// One day's rate, with the Cloudflare fallback the API docs recommend
async function fetchDailyRate(dateStr, from, to) {
    const urls = [
        `${HISTORY_PRIMARY}${dateStr}/v1/currencies/${from}.min.json`,
        `https://${dateStr}.currency-api.pages.dev/v1/currencies/${from}.min.json`
    ];

    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (!res.ok) continue;
            const data = await res.json();
            const rate = data && data[from] && data[from][to];
            if (typeof rate === "number" && rate > 0) return rate;
        } catch (e) {
            // try the next URL
        }
    }
    throw new Error("No rate for " + dateStr);
}

// Returns [{ day, date, rate }, ...] for the last HISTORY_DAYS completed days.
// `day` is 0..HISTORY_DAYS-1 so missing days leave gaps instead of shifting the trend.
async function fetchHistory(from, to) {
    const key = `${from}_${to}_${toISODate(new Date())}`;
    if (forecastCache.has(key)) return forecastCache.get(key);

    const now = new Date();
    const dates = [];
    for (let i = HISTORY_DAYS; i >= 1; i--) {
        dates.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)));
    }

    const results = await Promise.allSettled(
        dates.map((d) => fetchDailyRate(toISODate(d), from, to))
    );

    const points = [];
    results.forEach((r, i) => {
        if (r.status === "fulfilled") points.push({ day: i, date: dates[i], rate: r.value });
    });

    forecastCache.set(key, points);
    return points;
}

/* ---------- maths ---------- */

// Least-squares line through (day, rate). Also returns the residual standard
// deviation, used as the "typical swing" around the trend.
function linearRegression(points) {
    const n = points.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    points.forEach((p) => {
        sx += p.day;
        sy += p.rate;
        sxy += p.day * p.rate;
        sxx += p.day * p.day;
    });

    const denom = n * sxx - sx * sx;
    const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / n;

    let sse = 0;
    points.forEach((p) => {
        const err = p.rate - (intercept + slope * p.day);
        sse += err * err;
    });
    const sd = n > 2 ? Math.sqrt(sse / (n - 2)) : 0;

    return { slope, intercept, sd };
}

// Project the fitted line FORECAST_DAYS past the last history day
function buildForecast(model, lastDate) {
    const out = [];
    for (let k = 1; k <= FORECAST_DAYS; k++) {
        const day = HISTORY_DAYS - 1 + k;
        const date = new Date(lastDate.getTime() + k * 24 * 60 * 60 * 1000);
        out.push({ day, date, rate: Math.max(0, model.intercept + model.slope * day) });
    }
    return out;
}

/* ---------- formatting ---------- */

function fmtRate(v) {
    if (v >= 100) return v.toFixed(2);
    if (v >= 1) return v.toFixed(4);
    return v.toPrecision(4);
}

function fmtAmount(v) {
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtShortDate(d) {
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

function fmtPercent(v) {
    return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
}

/* ---------- chart (inline SVG, colors come from CSS variables) ---------- */

function buildChartSvg(history, forecast, sd) {
    const W = 640, H = 260, L = 62, R = 14, T = 14, B = 30;
    const totalDays = HISTORY_DAYS + FORECAST_DAYS;

    const values = history.map((p) => p.rate)
        .concat(forecast.map((p) => p.rate + sd))
        .concat(forecast.map((p) => Math.max(0, p.rate - sd)));
    let min = Math.min(...values);
    let max = Math.max(...values);
    const pad = (max - min) * 0.1 || max * 0.01 || 1;
    min = Math.max(0, min - pad);
    max = max + pad;

    const x = (day) => L + (day / (totalDays - 1)) * (W - L - R);
    const y = (v) => T + (1 - (v - min) / (max - min)) * (H - T - B);
    const pt = (p, v) => `${x(p.day).toFixed(1)},${y(v === undefined ? p.rate : v).toFixed(1)}`;

    const last = history[history.length - 1];

    const historyPath = "M" + history.map((p) => pt(p)).join(" L");
    const forecastPath = `M${pt(last)} L` + forecast.map((p) => pt(p)).join(" L");
    const bandPath =
        `M${pt(last)} L` +
        forecast.map((p) => pt(p, p.rate + sd)).join(" L") + " L" +
        forecast.slice().reverse().map((p) => pt(p, Math.max(0, p.rate - sd))).join(" L") + " Z";

    // horizontal grid + y labels
    let grid = "";
    for (let i = 0; i <= 3; i++) {
        const v = min + ((max - min) * i) / 3;
        const yy = y(v).toFixed(1);
        grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>`;
        grid += `<text class="axis-label" x="${L - 8}" y="${(+yy + 4).toFixed(1)}" text-anchor="end">${fmtRate(v)}</text>`;
    }

    // x labels: first day, last real day, last forecast day
    const lastForecast = forecast[forecast.length - 1];
    const xLabels =
        `<text class="axis-label" x="${x(history[0].day).toFixed(1)}" y="${H - 8}" text-anchor="start">${fmtShortDate(history[0].date)}</text>` +
        `<text class="axis-label" x="${x(last.day).toFixed(1)}" y="${H - 8}" text-anchor="middle">${fmtShortDate(last.date)}</text>` +
        `<text class="axis-label" x="${x(lastForecast.day).toFixed(1)}" y="${H - 8}" text-anchor="end">${fmtShortDate(lastForecast.date)}</text>`;

    const divider = `<line class="divider" x1="${x(last.day).toFixed(1)}" x2="${x(last.day).toFixed(1)}" y1="${T}" y2="${H - B}"/>`;

    return `<svg class="forecast-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Exchange rate for the last ${HISTORY_DAYS} days with a ${FORECAST_DAYS}-day trend forecast">
        ${grid}
        ${divider}
        <path class="band" d="${bandPath}"/>
        <path class="line-history" d="${historyPath}"/>
        <path class="line-forecast" d="${forecastPath}"/>
        ${xLabels}
    </svg>`;
}

function statCard(value, label) {
    return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

/* ---------- wiring ---------- */

function initForecast() {
    const box = document.getElementById("forecast-box");
    if (!box) return; // not on this page

    const statusEl = document.getElementById("forecast-status");
    const chartEl = document.getElementById("forecast-chart");
    const summaryEl = document.getElementById("forecast-summary");
    const detailsEl = document.getElementById("forecast-details");

    const fromEl = document.getElementById("from-currency");
    const toEl = document.getElementById("to-currency");
    const amountEl = document.getElementById("amount");
    const convertEl = document.getElementById("convert-btn");
    const swapEl = document.getElementById("swap-btn");

    // Bumped on every run/hide so a slow, older request can't overwrite a newer one
    let latestRequest = 0;

    function clearResults() {
        chartEl.innerHTML = "";
        summaryEl.innerHTML = "";
        detailsEl.style.display = "none";
    }

    function hideForecast() {
        latestRequest++;
        box.style.display = "none";
        clearResults();
    }

    async function runForecast() {
        const requestId = ++latestRequest;
        const from = fromEl.value.toLowerCase();
        const to = toEl.value.toLowerCase();
        const amount = parseFloat(amountEl.value);

        // Invalid amount: the converter already shows its own error, so no forecast
        if (isNaN(amount) || amount <= 0) {
            hideForecast();
            return;
        }

        box.style.display = "block";
        clearResults();

        if (from === to) {
            statusEl.innerText = "Pick two different currencies to see a trend.";
            return;
        }

        statusEl.innerText = `Loading the last ${HISTORY_DAYS} days of ${from.toUpperCase()} → ${to.toUpperCase()} rates...`;

        try {
            const history = await fetchHistory(from, to);
            if (requestId !== latestRequest) return; // pair changed or Convert clicked again meanwhile

            if (history.length < 8) {
                statusEl.innerText = "Not enough historical data for this pair to draw a trend.";
                return;
            }

            const model = linearRegression(history);
            const last = history[history.length - 1];
            const forecast = buildForecast(model, last.date);
            const first = history[0];
            const predicted = forecast[forecast.length - 1];

            const pastChange = ((last.rate - first.rate) / first.rate) * 100;
            const futureChange = ((predicted.rate - last.rate) / last.rate) * 100;

            statusEl.innerText = `${from.toUpperCase()} → ${to.toUpperCase()} · last ${history.length} days + ${FORECAST_DAYS}-day forecast`;
            chartEl.innerHTML = buildChartSvg(history, forecast, model.sd);

            summaryEl.innerHTML =
                statCard(fmtPercent(pastChange), `Change over ${HISTORY_DAYS} days`) +
                statCard(fmtRate(last.rate), `Latest rate (${fmtShortDate(last.date)})`) +
                statCard(fmtRate(predicted.rate), `Forecast on ${fmtShortDate(predicted.date)} (${fmtPercent(futureChange)})`) +
                statCard(fmtAmount(amount * predicted.rate), `${fmtAmount(amount)} ${from.toUpperCase()} then, in ${to.toUpperCase()}`);

            detailsEl.style.display = "block";
        } catch (err) {
            if (requestId !== latestRequest) return;
            console.error("Forecast failed:", err);
            statusEl.innerText = "Couldn't load historical rates. Check your connection and try again.";
        }
    }

    // Convert and Swap both run a conversion, so both refresh the forecast.
    // (script.js registers its handlers first, so the selects already hold
    // their final values by the time these run.)
    convertEl.addEventListener("click", runForecast);
    swapEl.addEventListener("click", runForecast);

    // Changing a dropdown makes the old chart wrong - hide it until Convert is clicked
    fromEl.addEventListener("change", hideForecast);
    toEl.addEventListener("change", hideForecast);
}

initForecast();
