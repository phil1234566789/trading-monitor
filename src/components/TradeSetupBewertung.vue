<script setup>
// Bewertungs-Bereich rechts vom TSC (Philip 2026-09-23: "ich hätte gern rechts vom TSC einen
// neuen Bereich 'Trade Setup Bewertung'"). Erst einmal NUR die FVG — sie trennt von allen
// gemessenen Merkmalen am weitesten (bei 3R 47 bis 90 %, das Risiko-Band nur 49 bis 66) und ist
// als einzige je Setup ohne Zusatzabfrage verfügbar.
//
// Bewusst KEINE Gesamtnote und keine Verrechnung mehrerer Merkmale: die Merkmale sind korreliert
// (eine größere FVG geht mit einer weiteren Range einher), ein Produkt wäre systematisch zu gut.
// Die Tabelle ordnet ein, sie rechnet nicht.
import { computed } from "vue";
import { fvgBewertung, QUOTEN_HERKUNFT } from "../drQuoten.js";
import { fmtPrice } from "../format.js";

const props = defineProps({
  instrument: { type: String, required: true },
  // Größe der bestätigenden FVG in Pips, oder null: dann steht die Tabelle ohne Markierung da,
  // statt zu verschwinden — der Bereich soll nicht springen, sobald der TSC leer ist.
  fvgPips: { type: Number, default: null },
});

const tabelle = computed(() => fvgBewertung(props.instrument, props.fvgPips));
const kopfzeile = computed(() =>
  props.fvgPips > 0 ? `FVG ${fmtPrice(props.fvgPips, 1)} P` : "keine FVG verknüpft",
);

// Verhältnis zur Referenz DERSELBEN Spalte, nicht die absolute Prozentzahl: 3R liegt im Mittel bei
// 55 %, 40 Pips bei 24 % — ein fester Schwellwert würde die rechte Hälfte dauerhaft rot färben.
// Die Grenze für Grün liegt auf der Referenz selbst (Philip 2026-09-23: "keine gegenkraft mit 58 %
// ist ja stark, das sollte grün sein"), nicht erst darüber.
function tonung(quote, referenz) {
  if (quote == null || !referenz) return "";
  const t = quote / referenz;
  if (t >= 1.35) return "s3";
  if (t >= 1.13) return "s2";
  if (t >= 1.0) return "s1";
  if (t >= 0.92) return "n0";
  if (t >= 0.84) return "w1";
  if (t >= 0.7) return "w2";
  return "w3";
}
</script>

<template>
  <section v-if="tabelle" class="tsb-card">
    <header class="tsb-header">
      <span class="tsb-title">Trade-Setup-Bewertung</span>
      <span class="tsb-wert">{{ kopfzeile }}</span>
    </header>

    <div class="tsb-grid" :title="QUOTEN_HERKUNFT">
      <div class="tsb-cl tsb-hd"></div>
      <div
        v-for="(z, i) in tabelle.ziele"
        :key="z.label"
        class="tsb-hd"
        :class="{ 'tsb-sep': i === 3 }"
      >{{ z.label }}</div>

      <div class="tsb-cl tsb-ref">alle Setups</div>
      <div
        v-for="(r, i) in tabelle.referenz"
        :key="'ref' + i"
        class="tsb-ref"
        :class="{ 'tsb-sep': i === 3 }"
      >{{ r }}</div>

      <template v-for="band in tabelle.baender" :key="band.label">
        <div class="tsb-cl" :class="{ 'tsb-hit': band.treffer }">
          {{ band.label }}<span class="tsb-n">{{ band.n }}</span>
        </div>
        <div
          v-for="(q, i) in band.quoten"
          :key="band.label + i"
          class="tsb-v"
          :class="[tonung(q, tabelle.referenz[i]), { 'tsb-sep': i === 3, 'tsb-hit': band.treffer }]"
        >{{ q ?? "–" }}</div>
      </template>
    </div>

    <p class="tsb-fuss">
      Trefferquote gegen den gedeckelten Stopp. Rechts der Bandname, darunter die Gruppengröße —
      das oberste Band trägt nur 91 Ranges.
    </p>
  </section>
</template>

<style scoped>
/* Spiegelt .tsc-card (TradeSetupCockpit.vue) — der Bereich soll als Geschwister daneben stehen,
   nicht als Fremdkörper. Breite bewusst schmaler: sechs Zahlenspalten brauchen weniger als die
   Listen des TSC. */
.tsb-card {
  width: 300px;
  flex: none;
  align-self: flex-start;
  padding: 14px 14px 10px;
  border-radius: 8px;
  background-color: rgba(19, 23, 34, 0.92);
  border: 1px solid rgba(120, 123, 134, 0.5);
  font-size: 15px;
  line-height: 22px;
}

.tsb-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.tsb-title { font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #9aa0ac; }
.tsb-wert { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; color: #e6e9ef; }

.tsb-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) repeat(6, minmax(0, 1fr));
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.tsb-grid > div { padding: 3px 2px; text-align: right; }
.tsb-cl { text-align: left; padding-right: 6px; color: #9aa0ac; white-space: nowrap; }
.tsb-n { display: block; font-size: 10px; line-height: 12px; color: #6d727b; }
.tsb-hd { color: #6d727b; font-size: 11px; border-bottom: 1px solid rgba(120, 123, 134, 0.35); padding-bottom: 4px; }
.tsb-ref { color: #8b9098; border-bottom: 1px solid rgba(120, 123, 134, 0.35); padding-bottom: 5px; }
/* Trennt R- von Pip-Leiter: zwei verschiedene Fragen, die nur nebeneinander stehen. */
.tsb-sep { border-left: 1px solid rgba(120, 123, 134, 0.35); }

.tsb-v { border-radius: 2px; }
.tsb-v.s3 { background-color: rgba(38, 166, 154, 0.55); color: #f2fbf9; }
.tsb-v.s2 { background-color: rgba(38, 166, 154, 0.38); color: #e6f6f3; }
.tsb-v.s1 { background-color: rgba(38, 166, 154, 0.2); color: #d6e6e3; }
.tsb-v.n0 { background-color: rgba(120, 123, 134, 0.18); color: #b6bac2; }
.tsb-v.w1 { background-color: rgba(239, 83, 80, 0.18); color: #e4c3bf; }
.tsb-v.w2 { background-color: rgba(239, 83, 80, 0.32); color: #f3d3ce; }
.tsb-v.w3 { background-color: rgba(239, 83, 80, 0.48); color: #fbe2de; }

/* Die Zeile der laufenden Dealing Range — Rahmen statt kräftigerer Farbe, sonst konkurriert das
   Highlight mit der Tönung, die ja die eigentliche Aussage trägt. */
.tsb-hit { box-shadow: inset 0 1px 0 #e6e9ef, inset 0 -1px 0 #e6e9ef; color: #ffffff; font-weight: 600; }
.tsb-cl.tsb-hit { box-shadow: inset 0 1px 0 #e6e9ef, inset 0 -1px 0 #e6e9ef, inset 1px 0 0 #e6e9ef; color: #e6e9ef; }
.tsb-v.tsb-hit:last-child { box-shadow: inset 0 1px 0 #e6e9ef, inset 0 -1px 0 #e6e9ef, inset -1px 0 0 #e6e9ef; }

.tsb-fuss { margin: 10px 0 0; font-size: 11px; line-height: 15px; color: #6d727b; }
</style>
