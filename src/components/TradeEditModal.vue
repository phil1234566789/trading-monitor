<script setup>
import DealingRangeSetupSelect from './DealingRangeSetupSelect.vue';
import TradeExecutionCard from './TradeExecutionCard.vue';
import {useDealingRangeExecutions} from '../composables/useDealingRangeExecutions.js';
import {journalExecutionCardKey,journalCardArmedAction,useJournalEntryFinder} from '../composables/useJournalEntryFinder.js';
import {useJournalExecutionDraft} from '../composables/useJournalExecutionDraft.js';
import { ref, computed } from "vue";
import { updateDealingRange, removeTargetFromTrade, removeConfirmationFromTrade } from "../tradeIntake.js";
import { fmtDateTime, fmtPrice, pricePrecisionForInstrument } from "../format.js";
import { formatTargetLabel } from "../tradeTargets";
import { formatEvidenceLabel } from "../tradeEvidence";
import MetadataPanel from "./MetadataPanel.vue";
import CrudListSection from "./CrudListSection.vue";
import ActionButton from "./ui/ActionButton.vue";
import IconButton from "./ui/IconButton.vue";

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
  positions: {type:Array,default:()=>[]},
  armedPositionId: [Number,String],
  // Für den Instrument-Mismatch-Guard der Lupe-Buttons unten (Chat 2026-08-30, analog zu
  // TradeSetupCockpit.vue) — die Picker-Kandidaten kommen aus dem gerade im Chart geladenen
  // Instrument (PriceChart.vue: poiZonesMetadata/getCurrentLiquidityLevels), nicht aus dem Trade
  // selbst. Ohne diesen Guard würde ein offenes Modal für ein anderes Instrument als das aktuell
  // angezeigte Chart-Symbol stillschweigend falsche Preis-Level vorschlagen.
  currentSymbol: { type: String, required: true },
  // Welcher Add-Button gerade den nächsten Chart-Klick scharf hat (Arm-Key aus Dashboard.vue:
  // armedTradeAction, z.B. "rangeConfirmation"/"target"), sonst null — nur fürs Highlight.
  armedAction: { type: String, default: null },
  entryFvgMessage: {type:String,default:''},
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
  "open-in-tsc",
  "close",
  "saved",
  "created",
  "position-draft-started",
  'position-draft-cancelled',
  'request-entry-fvg',
  'entry-finder-changed',
  "deleted",
  "request-add-target",
  "request-add-confirmation",
  "request-add-range-confirmation",
  "request-add-confluence",
  "request-add-range-confluence",
  "request-add-anti-confluence",
  "request-add-range-anti-confluence",
  "request-set-invalidation",
  "remove-invalidation",
  // Hover über eine Bestätigungs-/Zusatzargument-/Anti-Confluence- ODER Target-Zeile (Chat
  // 2026-08-30, analog zu TradeSetupCockpit.vue) — highlightet das zugehörige Chart-Objekt, siehe
  // Dashboard.vue. Range- UND Position-Ebene teilen sich dasselbe Event (der Chart kennt keinen
  // Unterschied zwischen beiden, nur trade_evidence.id).
  "hover-evidence",
  "hover-target",
  // Target-/Anti-Confluence-Vorschläge (Chat 2026-08-30, analog zu TradeSetupCockpit.vue) — öffnet
  // denselben Picker wie im TSC, nur für die Dealing Range dieses Trades statt der TSC-Range (siehe
  // Dashboard.vue: onOpenTradeTargetPicker/onOpenTradeAntiConfluencePicker).
  "open-target-picker",
  "open-anti-confluence-picker",
]);

const {positions:executions,loading:loadingExecutions,error:executionsError,refresh:loadExecutions}=
  useDealingRangeExecutions(()=>props.trade,()=>props.positions);
const entryFinder=useJournalEntryFinder(key=>emit('entry-finder-changed',key));
const activeEntryCardKey=entryFinder.activeKey;
const {draftKey,draftBase,container:executionSectionRef,visiblePositions:visibleExecutions,start:startPositionDraft,cancel:cancelDraft,
  reload:refreshExecutions,onCreated:onExecutionCreated}=useJournalExecutionDraft({
    trade:()=>props.trade,loading:computed(()=>loadingExecutions.value||!!executionsError.value),positions:executions,refresh:loadExecutions,
    started:()=>{entryFinder.closeAll();emit('position-draft-started');},cancelled:key=>emit('position-draft-cancelled',key),
    created:(id,accountId)=>emit('created',id,accountId),
  });
defineExpose({applyExecutionPrefill:entryFinder.apply,resolveExecutionTarget:entryFinder.resolve,refreshExecutions});
async function onExecutionSaved(){await refreshExecutions();emit('saved');}
function addEntryEvidence(category,position){
  const event={confirmation:'request-add-confirmation',confluence:'request-add-confluence',anti_confluence:'request-add-anti-confluence'}[category];
  emit(event,position);
}

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
// Evidenz-Zeilen (trades.js: toConfirmation) sind mit level ("range"/"position") UND category
// ("confirmation"/"confluence"/"anti_confluence", seit Migration 20260828130000 eine normale,
// explizit gesetzte Spalte statt generiert) versehen — erst nach level aufgeteilt, damit "GO für
// die Idee" und "GO für diesen Entry" strukturell getrennt bleiben, dann je Ebene zusätzlich nach
// category für Bestätigungen/Zusatzargumente/Anti-Confluences (siehe trade-from-poi.md#confirmation-
// confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt).
const rangeConfirmations = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "range" && c.category === "confirmation"));
const rangeConfluences = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "range" && c.category === "confluence"));
const rangeAntiConfluences = computed(() => (props.trade.confirmations ?? []).filter((c) => c.level === "range" && c.category === "anti_confluence"));

const instrumentMismatch = computed(() => props.trade.instrument !== props.currentSymbol);
function pickerButtonTitle(baseTitle) {
  return instrumentMismatch.value ? `Erst zu ${props.trade.instrument} wechseln.` : baseTitle;
}

// Invalidierung als Liste mit höchstens einem Eintrag, identisch zu TradeSetupCockpit.vue — die
// Range-Invalidierung gilt für alle Ausführungen darunter, nicht nur für diese eine.
const invalidationItems = computed(() => {
  const t = props.trade;
  if (t?.invalidation == null) return [];
  return [t.invalidationItem ?? { kind: null, price: t.invalidation, sourceTime: null, touchedTime: null }];
});
function invalidationLabel(item) {
  return item.kind ? confirmationLabel(item) : fmtPrice(item.price, pricePrecisionForInstrument(props.trade.instrument));
}

async function onRemoveTarget(target) {
  const ok = await removeTargetFromTrade(target.id);
  if (ok) emit("saved");
}

async function onRemoveConfirmation(confirmation) {
  const ok = await removeConfirmationFromTrade(confirmation.id);
  if (ok) await onExecutionSaved();
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
  <MetadataPanel :title="`DR #${trade.dealingRangeId} · Ausführungen`" :width="760" :height="900" position="bottom-right" @close="emit('close')">
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
        <button type="button" class="tem-favorite-btn" @click="emit('open-in-tsc')">Im TSC öffnen</button>
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

      <DealingRangeSetupSelect :key="trade.dealingRangeId" :range-id="trade.dealingRangeId" :model-value="trade.strategySetup" @saved="emit('saved')" />

      <!-- Invalidierung: dieselbe Liste mit höchstens einem Eintrag wie im TSC (Philip 22.09.2026,
           beide Stellen bewusst identisch) — der Eintrag ist das angeklickte Chart-Objekt. -->
      <CrudListSection
        title="Invalidierung"
        icon="🚫"
        add-title="Invalidierung im Chart anklicken (Trade-Modus, dann Sweep/OB anklicken)"
        :items="invalidationItems"
        :item-key="() => 'invalidation'"
        :item-label="invalidationLabel"
        empty-text="Noch keine Invalidierung."
        :armed="armedAction === 'invalidation'"
        @add="emit('request-set-invalidation')"
        @remove="emit('remove-invalidation')"
        @hover="(item) => emit('hover-evidence', item)"
      />

      <!-- PLAN-trade-confluences.md #1: von welchem Sweep/OB kam die Kraft für die Bewegung? -->
      <CrudListSection
        title="Bestätigungen (GO für die Idee)"
        icon="✔"
        add-title="Bestätigung hinzufügen (Trade-Modus, dann Sweep/OB/Divergenz anklicken) — oder ein ganzes Trade-Setup für LS+OB auf einmal"
        :items="rangeConfirmations"
        :item-key="(c) => c.id"
        :item-label="confirmationLabel"
        empty-text="Noch keine Bestätigungen."
        :armed="armedAction === 'rangeConfirmation'"
        @add="emit('request-add-range-confirmation')"
        @remove="onRemoveConfirmation"
        @hover="(c) => emit('hover-evidence', c)"
      />

      <!-- Zusatzargumente (Confluence: gibt mehr Sicherheit, aber kein GO — Fib),
           siehe trade-from-poi.md#confirmation-confluence-und-anti-confluence--wie-eine-dealing-
           range-go-bekommt. -->
      <CrudListSection
        title="Zusatzargumente (Idee)"
        icon="💡"
        add-title="Zusatzargument hinzufügen (Trade-Modus, dann Fib anklicken)"
        :items="rangeConfluences"
        :item-key="(c) => c.id"
        :item-label="confirmationLabel"
        empty-text="Noch keine Zusatzargumente."
        :armed="armedAction === 'rangeConfluence'"
        @add="emit('request-add-range-confluence')"
        @remove="onRemoveConfirmation"
        @hover="(c) => emit('hover-evidence', c)"
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
        :armed="armedAction === 'rangeAntiConfluence'"
        @add="emit('request-add-range-anti-confluence')"
        @remove="onRemoveConfirmation"
        @hover="(c) => emit('hover-evidence', c)"
      >
        <template #extra-action>
          <!-- Anti-Confluence-Vorschläge (analog TradeSetupCockpit.vue) — braucht mind. 1 Target
               (definiert die ferne Zonen-Kante, siehe findAntiConfluences.js). -->
          <IconButton
            :title="pickerButtonTitle('Anti-Confluence-Vorschläge (gegenläufige OBs/Sweeps/Divergenz in der Ziel-Zone)')"
            :disabled="(trade.targets ?? []).length < 1 || instrumentMismatch"
            @click="emit('open-anti-confluence-picker')"
          >
            🔎
          </IconButton>
        </template>
      </CrudListSection>

      <CrudListSection
        title="Targets"
        icon="🎯"
        add-title="Target hinzufügen (Trade-Modus, dann Pivot/OB im Chart anklicken)"
        :items="trade.targets ?? []"
        :item-key="(t) => t.id"
        :item-label="targetLabel"
        empty-text="Noch keine Targets."
        :armed="armedAction === 'target'"
        @add="emit('request-add-target')"
        @remove="onRemoveTarget"
        @hover="(t) => emit('hover-target', t)"
      >
        <template #extra-action>
          <!-- Target-Vorschläge (analog TradeSetupCockpit.vue), erst ab 2 Range-Bestätigungen
               sinnvoll (legen Richtung/Kontext fest). -->
          <IconButton
            :title="pickerButtonTitle('Target-Vorschläge (nächste LQ-Level)')"
            :disabled="rangeConfirmations.length < 2 || instrumentMismatch"
            @click="emit('open-target-picker')"
          >
            🔎
          </IconButton>
        </template>
      </CrudListSection>
    </div>

    <section ref="executionSectionRef" class="tem-executions" aria-label="Ausführungen dieser Dealing Range">
      <div class="tem-executions-heading">
        <h3>Ausführungen · {{executions.length}}</h3>
        <ActionButton :disabled="loadingExecutions||!!executionsError||draftKey!=null" @click="startPositionDraft">Position hinzufügen</ActionButton>
      </div>
      <p v-if="loadingExecutions" role="status" class="tem-muted">Ausführungen werden geladen …</p>
      <p v-if="executionsError" role="alert" class="tem-lesson-error">{{executionsError}} <button type="button" @click="refreshExecutions">Erneut laden</button></p>
      <TradeExecutionCard v-for="(position,index) in visibleExecutions" :key="position.id" :ref="entryFinder.refFor(journalExecutionCardKey(position))" :trade="position" :number="index+1"
        :selected="position.id===trade.id" :current-symbol="currentSymbol" :armed-action="journalCardArmedAction(armedAction,armedPositionId,activeEntryCardKey,position)"
        :entry-fvg-message="activeEntryCardKey===journalExecutionCardKey(position)?entryFvgMessage:''"
        @finder-opened="entryFinder.open" @finder-closed="entryFinder.close" @request-entry-fvg="payload=>emit('request-entry-fvg',payload)"
        :draft-active="draftKey!=null" :can-delete="draftKey==null" @saved="onExecutionSaved" @created="onExecutionCreated" @deleted="id=>emit('deleted',id)"
        @add-evidence="addEntryEvidence" @remove-evidence="onRemoveConfirmation" @hover-evidence="item=>emit('hover-evidence',item)" />
      <TradeExecutionCard v-if="draftKey!=null" :ref="entryFinder.refFor(journalExecutionCardKey(draftBase,draftKey))" :key="'draft:'+draftKey" :trade="draftBase" :number="visibleExecutions.length+1"
        draft :draft-key="draftKey" :current-symbol="currentSymbol" :armed-action="journalCardArmedAction(armedAction,armedPositionId,activeEntryCardKey,draftBase,draftKey)" :entry-fvg-message="activeEntryCardKey===journalExecutionCardKey(draftBase,draftKey)?entryFvgMessage:''"
        @saved="onExecutionSaved" @created="onExecutionCreated" @cancel="cancelDraft" @finder-opened="entryFinder.open" @finder-closed="entryFinder.close"
        @request-entry-fvg="payload=>emit('request-entry-fvg',payload)" />
    </section>
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

.tem-executions-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.tem-executions-heading h3{font-size:14px;margin:0}
.tem-header{flex-wrap:wrap}
</style>
