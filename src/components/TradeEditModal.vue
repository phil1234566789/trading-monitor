<script setup>
import { ref, computed, watch } from "vue";
import { updateTrade, updateDealingRange, deleteTrade, removeTargetFromTrade, removeConfirmationFromTrade } from "../tradeIntake.js";
import { fmtDateTime } from "../format.js";
import { formatTargetLabel } from "../tradeTargets";
import { formatEvidenceLabel } from "../tradeEvidence";
import { accounts } from "../tradingAccounts.js";
import MetadataPanel from "./MetadataPanel.vue";
import CrudListSection from "./CrudListSection.vue";
import InvalidationField from "./InvalidationField.vue";

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
// (dealing_range_id), die es vorher gar keinen Klick-Weg für gab. request-set-invalidation (Chat
// 2026-07-31, zweite Runde) ist derselbe Chart-Klick-Weg fürs Invalidierungs-Preisfeld unten —
// request-link (Setup-Verknüpfung) ist raus: das automatische Setup-Klick-zu-Bestätigungen
// (siehe Dashboard.vue: onSelectSetupConfirmations) macht die manuelle Verknüpfung überflüssig.
const emit = defineEmits([
  "close",
  "saved",
  "deleted",
  "request-add-target",
  "request-add-confirmation",
  "request-add-range-confirmation",
  "request-add-confluence",
  "request-add-range-confluence",
  "request-add-anti-confluence",
  "request-add-range-anti-confluence",
  "request-set-invalidation",
]);

const entryPrice = ref("");
const entryTimeInput = ref("");
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

// "Lesson"-Verknüpfung (Chat 2026-07-31, vierte Runde): "GBP Short#23 war ein dummer Fehler,
// Long#24 wäre die Lesson daraus" — kann auch eine falsch bestimmte dealing range sein, nicht nur
// ein Ausführungsfehler, darum an der Range statt an der Position. Bewusst reiner ID-Eingabeweg
// (Philip: "eine Möglichkeit eine dealing-range mittels Id hinzuzufügen und zu verlinken"), kein
// Chart-Klick-Arm wie bei Targets/Bestätigungen — es gibt keine sinnvolle Chart-Stelle, die "die
// andere dealing range" anklickbar machen würde. lessonBadges bildet BEIDE Richtungen ab (eigene
// FK UND "wer zeigt auf mich als Lesson", siehe trades.js), damit ein × immer auf der Range
// wirkt, die die FK tatsächlich trägt — nicht zwangsläufig diese hier.
const lessonInput = ref("");
const savingLesson = ref(false);
const lessonError = ref("");

function rangeLabel(r) {
  return `${r.direction === "short" ? "Short" : "Long"}#${r.id}${r.instrument !== props.trade.instrument ? ` (${r.instrument})` : ""}`;
}

const lessonBadges = computed(() => {
  const badges = [];
  if (props.trade.lessonDealingRangeId != null) {
    const r = props.trade.lessonDealingRange;
    badges.push({
      key: `own-${props.trade.lessonDealingRangeId}`,
      label: `Lesson: ${r ? rangeLabel(r) : "#" + props.trade.lessonDealingRangeId}`,
      unlinkRangeId: props.trade.dealingRangeId,
    });
  }
  for (const r of props.trade.lessonOfDealingRanges ?? []) {
    badges.push({
      key: `of-${r.id}`,
      label: `Lesson für ${rangeLabel(r)}`,
      unlinkRangeId: r.id,
    });
  }
  return badges;
});

async function linkLesson() {
  const targetId = Number(lessonInput.value);
  lessonError.value = "";
  if (!targetId || targetId === props.trade.dealingRangeId) {
    lessonError.value = "ungültige ID";
    return;
  }
  savingLesson.value = true;
  const ok = await updateDealingRange(props.trade.dealingRangeId, { lessonDealingRangeId: targetId });
  savingLesson.value = false;
  if (ok) {
    lessonInput.value = "";
    emit("saved");
  } else {
    lessonError.value = "ID nicht gefunden";
  }
}

async function unlinkLesson(badge) {
  const ok = await updateDealingRange(badge.unlinkRangeId, { lessonDealingRangeId: null });
  if (ok) emit("saved");
}

// "Favorit"-Toggle (Chat 2026-08-13, siehe Migration 20260813120000_dealing_ranges_setup_type.sql
// + TradesTable.vue's Stern für den Schnell-Toggle) — hier zusätzlich im Modal, gleiches
// direktes Schreiben+"saved" wie linkLesson/unlinkLesson oben.
const savingFavorite = ref(false);
const isFavorite = computed(() => props.trade.setupType === "10/10-Trade");
async function toggleFavorite() {
  savingFavorite.value = true;
  const ok = await updateDealingRange(props.trade.dealingRangeId, { setupType: isFavorite.value ? null : "10/10-Trade" });
  savingFavorite.value = false;
  if (ok) emit("saved");
}
// Sichtbares Feedback fürs Invalidierungs-Feld (Chat 2026-07-31, dritte Runde: "ich sehe nicht, ob
// das erfolgreich übernommen worden ist") — gilt für BEIDE Wege, den Preis zu setzen: das Formular
// hier UND den Chart-Klick (Dashboard.vue: onSelectTarget schreibt direkt in die DB, das Modal
// selbst weiß davon nichts außer über den watch unten, der jede externe Änderung am aktuellen
// Trade abgleicht). Gleiches "kurz aufblitzen, dann zurücksetzen"-Muster wie die "✓ kopiert"-
// Buttons im Debug-Metadaten-Panel (PriceChart.vue: copiedSection).
const FEEDBACK_MS = 1200;
const invalidationJustSaved = ref(false);
let invalidationFeedbackTimeout = null;
function flashInvalidationSaved() {
  invalidationJustSaved.value = true;
  clearTimeout(invalidationFeedbackTimeout);
  invalidationFeedbackTimeout = setTimeout(() => {
    invalidationJustSaved.value = false;
  }, FEEDBACK_MS);
}

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
//
// Bug-Report Philip 2026-07-31: "will die Begründung editieren, auf einmal fügt sich irgendein
// anderer Text ein" — kein Autofill-Problem, sondern Dashboard.vue's usePolledFetch pollt `trades`
// alle POLL_MS neu (er sah dazu passend "ganz viele requests im Network-Tab"), was hier bei
// OFFENEM Panel für DENSELBEN Trade eine neue props.trade-Objektreferenz mit dem alten DB-Stand
// auslöste — der Watcher hat dann blind den gerade getippten Text mit dem zuletzt gespeicherten
// überschrieben. Fix: "sync-if-untouched" — ein Feld nur aus dem neuen Trade übernehmen, wenn es
// seit dem letzten Sync unverändert ist (== oldT-Wert), sonst ist der Nutzer gerade mittendrin,
// es zu bearbeiten. Bei einem echten Trade-Wechsel (andere id) IMMER hart neu befüllen.
function syncIfUntouched(ref, sameTrade, oldValue, newValue) {
  if (sameTrade && ref.value !== oldValue) return;
  ref.value = newValue;
}
watch(
  () => props.trade,
  (t, oldT) => {
    const sameTrade = oldT != null && oldT.id === t.id;
    syncIfUntouched(entryPrice, sameTrade, oldT?.entryPrice ?? "", t.entryPrice ?? "");
    syncIfUntouched(
      entryTimeInput,
      sameTrade,
      oldT?.entryTime != null ? toDatetimeLocal(oldT.entryTime) : "",
      t.entryTime != null ? toDatetimeLocal(t.entryTime) : "",
    );
    syncIfUntouched(stopLoss, sameTrade, oldT?.stopLoss ?? "", t.stopLoss ?? "");
    syncIfUntouched(exitPrice, sameTrade, oldT?.exitPrice ?? "", t.exitPrice ?? "");
    syncIfUntouched(
      exitTimeInput,
      sameTrade,
      oldT?.exitTime != null ? toDatetimeLocal(oldT.exitTime) : "",
      t.exitTime != null ? toDatetimeLocal(t.exitTime) : "",
    );
    syncIfUntouched(outcome, sameTrade, oldT?.outcome ?? "", t.outcome ?? "");
    syncIfUntouched(reasoning, sameTrade, oldT?.reasoning ?? "", t.reasoning ?? "");
    syncIfUntouched(tradingAccountId, sameTrade, oldT?.tradingAccountId ?? null, t.tradingAccountId ?? null);
    syncIfUntouched(invalidation, sameTrade, oldT?.invalidation ?? "", t.invalidation ?? "");
    syncIfUntouched(size, sameTrade, oldT?.size ?? "", t.size ?? "");
    syncIfUntouched(netPl, sameTrade, oldT?.netPl ?? "", t.netPl ?? "");
    syncIfUntouched(commission, sameTrade, oldT?.commission ?? "", t.commission ?? "");
    // Nur bei derselben Dealing Range flashen — sonst würde ein simples "anderen Trade öffnen"
    // (andere invalidation, weil andere Idee) fälschlich als "gerade gespeichert" aufblitzen.
    if (sameTrade && oldT.dealingRangeId === t.dealingRangeId && oldT.invalidation !== t.invalidation) {
      flashInvalidationSaved();
    }
  },
  { immediate: true },
);

// Evidenz-Zeilen (trades.js: toConfirmation) sind mit level ("range"/"position") UND category
// ("confirmation"/"confluence"/"anti_confluence", seit Migration 20260828130000 eine normale,
// explizit gesetzte Spalte statt generiert) versehen — erst nach level aufgeteilt, damit "GO für
// die Idee" und "GO für diesen Entry" strukturell getrennt bleiben, dann je Ebene zusätzlich nach
// category für Bestätigungen/Zusatzargumente/Anti-Confluences (siehe trade-from-poi.md#confirmation-
// confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt).
const rangeConfirmations = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "range" && c.category === "confirmation"));
const positionConfirmations = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "position" && c.category === "confirmation"));
const rangeConfluences = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "range" && c.category === "confluence"));
const positionConfluences = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "position" && c.category === "confluence"));
const rangeAntiConfluences = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "range" && c.category === "anti_confluence"));
const positionAntiConfluences = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "position" && c.category === "anti_confluence"));

async function save() {
  saving.value = true;
  const ok = await updateTrade(props.trade.id, {
    entryPrice: entryPrice.value === "" ? null : Number(entryPrice.value),
    entryTime: entryTimeInput.value ? Math.floor(new Date(entryTimeInput.value).getTime() / 1000) : null,
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

async function saveInvalidation() {
  savingRange.value = true;
  const ok = await updateDealingRange(props.trade.dealingRangeId, {
    invalidation: invalidation.value === "" ? null : Number(invalidation.value),
  });
  savingRange.value = false;
  if (ok) {
    emit("saved");
    // Sofort hier flashen statt nur auf den watch zu warten (Chart-Klick-Weg) — der wartet auf
    // Dashboard.vue's refreshTrades()-Roundtrip, für den Formular-Submit-Klick soll's aber
    // spürbar sofort sein.
    flashInvalidationSaved();
  }
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
  return formatEvidenceLabel(confirmation, props.trade.instrument, nowSec);
}
</script>

<template>
  <MetadataPanel :title="`✏️ Trade #${trade.id} bearbeiten`" :width="560" :height="700" position="bottom-right" @close="emit('close')">
    <div class="tem-header">
      <span class="tem-direction" :class="trade.direction">{{ trade.direction === "short" ? "Short" : "Long" }}</span>
      <span>{{ trade.instrument }}</span>
      <span class="tem-muted">{{ fmtDateTime(trade.entryTime) }}</span>

      <div class="tem-lesson-area">
        <span v-for="badge in lessonBadges" :key="badge.key" class="tem-lesson-badge">
          🔗 {{ badge.label }}
          <button class="tem-lesson-remove" title="Verknüpfung entfernen" @click="unlinkLesson(badge)">×</button>
        </span>
        <form v-if="trade.lessonDealingRangeId == null" class="tem-lesson-form" @submit.prevent="linkLesson">
          <input v-model="lessonInput" type="number" placeholder="Range-ID" title="Dealing-Range-ID der Lesson" />
          <button type="submit" class="tem-lesson-link-btn" title="als Lesson verlinken" :disabled="savingLesson">🔗</button>
        </form>
        <span v-if="lessonError" class="tem-lesson-error">{{ lessonError }}</span>
      </div>
    </div>

    <!-- Dealing Range: die IDEE — gilt für alle Ausführungen unter dieser Range, nicht nur diese
         eine (Chat 2026-07-31: "seperate dealing range and trade position in the edit modal"). -->
    <div class="tem-group tem-group-range">
      <h3 class="tem-group-title">
        📐 Dealing Range #{{ trade.dealingRangeId }}
        <button
          class="tem-favorite-btn"
          :class="{ active: isFavorite }"
          :title="isFavorite ? '10/10-Trade — Markierung entfernen' : 'Als 10/10-Trade markieren'"
          :disabled="savingFavorite"
          @click="toggleFavorite"
        >
          {{ isFavorite ? "★ 10/10-Trade" : "☆ 10/10-Trade" }}
        </button>
      </h3>

      <InvalidationField
        v-model="invalidation"
        :saving="savingRange"
        :just-saved="invalidationJustSaved"
        @save="saveInvalidation"
        @request-chart-click="emit('request-set-invalidation')"
      />

      <!-- PLAN-trade-confluences.md #1: von welchem Sweep/OB kam die Kraft für die Bewegung? -->
      <CrudListSection
        title="Bestätigungen (GO für die Idee)"
        icon="✔"
        add-title="Bestätigung hinzufügen (Trade-Modus, dann Sweep/OB anklicken) — oder ein ganzes Trade-Setup für LS+OB auf einmal"
        :items="rangeConfirmations"
        :item-key="(c) => c.id"
        :item-label="confirmationLabel"
        empty-text="Noch keine Bestätigungen."
        @add="emit('request-add-range-confirmation')"
        @remove="onRemoveConfirmation"
      />

      <!-- Zusatzargumente (Confluence: gibt mehr Sicherheit, aber kein GO — Fib/RSI-Divergenz),
           siehe trade-from-poi.md#confirmation-confluence-und-anti-confluence--wie-eine-dealing-
           range-go-bekommt. -->
      <CrudListSection
        title="Zusatzargumente (Idee)"
        icon="💡"
        add-title="Zusatzargument hinzufügen (Trade-Modus, dann Fib/Divergenz anklicken)"
        :items="rangeConfluences"
        :item-key="(c) => c.id"
        :item-label="confirmationLabel"
        empty-text="Noch keine Zusatzargumente."
        @add="emit('request-add-range-confluence')"
        @remove="onRemoveConfirmation"
      />

      <!-- Anti-Confluence (spricht gegen den Trade), erster Schritt nur klickbare Chart-Objekte
           (Philip, Chat 2026-08-28), siehe trade-from-poi.md#confirmation-confluence-und-anti-
           confluence--wie-eine-dealing-range-go-bekommt. -->
      <CrudListSection
        title="Anti-Confluences (Idee)"
        icon="💀"
        add-title="Anti-Confluence hinzufügen (Trade-Modus, dann Sweep/OB/Fib/Divergenz anklicken)"
        :items="rangeAntiConfluences"
        :item-key="(c) => c.id"
        :item-label="confirmationLabel"
        empty-text="Noch keine Anti-Confluences."
        @add="emit('request-add-range-anti-confluence')"
        @remove="onRemoveConfirmation"
      />

      <CrudListSection
        title="Targets"
        icon="🎯"
        add-title="Target hinzufügen (Trade-Modus, dann Pivot/OB im Chart anklicken)"
        :items="trade.targets ?? []"
        :item-key="(t) => t.id"
        :item-label="targetLabel"
        empty-text="Noch keine Targets."
        @add="emit('request-add-target')"
        @remove="onRemoveTarget"
      />
    </div>

    <!-- Trade Position: diese EINE Ausführung — Entry-Kriterien/Ergebnis können sich von anderen
         Re-Entries derselben Dealing Range unterscheiden. -->
    <div class="tem-group tem-group-position">
      <h3 class="tem-group-title">▶ Ausführung #{{ trade.id }}</h3>

      <CrudListSection
        title="Bestätigungen (GO für diesen Entry)"
        icon="✔"
        add-title="Bestätigung hinzufügen (Trade-Modus, dann Sweep/OB anklicken) — oder ein ganzes Trade-Setup für LS+OB auf einmal"
        :items="positionConfirmations"
        :item-key="(c) => c.id"
        :item-label="confirmationLabel"
        empty-text="Noch keine Bestätigungen."
        @add="emit('request-add-confirmation')"
        @remove="onRemoveConfirmation"
      />

      <CrudListSection
        title="Zusatzargumente (Entry)"
        icon="💡"
        add-title="Zusatzargument hinzufügen (Trade-Modus, dann Fib/Divergenz anklicken)"
        :items="positionConfluences"
        :item-key="(c) => c.id"
        :item-label="confirmationLabel"
        empty-text="Noch keine Zusatzargumente."
        @add="emit('request-add-confluence')"
        @remove="onRemoveConfirmation"
      />

      <CrudListSection
        title="Anti-Confluences (Entry)"
        icon="💀"
        add-title="Anti-Confluence hinzufügen (Trade-Modus, dann Sweep/OB/Fib/Divergenz anklicken)"
        :items="positionAntiConfluences"
        :item-key="(c) => c.id"
        :item-label="confirmationLabel"
        empty-text="Noch keine Anti-Confluences."
        @add="emit('request-add-anti-confluence')"
        @remove="onRemoveConfirmation"
      />

      <section class="tem-section">
        <h4 class="tem-section-title">Ausführung</h4>
        <form class="tem-form" autocomplete="off" @submit.prevent="save">
          <label>
            Entry-Preis
            <input v-model="entryPrice" type="number" step="any" placeholder="leer = nicht gefüllt" />
          </label>
          <label>
            Entry-Zeit
            <input v-model="entryTimeInput" type="datetime-local" />
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
            </select>
          </label>
          <label>
            Begründung
            <textarea v-model="reasoning" rows="3" autocomplete="off"></textarea>
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

/* "Lesson"-Verknüpfung (Chat 2026-07-31, vierte Runde) — oben rechts in der Header-Zeile
   (Philip: "gleich oben rechts auf die Zeile"), margin-left: auto schiebt sie ans Ende des
   bestehenden Flex-Headers statt eine eigene Zeile zu brauchen. Violett statt Grün/Orange
   (Richtung), Blau (Range) oder Rot (Löschen/Loss) — bewusst eine neue, "auffällige" Akzentfarbe
   (Philip's eigene Formulierung), damit ein Lesson-Link auf den ersten Blick aus dem Rest
   heraussticht. */
.tem-lesson-area {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.tem-lesson-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: rgba(171, 71, 188, 0.16);
  border: 1px solid rgba(171, 71, 188, 0.5);
  color: #ce93d8;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 6px;
  border-radius: 5px;
  white-space: nowrap;
}

.tem-lesson-remove {
  background: transparent;
  border: none;
  color: #ce93d8;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  padding: 0 0 0 2px;
}

.tem-lesson-remove:hover {
  color: #ef5350;
}

.tem-lesson-form {
  display: flex;
  gap: 4px;
}

.tem-lesson-form input {
  width: 64px;
  background: #131722;
  border: 1px solid rgba(171, 71, 188, 0.4);
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  padding: 3px 6px;
  color-scheme: dark;
}

.tem-lesson-link-btn {
  background: transparent;
  border: 1px solid rgba(171, 71, 188, 0.5);
  color: #ce93d8;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 6px;
}

.tem-lesson-link-btn:hover:not(:disabled) {
  background: rgba(171, 71, 188, 0.16);
}

.tem-lesson-link-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.tem-lesson-error {
  color: #ef5350;
  font-size: 11px;
  white-space: nowrap;
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

/* "Favorit"-Toggle (Chat 2026-08-13) — gleiches Gold/Amber wie TradesTable.vue's .trade-favorite-indicator
   (style.css), damit beide Stellen als dasselbe Konzept erkennbar bleiben. Editierbar NUR hier im
   Modal, nicht in der Tabelle (Klickrisiko, siehe dort). */
.tem-favorite-btn {
  margin-left: 8px;
  background: transparent;
  border: 1px solid rgba(240, 185, 11, 0.4);
  color: #9aa0ac;
  border-radius: 5px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
}

.tem-favorite-btn:hover:not(:disabled) {
  background: rgba(240, 185, 11, 0.12);
  color: #f0b90b;
}

.tem-favorite-btn.active {
  border-color: #f0b90b;
  color: #f0b90b;
  background: rgba(240, 185, 11, 0.12);
}

.tem-favorite-btn:disabled {
  opacity: 0.5;
  cursor: default;
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

/* Bestätigungen/Targets/Invalidierung sind seit Chat 2026-08-26/27 in CrudListSection.vue bzw.
   InvalidationField.vue ausgelagert (eigene Klassen-Präfixe dort). */
.tem-section-title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
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
