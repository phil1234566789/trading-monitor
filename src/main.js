import { createChart, CandlestickSeries } from "lightweight-charts";
import { renderOrderBlocks } from "./orderBlocks.js";
import "./style.css";

const OKX_BASE_URL = "https://www.okx.com";
const INST_ID = "BTC-USDT";
const POLL_MS = 12_000;
const FRESH_MS = 30_000;
const CANDLE_LIMIT = 300;

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
      loadCandles();
    });
    timeframeSwitcher.appendChild(btn);
  }
}

function okxBarFor(label) {
  return TIMEFRAMES.find((tf) => tf.label === label).bar;
}

async function fetchCandles(bar) {
  const url = `${OKX_BASE_URL}/api/v5/market/candles?instId=${INST_ID}&bar=${bar}&limit=${CANDLE_LIMIT}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== "0") throw new Error(`OKX error ${json.code}: ${json.msg}`);
  return json.data
    .map((row) => ({
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
    }))
    .reverse();
}

let orderBlockPrimitives = [];

async function loadCandles() {
  try {
    const candles = await fetchCandles(okxBarFor(currentBar));
    candleSeries.setData(candles);
    renderOrderBlocks(chart, candleSeries, candles, orderBlockPrimitives);
    markSuccess();
  } catch (err) {
    console.error("Kerzen-Update fehlgeschlagen:", err);
  }
}

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
loadCandles();
setInterval(loadCandles, POLL_MS);
setInterval(updateStatusBar, 1000);
updateStatusBar();
