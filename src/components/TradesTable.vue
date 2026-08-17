<script setup>
import { fmtPrice, fmtDate, fmtTime, fmtMoney, pricePrecisionForInstrument } from "../format.js";
import { useLocalStorageRef } from "../composables/useLocalStorageRef.js";
import { cssColorScaled } from "../chartColors.js";

const props = defineProps({
  trades: { type: Array, required: true },
  // Pin-Kontext (Chat 2026-08-01, siehe pinContext.js) — Set von trade_positions.id,
  // die Philip per Rechtsklick dauerhaft "an Lana übergeben" hat, tönt die jeweilige Zeile.
  pinTradeIds: { type: Set, default: () => new Set() },
});

// Seit Chat 2026-07-28 nur noch EIN Aktions-Button pro Zeile ("edit-request", öffnet
// TradeEditModal.vue) — vorher gab's hier 🔗/+/× einzeln inline, was Philip als "too much,
// Klickrisiko" zurückgemeldet hat (siehe Memory feedback_trade_editing_ui.md).
// "hover-trade" (Chat 2026-08-01, Philips Wunsch für bessere Live-Kommunikation mit Lana): beim
// Hover einer Zeile soll die zugehörige trade_position im Chart hervorgehoben werden, ohne wie
// "select" auch noch hinzuscrollen (siehe onHoverTrade in Dashboard.vue) — null bei mouseleave,
// damit die Hervorhebung wieder verschwindet.
// "pin-context-menu" (Chat 2026-08-01): Rechtsklick auf eine Zeile öffnet direkt Dashboard.vue's
// Notiz-Popup (siehe dort: onPinContextMenu) — passiert serverseitig nichts hier, TradesTable.vue
// kennt den Pin-Store nicht direkt. Gleicher Event-Name UND Payload-Shape
// { candidates: [...], x, y } wie PriceChart.vue's Chart-Marker/OB-Zonen-Rechtsklick (siehe dort),
// hier immer genau EIN Kandidat (eine Tabellenzeile ist nie mehrdeutig), damit Dashboard.vue EINEN
// gemeinsamen Handler nutzen kann.
const emit = defineEmits(["select", "edit-request", "hover-trade", "pin-context-menu"]);

function rowStyle(t) {
  return props.pinTradeIds.has(t.id) ? { backgroundColor: cssColorScaled("pin", 0.25) } : undefined;
}

const OUTCOME_LABEL = {
  win: "Win",
  loss: "Loss",
  open: "Offen",
};

function outcomeLabel(t) {
  return t.outcome ? (OUTCOME_LABEL[t.outcome] ?? t.outcome) : "Offen";
}

// "Lesson"-Link (Chat 2026-07-31, vierte Runde, siehe TradeEditModal.vue) — als sichtbarer Chip
// mit Text statt nur einem Hover-Icon (Philip: "muss noch auffälliger werden ... ein 'Chip'
// hinzukommt mit Lesson"), damit "Short#23 und Long#24 gehören zusammen" ohne Hover erkennbar
// ist. Ein Chip pro Richtung (eigene FK UND "wer zeigt auf mich als Lesson", siehe trades.js),
// Verlinken/Entfernen bleibt allein dem Edit-Modal vorbehalten.
function rangeLabel(t, r) {
  return `${r.direction === "short" ? "Short" : "Long"}#${r.id}${r.instrument !== t.instrument ? ` (${r.instrument})` : ""}`;
}
// "Favorit"-Stern (Chat 2026-08-13): reine Anzeige, NICHT klickbar — Philip explizit dagegen,
// weil ein Stern direkt in der Zeile zu leicht aus Versehen getroffen wird (gleiches Klickrisiko
// wie die alten Inline-Buttons, siehe Memory feedback_trade_editing_ui.md). Setzen/entfernen geht
// nur über TradeEditModal.vue.
function isFavorite(t) {
  return t.setupType === "10/10-Trade";
}
function lessonBadges(t) {
  const badges = [];
  if (t.lessonDealingRangeId != null) {
    badges.push({ key: `own-${t.lessonDealingRangeId}`, label: `Lesson: ${t.lessonDealingRange ? rangeLabel(t, t.lessonDealingRange) : "#" + t.lessonDealingRangeId}` });
  }
  for (const r of t.lessonOfDealingRanges ?? []) {
    badges.push({ key: `of-${r.id}`, label: `Lesson für ${rangeLabel(t, r)}` });
  }
  return badges;
}

// Bewusst radikal reduziert (Chat 2026-07-31: "Ich schau mir das erst an, dann können wir weitere
// Spalten hinzufügen") — eine Zeile pro trade_position wie bisher, aber nur noch Dealing-Range-
// Kennung (Richtung + #dealing_range_id, NICHT die trade_setup_id-Verknüpfung, das ist ein anderes
// "#"), Datum, Exit, Ergebnis, Begründung. Kein Entry/SL/Targets/Setup-Link mehr — kommt erst
// zurück, sobald klar ist, was fürs Edit-Modal-Redesign tatsächlich gebraucht wird. Size/Net P/L/
// Commission (Chat 2026-07-31, zweite Runde) kamen seitdem dazu.

// Commission braucht Philip "selten" — Spaltenkopf selbst ist der Toggle (Chat 2026-07-31: "du
// kannst das 'commission'-table-header als Toggle machen"), keine extra Checkbox/kein Menü-Eintrag.
// Persistiert wie andere Anzeige-Toggles in diesem Repo (useLocalStorageRef).
const showCommission = useLocalStorageRef("showCommissionColumn", false);
</script>

<template>
  <div v-if="trades.length === 0" class="trades-empty">Noch keine Trades.</div>
  <table v-else class="trades-table">
    <thead>
      <tr>
        <th>Dealing Range</th>
        <th>Position</th>
        <th>Date</th>
        <th>Entry</th>
        <th>Exit</th>
        <th>Size</th>
        <th>Ergebnis</th>
        <th>Net P/L</th>
        <!-- Klick auf den Spaltenkopf selbst schaltet um (Chat 2026-07-31) — keine extra Checkbox. -->
        <th class="trade-commission-header" title="Klicken zum Ein-/Ausblenden" @click.stop="showCommission = !showCommission">
          Commission {{ showCommission ? "🔓" : "🔒" }}
        </th>
        <th>Begründung</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="t in trades"
        :key="t.id"
        class="trade-row"
        :style="rowStyle(t)"
        @click="emit('select', t)"
        @mouseenter="emit('hover-trade', t)"
        @mouseleave="emit('hover-trade', null)"
        @contextmenu.prevent="emit('pin-context-menu', { candidates: [{ kind: 'trade_position', trade: t }], x: $event.clientX, y: $event.clientY })"
      >
        <td>
          <span v-if="isFavorite(t)" class="trade-favorite-indicator" title="10/10-Trade">★</span>
          <span class="trade-direction" :class="t.direction">{{ t.direction === "short" ? "Short" : "Long" }}</span>
          #{{ t.dealingRangeId }}
          <span v-for="badge in lessonBadges(t)" :key="badge.key" class="trade-lesson-chip">🔗 {{ badge.label }}</span>
        </td>
        <!-- Chat 2026-07-31: "damit ich, wenn ich das Modal öffne, besser erkennen kann, welche
             Position ich da eigentlich editiere" — matcht 1:1 den Modal-Titel "Trade #<id>
             bearbeiten" (siehe TradeEditModal.vue), da trade.id === die trade_position-Id. -->
        <td class="trade-position-cell">#{{ t.id }}</td>
        <td>{{ fmtDate(t.entryTime) }}</td>
        <td>{{ t.entryPrice != null ? fmtPrice(t.entryPrice, pricePrecisionForInstrument(t.instrument)) : "–" }}</td>
        <td v-if="t.exitPrice != null">{{ fmtPrice(t.exitPrice, pricePrecisionForInstrument(t.instrument)) }} ({{ fmtTime(t.exitTime) }})</td>
        <td v-else>–</td>
        <td>{{ t.size ?? "–" }}</td>
        <td>
          <span class="trade-outcome" :class="t.outcome ?? 'open'">{{ outcomeLabel(t) }}</span>
        </td>
        <td>
          <span v-if="t.netPl != null" class="trade-pl" :class="t.netPl >= 0 ? 'positive' : 'negative'">{{ fmtMoney(t.netPl) }}</span>
          <span v-else>–</span>
        </td>
        <td class="trade-commission-cell">
          <span v-if="!showCommission" class="trade-commission-hidden">•••</span>
          <span v-else-if="t.commission != null" class="trade-pl" :class="t.commission >= 0 ? 'positive' : 'negative'">{{ fmtMoney(t.commission) }}</span>
          <span v-else>–</span>
        </td>
        <td class="trade-reasoning-cell">{{ t.reasoning ?? "" }}</td>
        <td>
          <button class="trade-link-btn" title="Trade bearbeiten" @click.stop="emit('edit-request', t)">✏️</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>
