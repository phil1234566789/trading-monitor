import { supabase } from "./supabaseClient.js";
import "./style.css";

const INST_ID = "BTC-USDT";
const POLL_MS = 15_000;
const FRESH_MS = 30_000;

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const lastUpdateEl = document.getElementById("last-update");
const listEl = document.getElementById("protokoll-list");

let lastSuccessAt = null;

function fmtPrice(n) {
  return n == null ? "–" : n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function fmtTime(iso) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchTouchedZones() {
  const { data, error } = await supabase
    .from("ob_zones")
    .select("*")
    .eq("instrument", INST_ID)
    .eq("touched", true)
    .order("touched_at", { ascending: false, nullsFirst: false });

  if (error) throw error;
  return data;
}

function renderProtokoll(rows) {
  listEl.innerHTML = "";

  if (rows.length === 0) {
    listEl.innerHTML = '<div class="trades-empty">Noch keine erreichten POIs.</div>';
    return;
  }

  const table = document.createElement("table");
  table.className = "trades-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Erreicht am</th>
        <th>Timeframe</th>
        <th>Richtung</th>
        <th>Zone</th>
        <th>TG gesendet</th>
        <th>Trade-Signal</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((z) => {
          const direction = z.direction === "long" ? "Long" : "Short";
          return `
            <tr>
              <td>${fmtTime(z.touched_at)}</td>
              <td>${z.timeframe}</td>
              <td><span class="trade-direction ${z.direction === "long" ? "long" : "short"}">${direction}</span></td>
              <td>${fmtPrice(z.bottom)} – ${fmtPrice(z.top)}${z.weak ? " (schwach)" : ""}</td>
              <td>${z.notified_at ? "✅" : "–"}</td>
              <td class="trade-reasoning-cell">– <span class="trade-time">(folgt mit D3/Claude-Check)</span></td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
  listEl.appendChild(table);
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

async function load() {
  try {
    const rows = await fetchTouchedZones();
    renderProtokoll(rows);
    markSuccess();
  } catch (err) {
    console.error("Protokoll laden fehlgeschlagen:", err);
  }
}

load();
setInterval(load, POLL_MS);
setInterval(updateStatusBar, 1000);
updateStatusBar();
