<script setup>
import { ref, computed, watch } from "vue";
import { updateTrade, updateDealingRange, deleteTrade, unlinkTradeSetup, removeTargetFromTrade, removeConfirmationFromTrade } from "../tradeIntake.js";
import { fmtDateTime } from "../format.js";
import { formatTargetLabel } from "../tradeTargets";
import { formatConfirmationLabel } from "../tradeConfirmations";
import { accounts } from "../tradingAccounts.js";
import MetadataPanel from "./MetadataPanel.vue";

// Ersetzt die vorherigen Inline-Buttons in TradesTable.vue (🔗 verknüpfen, + Ziel, × Ziel
// entfernen) — Chat 2026-07-27/28: "das war jetzt bissl too much, was ist wenn man versehentlich
// drauf klickt ... mir wär lieber, wenn man den Trade editieren kann". EIN Button pro Zeile öffnet
// jetzt dieses Panel, alle bisherigen Aktionen (inkl. neu: Preise/Ergebnis/Begründung bearbeiten,
// Trade löschen) leben hier. Bleibt bewusst offen, während man Setup/Ziel im Chart anklickt (siehe
// request-link/request-add-target) — MetadataPanel blockiert den Chart nicht (position: fixed,
// kein Backdrop), das Panel zeigt den aktualisierten Stand automatisch, weil `trade` von
// Dashboard.vue live aus der `trades`-Liste nachgereicht wird, nicht als einmalige Kopie.
const props = defineProps({
  trade: { type: Object, required: true },
});
// Zwei getrennte "Bestätigung hinzufügen"-Anfragen (Chat 2026-07-31: "wir haben die gesamte Basis
// um alles per Klick übernehmen zu können" — kurz zuvor per Formular ausprobiert, dann wieder
// verworfen zugunsten des reinen Chart-Klick-Wegs) — request-add-confirmation bleibt Entry-Ebene
// (trade_position_id, wie bisher), request-add-range-confirmation ist neu für die Idee-Ebene
// (dealing_range_id), die es vorher gar keinen Klick-Weg für gab.
const emit = defineEmits([
  "close",
  "saved",
  "deleted",
  "request-link",
  "request-add-target",
  "request-add-confirmation",
  "request-add-range-confirmation",
]);

const entryPrice = ref("");
const stopLoss = ref("");
const exitPrice = ref("");
const exitTimeInput = ref("");
const outcome = ref("");
const reasoning = ref("");
const tradingAccountId = ref(null);
const size = ref("");
const netPl = ref("");
const commission = ref("");
const saving = ref(false);

const invalidation = ref("");
const savingRange = ref(false);

// <input type="datetime-local"> Roundtrip wie in NewsModal.vue/Dashboard.vue (replayInputValue) —
// Browser-Lokalzeit, kein eigenes Zeitzonen-Handling nötig.
function toDatetimeLocal(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Formular bei jedem Trade-Wechsel (anderer Trade geöffnet) ODER externem Update (Ziel/Setup über
// den Chart hinzugefügt, siehe oben) mit dem aktuellen DB-Stand neu befüllen — NICHT nur beim
// ersten Öffnen, sonst würde ein externes Update während offenem Panel nicht in den Feldern
// auftauchen (nur in den schreibgeschützten Ziele-/Setup-Listen unten).
watch(
  () => props.trade,
  (t) => {
    entryPrice.value = t.entryPrice ?? "";
    stopLoss.value = t.stopLoss ?? "";
    exitPrice.value = t.exitPrice ?? "";
    exitTimeInput.value = t.exitTime != null ? toDatetimeLocal(t.exitTime) : "";
    outcome.value = t.outcome ?? "";
    reasoning.value = t.reasoning ?? "";
    tradingAccountId.value = t.tradingAccountId ?? null;
    invalidation.value = t.invalidation ?? "";
    size.value = t.size ?? "";
    netPl.value = t.netPl ?? "";
    commission.value = t.commission ?? "";
  },
  { immediate: true },
);

// Confirmations sind seit dem dealing_ranges-Split (trades.js: toConfirmation) mit einem
// level-Tag versehen — hier aufgeteilt statt in einer gemeinsamen Liste, damit "GO für die Idee"
// und "GO für diesen Entry" auch strukturell (nicht nur farblich) in den passenden Bereich fallen.
const rangeConfirmations = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "range"));
const positionConfirmations = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "position"));

async function save() {
  saving.value = true;
  const ok = await updateTrade(props.trade.id, {
    entryPrice: entryPrice.value === "" ? null : Number(entryPrice.value),
    stopLoss: stopLoss.value === "" ? null : Number(stopLoss.value),
    exitPrice: exitPrice.value === "" ? null : Number(exitPrice.value),
    exitTime: exitTimeInput.value ? Math.floor(new Date(exitTimeInput.value).getTime() / 1000) : null,
    outcome: outcome.value === "" ? null : outcome.value,
    reasoning: reasoning.value.trim() === "" ? null : reasoning.value.trim(),
    tradingAccountId: tradingAccountId.value,
    size: size.value === "" ? null : Number(size.value),
    netPl: netPl.value === "" ? null : Number(netPl.value),
    commission: commission.value === "" ? null : Number(commission.value),
  });
  saving.value = false;
  if (ok) emit("saved");
}

async function onDelete() {
  if (!confirm(`Trade #${props.trade.id} wirklich löschen?`)) return;
  const ok = await deleteTrade(props.trade.id);
  if (ok) emit("deleted");
}

async function onUnlinkSetup() {
  // Setup-Verknüpfung sitzt auf der dealing_range, nicht auf dieser einzelnen Ausführung.
  const ok = await unlinkTradeSetup(props.trade.dealingRangeId);
  if (ok) emit("saved");
}

async function saveInvalidation() {
  savingRange.value = true;
  const ok = await updateDealingRange(props.trade.dealingRangeId, {
    invalidation: invalidation.value === "" ? null : Number(invalidation.value),
  });
  savingRange.value = false;
  if (ok) emit("saved");
}

async function onRemoveTarget(target) {
  const ok = await removeTargetFromTrade(target.id);
  if (ok) emit("saved");
}

async function onRemoveConfirmation(confirmation) {
  const ok = await removeConfirmationFromTrade(confirmation.id);
  if (ok) emit("saved");
}

// Nicht replay-aware (anders als PriceChart.vue) — das Panel zeigt den ECHTEN aktuellen Stand,
// nicht den Replay-Zeitpunkt; reicht hier als einfache Momentaufnahme beim Öffnen.
const nowSec = Math.floor(Date.now() / 1000);
function targetLabel(target) {
  return formatTargetLabel(target, props.trade.instrument, nowSec);
}
function confirmationLabel(confirmation) {
  return formatConfirmationLabel(confirmation, props.trade.instrument, nowSec);
}
</script>

<template>
  <MetadataPanel :title="`✏️ Trade #${trade.id} bearbeiten`" :width="560" :height="700" position="bottom-right" @close="emit('close')">
    <div class="tem-header">
      <span class="tem-direction" :class="trade.direction">{{ trade.direction === "short" ? "Short" : "Long" }}</span>
      <span>{{ trade.instrument }}</span>
      <span class="tem-muted">{{ fmtDateTime(trade.entryTime) }}</span>
    </div>

    <!-- Dealing Range: die IDEE — gilt für alle Ausführungen unter dieser Range, nicht nur diese
         eine (Chat 2026-07-31: "seperate dealing range and trade position in the edit modal"). -->
    <div class="tem-group tem-group-range">
      <h3 class="tem-group-title">📐 Dealing Range #{{ trade.dealingRangeId }}</h3>

      <section class="tem-section">
        <h4 class="tem-section-title">Invalidierung</h4>
        <form class="tem-inline-form" @submit.prevent="saveInvalidation">
          <input v-model="invalidation" type="number" step="any" placeholder="kein Wert gesetzt" />
          <button type="submit" class="tem-small-save-btn" :disabled="savingRange">Speichern</button>
        </form>
      </section>

      <section class="tem-section">
        <h4 class="tem-section-title">Setup-Verknüpfung</h4>
        <div v-if="trade.tradeSetupId != null" class="tem-row">
          <span>#{{ trade.tradeSetupId }}</span>
          <button class="tem-small-btn" @click="onUnlinkSetup">entfernen</button>
        </div>
        <button v-else class="tem-action-btn" @click="emit('request-link')">🔗 Setup verknüpfen (Trade-Modus, dann OB anklicken)</button>
      </section>

      <section class="tem-section">
        <h4 class="tem-section-title">Targets</h4>
        <div v-if="!trade.targets || trade.targets.length === 0" class="tem-muted">Noch keine Targets.</div>
        <div v-for="target in trade.targets" :key="target.id" class="tem-row">
          <span>{{ targetLabel(target) }}</span>
          <button class="tem-small-btn" @click="onRemoveTarget(target)">entfernen</button>
        </div>
        <button class="tem-action-btn" @click="emit('request-add-target')">🎯 Target hinzufügen (Trade-Modus, dann Pivot/OB im Chart anklicken)</button>
      </section>

      <section class="tem-section">
        <!-- PLAN-trade-confluences.md #1: von welchem Sweep/OB kam die Kraft für die Bewegung? -->
        <h4 class="tem-section-title">Bestätigungen (GO für die Idee)</h4>
        <div v-if="rangeConfirmations.length === 0" class="tem-muted">Noch keine Bestätigungen.</div>
        <div v-for="confirmation in rangeConfirmations" :key="confirmation.id" class="tem-row">
          <span>{{ confirmationLabel(confirmation) }}</span>
          <button class="tem-small-btn" @click="onRemoveConfirmation(confirmation)">entfernen</button>
        </div>
        <button class="tem-action-btn" @click="emit('request-add-range-confirmation')">✔ Bestätigung hinzufügen (Trade-Modus, dann Sweep/OB/Fib anklicken)</button>
      </section>
    </div>

    <!-- Trade Position: diese EINE Ausführung — Entry-Kriterien/Ergebnis können sich von anderen
         Re-Entries derselben Dealing Range unterscheiden. -->
    <div class="tem-group tem-group-position">
      <h3 class="tem-group-title">▶ Ausführung #{{ trade.id }}</h3>

      <section class="tem-section">
        <h4 class="tem-section-title">Bestätigungen (GO für diesen Entry)</h4>
        <div v-if="positionConfirmations.length === 0" class="tem-muted">Noch keine Bestätigungen.</div>
        <div v-for="confirmation in positionConfirmations" :key="confirmation.id" class="tem-row">
          <span>{{ confirmationLabel(confirmation) }}</span>
          <button class="tem-small-btn" @click="onRemoveConfirmation(confirmation)">entfernen</button>
        </div>
        <button class="tem-action-btn" @click="emit('request-add-confirmation')">✔ Bestätigung hinzufügen (Trade-Modus, dann Sweep/OB/Fib anklicken)</button>
      </section>

      <section class="tem-section">
        <h4 class="tem-section-title">Ausführung</h4>
        <form class="tem-form" @submit.prevent="save">
          <label>
            Entry-Preis
            <input v-model="entryPrice" type="number" step="any" placeholder="leer = nicht gefüllt" />
          </label>
          <label>
            Stop-Loss
            <input v-model="stopLoss" type="number" step="any" placeholder="optional" />
          </label>
          <label>
            Exit-Preis
            <input v-model="exitPrice" type="number" step="any" placeholder="optional" />
          </label>
          <label>
            Exit-Zeit
            <input v-model="exitTimeInput" type="datetime-local" />
          </label>
          <label>
            Size (Lots)
            <input v-model="size" type="number" step="any" placeholder="optional" />
          </label>
          <label>
            Net P/L
            <input v-model="netPl" type="number" step="any" placeholder="optional" />
          </label>
          <label>
            Commission
            <input v-model="commission" type="number" step="any" placeholder="optional" />
          </label>
          <label>
            Trading-Konto
            <select v-model="tradingAccountId">
              <option :value="null">— kein Konto —</option>
              <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.name }}</option>
            </select>
          </label>
          <label>
            Ergebnis
            <select v-model="outcome">
              <option value="">— (offen/kein Fill)</option>
              <option value="open">Offen</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="invalid">Ungültig</option>
            </select>
          </label>
          <label>
            Begründung
            <textarea v-model="reasoning" rows="3"></textarea>
          </label>
          <button type="submit" class="tem-save-btn" :disabled="saving">Speichern</button>
        </form>
      </section>

      <button class="tem-delete-btn" @click="onDelete">🗑 Diese Ausführung löschen</button>
    </div>
  </MetadataPanel>
</template>

<style scoped>
.tem-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #d1d4dc;
  margin-bottom: 12px;
}

.tem-direction {
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

/* Short = Orange statt Rot (Chat 2026-07-31: "use green and orange for long and short",
   durchgängig auch in style.css/.trade-direction und TakeTradeModal.vue) — Rot bleibt für
   Win/Loss (.tem-delete-btn, trade-outcome) reserviert. */
.tem-direction.short {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

.tem-direction.long {
  background: rgba(38, 166, 154, 0.2);
  color: #26a69a;
}

.tem-muted {
  color: #787b86;
  font-size: 12px;
}

/* Zwei sichtbar getrennte Bereiche (Chat 2026-07-31: "seperate dealing range and trade position
   in the edit modal") — eigener Rahmen + Akzentfarbe pro Ebene, damit auf den ersten Blick klar
   ist, was zur Idee (gilt für alle Re-Entries) und was zu dieser einen Ausführung gehört. Blau
   für Range (matcht die Farbe, die vorher der jetzt entfernte "Range"-Tag hatte), neutral/grau
   für Position — bewusst UNABHÄNGIG von der Long/Short-Akzentfarbe, die bleibt allein dem
   Richtungs-Badge oben vorbehalten.*/
.tem-group {
  border-radius: 10px;
  padding: 10px;
  margin-bottom: 14px;
  border: 1px solid;
}

.tem-group-range {
  background: rgba(41, 98, 255, 0.06);
  border-color: rgba(41, 98, 255, 0.35);
}

.tem-group-position {
  background: rgba(154, 160, 172, 0.06);
  border-color: rgba(154, 160, 172, 0.3);
}

.tem-group-title {
  margin: 2px 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: #d1d4dc;
}

.tem-group-range .tem-group-title {
  color: #7ea6ff;
}

.tem-section {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.tem-section:last-child {
  margin-bottom: 0;
}

.tem-inline-form {
  display: flex;
  gap: 6px;
}

.tem-inline-form input {
  flex: 1;
  min-width: 0;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 5px 8px;
  color-scheme: dark;
}

.tem-small-save-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid #2962ff;
  color: #7ea6ff;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.tem-small-save-btn:hover:not(:disabled) {
  background: rgba(41, 98, 255, 0.12);
}

.tem-small-save-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.tem-section-title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
}

.tem-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #d1d4dc;
  padding: 3px 0;
}

.tem-small-btn {
  background: transparent;
  border: none;
  color: #787b86;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
}

.tem-small-btn:hover {
  color: #ef5350;
}

.tem-action-btn {
  display: block;
  width: 100%;
  margin-top: 6px;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

.tem-action-btn:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.tem-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tem-form label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: #9aa0ac;
}

.tem-form input,
.tem-form select,
.tem-form textarea {
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 5px 8px;
  color-scheme: dark;
  resize: vertical;
}

.tem-save-btn {
  background: transparent;
  border: 1px solid #2962ff;
  color: #7ea6ff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  margin-top: 4px;
}

.tem-save-btn:hover {
  background: rgba(41, 98, 255, 0.12);
}

.tem-save-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.tem-delete-btn {
  display: block;
  width: 100%;
  background: transparent;
  border: 1px solid rgba(239, 83, 80, 0.4);
  color: #ef5350;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.tem-delete-btn:hover {
  background: rgba(239, 83, 80, 0.12);
}
</style>
