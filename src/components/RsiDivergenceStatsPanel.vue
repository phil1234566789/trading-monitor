<script setup>
// RSI-Divergenz-Statistik (Chat 2026-08-11, vierte Runde: "ich denke wir wären jetzt bereit für
// statistik") — reine Anzeige-Komponente, bekommt die bereits mit classifyDivergenceOutcome()
// angereicherte Liste fertig von PriceChart.vue (refreshRsiDivergenceInternal) rein, rechnet hier
// nur noch die Aggregat-Werte. Gleiche "wir basteln noch" Einordnung wie rsiDivergenceOutcome.js
// selbst (siehe dortiger Kommentar) — Outcome/Lookforward sind experimentell, dieses Panel zeigt
// nur, was schon da ist.
import { computed } from "vue";
import { fmtPrice, fmtDateTime, pricePrecisionForInstrument } from "../format.js";

const props = defineProps({
  divergences: { type: Array, default: () => [] },
  lookbackBars: { type: Number, required: true },
  lookforwardBars: { type: Number, required: true },
  instrument: { type: String, required: true },
});
const emit = defineEmits(["select"]);

const precision = computed(() => pricePrecisionForInstrument(props.instrument));

// Neueste zuerst — beim Review interessiert primär "was ist gerade/zuletzt passiert", nicht die
// älteste Historie oben.
const sortedDivergences = computed(() => [...props.divergences].sort((a, b) => b.toTime - a.toTime));

const OUTCOME_LABEL = { hit: "Hit", miss: "Miss", pending: "Pending", unknown: "?" };

function outcomeLabel(d) {
  if (d.outcome === "hit") return `Hit (${d.barsToBreak} Bars)`;
  return OUTCOME_LABEL[d.outcome] ?? "?";
}

const stats = computed(() => {
  const list = props.divergences;
  const total = list.length;
  const bearishCount = list.filter((d) => d.type === "bearish").length;
  const bullishCount = total - bearishCount;
  const hits = list.filter((d) => d.outcome === "hit");
  const misses = list.filter((d) => d.outcome === "miss");
  const pendingCount = list.filter((d) => d.outcome === "pending").length;
  const decided = hits.length + misses.length;
  const avgBarsToBreak = hits.length > 0 ? hits.reduce((sum, d) => sum + (d.barsToBreak ?? 0), 0) / hits.length : null;
  const avgRsiDelta = total > 0 ? list.reduce((sum, d) => sum + Math.abs((d.fromRsi ?? 0) - (d.toRsi ?? 0)), 0) / total : null;
  return {
    total,
    bearishCount,
    bullishCount,
    hitCount: hits.length,
    missCount: misses.length,
    pendingCount,
    unknownCount: total - hits.length - misses.length - pendingCount,
    hitRate: decided > 0 ? hits.length / decided : null,
    avgBarsToBreak,
    avgRsiDelta,
  };
});
</script>

<template>
  <div class="rsi-stats-panel">
    <p class="rsi-stats-params">
      Lookback (Referenz-Suche): <strong>{{ lookbackBars }} Bars</strong> · Lookforward (Outcome, experimentell):
      <strong>{{ lookforwardBars }} Bars</strong>
    </p>

    <div v-if="stats.total === 0" class="rsi-stats-empty">Keine Divergenzen im Chart sichtbar (Divergenz- bzw. Historie-Toggle prüfen).</div>

    <template v-else>
      <div class="rsi-stats-summary">
        <div class="rsi-stat-box">
          <span class="rsi-stat-value">{{ stats.total }}</span>
          <span class="rsi-stat-label">Gesamt ({{ stats.bearishCount }} ▽ / {{ stats.bullishCount }} △)</span>
        </div>
        <div class="rsi-stat-box">
          <span class="rsi-stat-value">{{ stats.hitRate != null ? Math.round(stats.hitRate * 100) + "%" : "–" }}</span>
          <span class="rsi-stat-label">Hit-Rate ({{ stats.hitCount }} Hit / {{ stats.missCount }} Miss)</span>
        </div>
        <div class="rsi-stat-box">
          <span class="rsi-stat-value">{{ stats.avgBarsToBreak != null ? stats.avgBarsToBreak.toFixed(1) : "–" }}</span>
          <span class="rsi-stat-label">Ø Bars bis Bruch (nur Hits)</span>
        </div>
        <div class="rsi-stat-box">
          <span class="rsi-stat-value">{{ stats.avgRsiDelta != null ? stats.avgRsiDelta.toFixed(1) : "–" }}</span>
          <span class="rsi-stat-label">Ø RSI-Delta</span>
        </div>
        <div class="rsi-stat-box">
          <span class="rsi-stat-value">{{ stats.pendingCount }}</span>
          <span class="rsi-stat-label">Pending (noch offen)</span>
        </div>
      </div>

      <div class="rsi-stats-table-wrap">
        <table class="rsi-stats-table">
          <thead>
            <tr>
              <th>Typ</th>
              <th>Von</th>
              <th>Bis</th>
              <th>Δ RSI</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, i) in sortedDivergences" :key="d.toTime + '-' + d.type + '-' + i" class="rsi-stats-row" @click="emit('select', d)">
              <td>{{ d.type === "bearish" ? "▽ Bearish" : "△ Bullish" }}</td>
              <td>{{ fmtDateTime(d.fromTime) }} · {{ fmtPrice(d.fromPrice, precision) }} · RSI {{ d.fromRsi?.toFixed(1) }}</td>
              <td>{{ fmtDateTime(d.toTime) }} · {{ fmtPrice(d.toPrice, precision) }} · RSI {{ d.toRsi?.toFixed(1) }}</td>
              <td>{{ Math.abs((d.fromRsi ?? 0) - (d.toRsi ?? 0)).toFixed(1) }}</td>
              <td>
                <span class="rsi-outcome-badge" :class="'outcome-' + (d.outcome ?? 'unknown')">{{ outcomeLabel(d) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rsi-stats-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 12px;
}
.rsi-stats-params {
  margin: 0;
  color: var(--text-secondary, #9aa0aa);
}
.rsi-stats-empty {
  color: var(--text-secondary, #9aa0aa);
  padding: 12px 0;
}
.rsi-stats-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.rsi-stat-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 12px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 6px;
  min-width: 130px;
}
.rsi-stat-value {
  font-size: 18px;
  font-weight: 600;
}
.rsi-stat-label {
  font-size: 11px;
  color: var(--text-secondary, #9aa0aa);
}
.rsi-stats-table-wrap {
  overflow-x: auto;
}
.rsi-stats-table {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
}
.rsi-stats-table th {
  text-align: left;
  padding: 4px 8px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.3);
  color: var(--text-secondary, #9aa0aa);
  font-weight: 500;
}
.rsi-stats-table td {
  padding: 4px 8px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}
.rsi-stats-row {
  cursor: pointer;
}
.rsi-stats-row:hover {
  background: rgba(128, 128, 128, 0.12);
}
.rsi-outcome-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.outcome-hit {
  background: rgba(38, 166, 154, 0.2);
  color: #26a69a;
}
.outcome-miss {
  background: rgba(239, 83, 80, 0.2);
  color: #ef5350;
}
.outcome-pending,
.outcome-unknown {
  background: rgba(120, 123, 134, 0.2);
  color: #787b86;
}
</style>
