// ====== AI-based rate forecasting (neural network, TensorFlow.js) ======
// Fetches recent historical exchange rates for the selected currency pair,
// then builds and trains a small feedforward neural network - entirely in
// the browser, using TensorFlow.js - to predict the next day's rate from
// a sliding window of recent days.
//
// This is a real (if intentionally small/simple) machine learning model:
// it has trainable weights, a loss function, and is optimized via
// gradient descent (Adam) on each run. No external AI API or backend is
// used - the "AI" runs entirely client-side.

const trendBtn = document.getElementById("trend-btn");
const trendStatus = document.getElementById("trend-status");
const trendPanel = document.getElementById("trend-panel");
const trendLabel = document.getElementById("trend-label");
const trendChange = document.getElementById("trend-change");
const trendForecast = document.getElementById("trend-forecast");
const trendSparkline = document.getElementById("trend-sparkline");
const trendError = document.getElementById("trend-error");

const HISTORY_DAYS = 30;   // how many past days of rates to pull for training data
const WINDOW_SIZE = 5;     // the model looks at the last 5 days to predict the 6th
const FORECAST_DAYS = 3;   // how many days ahead to roll the forecast forward
const EPOCHS = 150;        // training iterations per run

// Historical endpoint: same currency API, pinned to a specific past date
// instead of "@latest".
function historicalUrl(dateStr, fromCurr) {
    return `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/${fromCurr}.json`;
}

// Returns an array of YYYY-MM-DD strings for the last `days` days, oldest
// first, ending yesterday (today's dated snapshot may not be published
// yet, so "today" is fetched separately via @latest).
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
// failure so a single missing day doesn't break the whole dataset.
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

// Pulls together HISTORY_DAYS of past rates plus today's live rate.
async function collectRateHistory(fromCurr, toCurr) {
    const dateStrings = pastDateStrings(HISTORY_DAYS);

    const historicalResults = await Promise.all(
        dateStrings.map((d) => fetchRateForDate(d, fromCurr, toCurr))
    );

    const todayResponse = await fetch(`${BASE_URL}/${fromCurr}.json`);
    const todayData = await todayResponse.json();
    const todayRate = todayData?.[fromCurr]?.[toCurr] ?? null;

    return [...historicalResults, todayRate].filter((r) => r !== null && r !== undefined);
}

// Turns a flat array of rates into sliding-window training examples:
// each input is WINDOW_SIZE consecutive rates, each label is the rate
// immediately after that window. This lets a small dataset (~25-30
// points) produce enough overlapping examples to actually train on.
function buildTrainingWindows(rates) {
    const inputs = [];
    const labels = [];
    for (let i = 0; i + WINDOW_SIZE < rates.length; i++) {
        inputs.push(rates.slice(i, i + WINDOW_SIZE));
        labels.push(rates[i + WINDOW_SIZE]);
    }
    return { inputs, labels };
}

// Min-max normalization to [0, 1] - neural networks train far more
// reliably on small, uniformly-scaled inputs than on raw exchange rates
// (which might be 0.01 or 1500 depending on the currency pair).
function normalize(values, min, max) {
    const range = max - min || 1;
    return values.map((v) => (v - min) / range);
}

function denormalize(value, min, max) {
    const range = max - min || 1;
    return value * range + min;
}

// Builds and trains a small feedforward neural network:
// WINDOW_SIZE inputs -> 8 hidden units (relu) -> 8 hidden units (relu) -> 1 output (linear).
// Trained fresh on every click using the just-fetched data, so it always
// reflects the latest available history.
async function trainModel(inputs, labels) {
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [WINDOW_SIZE], units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 8, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "linear" }));

    model.compile({ optimizer: tf.train.adam(0.05), loss: "meanSquaredError" });

    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    await model.fit(xs, ys, {
        epochs: EPOCHS,
        verbose: 0,
        callbacks: {
            onEpochEnd: (epoch) => {
                if (epoch % 30 === 0) {
                    trendStatus.innerText = `Training neural network... (epoch ${epoch}/${EPOCHS})`;
                }
            }
        }
    });

    xs.dispose();
    ys.dispose();

    return model;
}

// Rolls the trained model forward FORECAST_DAYS steps: predict the next
// value, append it to the window, drop the oldest value, repeat. This is
// how the model produces a short multi-day forecast rather than just a
// single next-day number.
function rollForecast(model, lastWindowNormalized, min, max, steps) {
    let window = [...lastWindowNormalized];
    const forecastsNormalized = [];

    for (let i = 0; i < steps; i++) {
        const inputTensor = tf.tensor2d([window]);
        const predictionTensor = model.predict(inputTensor);
        const predicted = predictionTensor.dataSync()[0];

        inputTensor.dispose();
        predictionTensor.dispose();

        forecastsNormalized.push(predicted);
        window = [...window.slice(1), predicted];
    }

    return forecastsNormalized.map((v) => denormalize(v, min, max));
}

// Builds a small SVG sparkline: solid line for actual history, dashed
// line continuing it for the forecasted days.
function renderSparkline(actualRates, forecastRates) {
    const width = 300;
    const height = 80;
    const padding = 6;

    const all = [...actualRates, ...forecastRates];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const range = max - min || 1;

    const totalPoints = all.length;
    const toXY = (v, i) => {
        const x = padding + (i / (totalPoints - 1)) * (width - padding * 2);
        const y = height - padding - ((v - min) / range) * (height - padding * 2);
        return [x, y];
    };

    const actualPoints = actualRates.map((v, i) => toXY(v, i));
    const forecastPoints = [actualPoints[actualPoints.length - 1], ...forecastRates.map((v, i) => toXY(v, i + actualRates.length))];

    const toPointsAttr = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const last = forecastPoints[forecastPoints.length - 1];

    trendSparkline.setAttribute("viewBox", `0 0 ${width} ${height}`);
    trendSparkline.innerHTML = `
        <polyline points="${toPointsAttr(actualPoints)}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <polyline points="${toPointsAttr(forecastPoints)}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="5,4" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
        <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4" fill="var(--accent)" />
    `;
}

async function showTrend() {
    const fromCurr = fromSelect.value.toLowerCase();
    const toCurr = toSelect.value.toLowerCase();

    trendError.style.display = "none";
    trendPanel.style.display = "none";
    trendStatus.style.display = "block";
    trendStatus.innerText = "Fetching historical rates...";
    trendBtn.disabled = true;
    trendBtn.innerText = "Working...";

    try {
        const rates = await collectRateHistory(fromCurr, toCurr);

        if (rates.length < WINDOW_SIZE + 3) {
            throw new Error("Not enough historical data for this pair.");
        }

        const min = Math.min(...rates);
        const max = Math.max(...rates);
        const normalizedRates = normalize(rates, min, max);

        const { inputs, labels } = buildTrainingWindows(normalizedRates);

        trendStatus.innerText = "Training neural network...";
        const model = await trainModel(inputs, labels);

        const lastWindow = normalizedRates.slice(-WINDOW_SIZE);
        const forecastRates = rollForecast(model, lastWindow, min, max, FORECAST_DAYS);

        model.dispose();

        const lastActual = rates[rates.length - 1];
        const predictedNext = forecastRates[0];
        const percentChange = ((predictedNext - lastActual) / lastActual) * 100;

        const DIRECTION_EPSILON = 0.05; // percent - ignore near-zero moves as "stable"
        let directionLabel;
        if (percentChange > DIRECTION_EPSILON) {
            directionLabel = "📈 Rising";
        } else if (percentChange < -DIRECTION_EPSILON) {
            directionLabel = "📉 Falling";
        } else {
            directionLabel = "➖ Stable";
        }

        trendLabel.innerText = `${fromCurr.toUpperCase()} → ${toCurr.toUpperCase()}: ${directionLabel}`;
        trendChange.innerText = `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(2)}% predicted`;
        trendForecast.innerText = `AI forecast: 1 ${fromCurr.toUpperCase()} ≈ ${predictedNext.toFixed(4)} ${toCurr.toUpperCase()} tomorrow (trained on ${rates.length} days of history).`;

        renderSparkline(rates, forecastRates);
        trendStatus.style.display = "none";
        trendPanel.style.display = "block";
    } catch (error) {
        console.error("AI forecast failed:", error);
        trendStatus.style.display = "none";
        trendError.innerText = "Couldn't generate a forecast for this pair. Try a different currency or try again shortly.";
        trendError.style.display = "block";
    } finally {
        trendBtn.disabled = false;
        trendBtn.innerText = "🧠 Train AI Model & Forecast";
    }
}

trendBtn.addEventListener("click", showTrend);
