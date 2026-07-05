import { createChart, CandlestickSeries } from "lightweight-charts";
import { renderOrderBlocks } from "./orderBlocks.js";
import "./style.css";

const OKX_BASE_URL = "https://www.okx.com";
const INST_ID = "BTC-USDT";
const POLL_MS = 12_000;
const FRESH_MS = 30_000;
const RECENT_PAGE_SIZE = 300; // OKX max per call on /market/candles
const HISTORY_PAGE_SIZE = 100; // OKX max per call on /market/history-candles
const INITIAL_CANDLE_COUNT = 1000; // depth loaded on startup / timeframe switch
const LAZY_LOAD_LOGICAL_THRESHOLD = 20; // fetch older data once this close to the left edge

const TIMEFRAMES = [
  { label: "1m", bar: "1m" },
  { label: "5m", bar: "5m" },
  { label: "15m", bar: "15m" },
  { label: "1h", bar: "1H" },
  { label: "4h", bar: "4H" },
  { label: "1D", bar: "1D" },
];

let currentBar = "1h";
let lastSuccessAt = null;
let pollTimer = null;

const chartContainer = document.getElementById("chart-container");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const lastUpdateEl = document.getElementById("last-update");
const timeframeSwitcher = document.getElementById("timeframe-switcher");

const chart = createChart(chartContainer, {
  layout: {
    background: { color: "#131722" },
    textColor: "#d1d4dc",
  },
  grid: {
    vertLines: { color: "#1e222d" },
    horzLines: { color: "#1e222d" },
  },
  timeScale: {
    timeVisible: true,
    secondsVisible: false,
  },
});

const candleSeries = chart.addSeries(CandlestickSeries, {
  upColor: "#26a69a",
  downColor: "#ef5350",
  borderVisible: false,
  wickUpColor: "#26a69a",
  wickDownColor: "#ef5350",
});

new ResizeObserver((entries) => {
  const { width, height } = entries[0].contentRect;
  chart.resize(width, height);
}).observe(chartContainer);

function renderTimeframeButtons() {
  timeframeSwitcher.innerHTML = "";
  for (const tf of TIMEFRAMES) {
    const btn = document.createElement("button");
    btn.textContent = tf.label;
    btn.className = tf.label === currentBar ? "active" : "";
    btn.addEventListener("click", () => {
      if (currentBar === tf.label) return;
      currentBar = tf.label;
      renderTimeframeButtons();
      loadInitial();
    });
    timeframeSwitcher.appendChild(btn);
  }
}

function okxBarFor(label) {
  return TIMEFRAMES.find((tf) => tf.label === label).bar;
}

// OKX-Pagination: "after" liefert Kerzen VOR diesem Timestamp (ms) — für ältere Daten.
async function fetchCandlePage(endpoint, bar, { after, limit } = {}) {
  const params = new URLSearchParams({ instId: INST_ID, bar, limit: String(limit) });
  if (after) params.set("after", after);
  const res = await fetch(`${OKX_BASE_URL}${endpoint}?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== "0") throw new Error(`OKX error ${json.code}: ${json.msg}`);
  return json.data.map((row) => ({
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
  })); // neueste zuerst
}

// Holt die letzten `count` Kerzen über mehrere Seiten von /market/candles (recent-Fenster).
async function fetchInitialCandles(bar, count) {
  let all = [];
  let after;
  while (all.length < count) {
    const page = await fetchCandlePage("/api/v5/market/candles", bar, { after, limit: RECENT_PAGE_SIZE });
    if (page.length === 0) break;
    all = all.concat(page);
    after = String(page[page.length - 1].time * 1000);
    if (page.length < RECENT_PAGE_SIZE) break;
  }
  return all.reverse(); // älteste zuerst
}

// Für Scroll-Back über das recent-Fenster hinaus: /market/history-candles.
async function fetchOlderCandles(bar, oldestLoadedTime) {
  const page = await fetchCandlePage("/api/v5/market/history-candles", bar, {
    after: String(oldestLoadedTime * 1000),
    limit: HISTORY_PAGE_SIZE,
  });
  return page.filter((c) => c.time < oldestLoadedTime).reverse(); // älteste zuerst
}

function mergeRecent(existing, freshRecent) {
  if (existing.length === 0 || freshRecent.length === 0) return freshRecent;
  const freshStart = freshRecent[0].time;
  const olderPrefix = existing.filter((c) => c.time < freshStart);
  return olderPrefix.concat(freshRecent);
}

let orderBlockPrimitives = [];
let allCandles = [];
let loadingOlder = false;
let reachedHistoryStart = false;

function refreshChart() {
  candleSeries.setData(allCandles);
  renderOrderBlocks(chart, candleSeries, allCandles, orderBlockPrimitives);
}

async function loadInitial() {
  try {
    allCandles = await fetchInitialCandles(okxBarFor(currentBar), INITIAL_CANDLE_COUNT);
    reachedHistoryStart = false;
    refreshChart();
    markSuccess();
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
  }
}

async function pollRecent() {
  try {
    const recent = (
      await fetchCandlePage("/api/v5/market/candles", okxBarFor(currentBar), { limit: RECENT_PAGE_SIZE })
    ).reverse();
    allCandles = mergeRecent(allCandles, recent);
    refreshChart();
    markSuccess();
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
  }
}

chart.timeScale().subscribeVisibleLogicalRangeChange(async (range) => {
  if (!range || loadingOlder || reachedHistoryStart || allCandles.length === 0) return;
  if (range.from > LAZY_LOAD_LOGICAL_THRESHOLD) return;

  loadingOlder = true;
  try {
    const oldest = allCandles[0].time;
    const older = await fetchOlderCandles(okxBarFor(currentBar), oldest);
    if (older.length === 0) {
      reachedHistoryStart = true;
    } else {
      allCandles = older.concat(allCandles);
      refreshChart();
    }
  } catch (err) {
    console.error("Ältere Kerzen laden fehlgeschlagen:", err);
  } finally {
    loadingOlder = false;
  }
});

function markSuccess() {
  lastSuccessAt = Date.now();
}

function updateStatusBar() {
  if (lastSuccessAt === null) {
    statusDot.className = "status-dot";
    statusText.textContent = "Verbinde...";
    lastUpdateEl.textContent = "";
    return;
  }

  const age = Date.now() - lastSuccessAt;
  const fresh = age < FRESH_MS;
  statusDot.className = `status-dot ${fresh ? "ok" : "dead"}`;
  statusText.textContent = fresh ? "Live" : "Verbindung tot";
  lastUpdateEl.textContent = `Letztes Update: ${new Date(lastSuccessAt).toLocaleTimeString("de-DE")}`;
}

renderTimeframeButtons();
loadInitial();
setInterval(pollRecent, POLL_MS);
setInterval(updateStatusBar, 1000);
updateStatusBar();
