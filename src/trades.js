import { supabase } from "./supabaseClient.js";

const OUTCOME_LABEL = {
  win: "Win",
  loss: "Loss",
  open: "Offen",
  invalid: "Ungültig",
};

function fmtPrice(n) {
  return n == null ? "–" : n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function fmtTime(unixSeconds) {
  if (unixSeconds == null) return "–";
  return new Date(unixSeconds * 1000).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtR(r) {
  return r != null ? `${r >= 0 ? "+" : ""}${r.toFixed(2)}R` : "–";
}

export function renderTradesPanel(containerEl, trades) {
  containerEl.innerHTML = "";

  if (trades.length === 0) {
    containerEl.innerHTML = '<div class="trades-empty">Noch keine Trades.</div>';
    return;
  }

  const table = document.createElement("table");
  table.className = "trades-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Richtung</th>
        <th>Entry</th>
        <th>SL</th>
        <th>TP</th>
        <th>Exit</th>
        <th>Ergebnis</th>
        <th>Begründung</th>
      </tr>
    </thead>
    <tbody>
      ${trades
        .map((t) => {
          const outcomeLabel = t.outcome ? OUTCOME_LABEL[t.outcome] ?? t.outcome : "Offen";
          return `
            <tr>
              <td><span class="trade-direction ${t.direction}">${t.direction === "short" ? "Short" : "Long"}</span></td>
              <td>${fmtPrice(t.entryPrice)}<br><span class="trade-time">${fmtTime(t.entryTime)}</span></td>
              <td>${fmtPrice(t.stopLoss)}</td>
              <td>${fmtPrice(t.takeProfit)}</td>
              <td>${t.exitPrice != null ? `${fmtPrice(t.exitPrice)}<br><span class="trade-time">${fmtTime(t.exitTime)}</span>` : "–"}</td>
              <td><span class="trade-outcome ${t.outcome ?? "open"}">${outcomeLabel}</span> · ${fmtR(t.rMultiple)}</td>
              <td class="trade-reasoning-cell">${t.reasoning ?? ""}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
  containerEl.appendChild(table);
}

export function computeTradeStats(trades) {
  const closed = trades.filter((t) => t.outcome === "win" || t.outcome === "loss");
  const wins = closed.filter((t) => t.outcome === "win").length;
  const losses = closed.filter((t) => t.outcome === "loss").length;
  const totalR = closed.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const winrate = closed.length > 0 ? (wins / closed.length) * 100 : null;
  const avgR = closed.length > 0 ? totalR / closed.length : null;

  return { total: trades.length, closed: closed.length, wins, losses, totalR, winrate, avgR };
}

export function renderTradeStats(containerEl, trades) {
  const s = computeTradeStats(trades);
  const pnlClass = s.totalR > 0 ? "positive" : s.totalR < 0 ? "negative" : "";
  const winrateClass = s.winrate != null && s.winrate >= 50 ? "positive" : s.winrate != null ? "negative" : "";

  containerEl.innerHTML = `
    <div class="stat-item">
      <span class="stat-label">Trades</span>
      <span class="stat-value">${s.total}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Wins / Losses</span>
      <span class="stat-value">${s.wins} / ${s.losses}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Winrate</span>
      <span class="stat-value ${winrateClass}">${s.winrate != null ? s.winrate.toFixed(0) + "%" : "–"}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">PnL (R)</span>
      <span class="stat-value ${pnlClass}">${s.totalR ? fmtR(s.totalR) : "–"}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Ø R / Trade</span>
      <span class="stat-value">${fmtR(s.avgR)}</span>
    </div>
  `;
}

export async function fetchTrades(instrument) {
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("instrument", instrument)
    .order("triggered_at", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    direction: row.direction,
    entryTime: Math.floor(new Date(row.triggered_at).getTime() / 1000),
    entryPrice: row.entry_price,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    exitTime: row.exit_time ? Math.floor(new Date(row.exit_time).getTime() / 1000) : null,
    exitPrice: row.exit_price,
    outcome: row.outcome,
    rMultiple: row.r_multiple,
    reasoning: row.reasoning,
    source: row.source,
  }));
}
