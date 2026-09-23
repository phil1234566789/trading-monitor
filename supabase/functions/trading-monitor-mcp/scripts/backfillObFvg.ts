// Fuellt trade_setups.ob_fvg fuer die Zeilen, die vor der Spalte entstanden sind (Migration
// 20260923083000). Ab dann schreiben poi-watcher und backfillTradeSetups die Groesse selbst mit.
//
// Kein zweiter Erkennungslauf: die Luecke steckt bereits in den Zeilen, die es gibt. Die
// FVG-anknuepfende OB-Kante IST C1 (detectOrderBlocks: bottom = c1.low bei einem baerischen OB,
// top = c1.high bei einem bullischen), und widenObForSweep zieht immer nur die GEGENUEBERLIEGENDE
// Kante auf. Damit ist
//   short: ob_fvg = ob_bottom - high(ob_start_time + 300)
//   long : ob_fvg = low(ob_start_time + 300) - ob_top
// exakt dieselbe Zahl, die detectOrderBlocks damals als bearGap/bullGap gerechnet hat.
//
// DIE GEGENPROBE IST PFLICHT, nicht Kosmetik: stimmt die Kerze bei ob_start_time - 300 nicht mit
// der gespeicherten C1-Kante ueberein, stammt die Zeile aus einem anderen Kerzenstand als dem, der
// hier gelesen wird (anderer Feed, korrigierte Archivzeile). Dann bleibt ob_fvg NULL und die Zeile
// wird gezaehlt -- eine gerechnete, aber falsche Zahl waere schlimmer als eine fehlende, weil sie
// still in die Baender laufen wuerde.
//
// Gelesen wird aus forex_candles (cTrader). fxcm_candles ist hier bewusst KEINE Option: die
// FXCM-Serie laeuft nur im Trockenlauf von backfillTradeSetups, es steht keine DB-Zeile darauf.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... [BACKFILL_DRY_RUN=1] \
//     deno run --allow-net --allow-env \
//     supabase/functions/trading-monitor-mcp/scripts/backfillObFvg.ts
import { supabase } from "../supabaseClient.ts";
import { readForexCandlesArchiveFrom } from "../../_shared/forexCandlesArchive.ts";
import { fetchAllRows } from "../../_shared/fetchAllRows.ts";

const M5_SEC = 300;
// Die Kante muss auf den Bruchteil eines Pips genau sitzen; 1e-7 laesst Float-Rauschen durch,
// aber keinen echten Kerzenunterschied (0,01 Pip waeren 1e-6).
const KANTEN_EPSILON = 1e-7;

const trockenlauf = Deno.env.get("BACKFILL_DRY_RUN") === "1";

interface SetupRow {
  id: number;
  instrument: string;
  direction: string;
  ob_top: number;
  ob_bottom: number;
  ob_start_time: string;
}

const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const zeilen = await fetchAllRows<SetupRow>((von, bis) =>
  supabase
    .from("trade_setups")
    .select("id, instrument, direction, ob_top, ob_bottom, ob_start_time")
    .is("ob_fvg", null)
    .order("id", { ascending: true })
    .range(von, bis)
);
console.log(`${zeilen.length} Zeilen ohne ob_fvg.`);
if (zeilen.length === 0) Deno.exit(0);

// Je Instrument EIN Archiv-Lesevorgang ueber die ganze Spanne statt einer Abfrage je Zeile --
// bei mehreren tausend Setups ist das der Unterschied zwischen zwei Requests und mehreren tausend.
const jeInstrument = new Map<string, SetupRow[]>();
for (const z of zeilen) {
  const liste = jeInstrument.get(z.instrument);
  if (liste) liste.push(z);
  else jeInstrument.set(z.instrument, [z]);
}

const updates: { id: number; ob_fvg: number }[] = [];
let kanteDaneben = 0;
let kerzeFehlt = 0;

for (const [instrument, gruppe] of jeInstrument) {
  const zeiten = gruppe.map((z) => sec(z.ob_start_time));
  const vonIso = new Date((Math.min(...zeiten) - M5_SEC) * 1000).toISOString();
  const bisIso = new Date((Math.max(...zeiten) + 2 * M5_SEC) * 1000).toISOString();
  const kerzen = await readForexCandlesArchiveFrom(supabase, instrument, "5m", vonIso, bisIso);
  const jeZeit = new Map(kerzen.map((c) => [c.time, c])); // ArchivableCandle.time ist Unix-Sekunden
  console.log(`${instrument}: ${gruppe.length} Zeilen, ${kerzen.length} M5-Kerzen ab ${vonIso.slice(0, 10)}`);

  for (const z of gruppe) {
    const t = sec(z.ob_start_time);
    const c1 = jeZeit.get(t - M5_SEC);
    const cur = jeZeit.get(t + M5_SEC);
    if (!c1 || !cur) {
      kerzeFehlt++;
      continue;
    }
    const kurz = z.direction === "short";
    // C1-Kante gegenpruefen, bevor irgendetwas gerechnet wird (siehe Kopfkommentar).
    const kante = kurz ? c1.low : c1.high;
    const gespeichert = kurz ? z.ob_bottom : z.ob_top;
    if (Math.abs(kante - gespeichert) > KANTEN_EPSILON) {
      kanteDaneben++;
      continue;
    }
    const fvg = kurz ? z.ob_bottom - cur.high : cur.low - z.ob_top;
    // Eine negative Luecke gibt es nicht -- detectOrderBlocks legt eine Zone nur ueber der
    // Pip-Schwelle an. Taucht sie doch auf, stimmt die Zuordnung nicht.
    if (!(fvg > 0)) {
      kanteDaneben++;
      continue;
    }
    updates.push({ id: z.id, ob_fvg: fvg });
  }
}

const pip = (v: number) => v / 0.0001;
const werte = updates.map((u) => pip(u.ob_fvg)).sort((a, b) => a - b);
console.log(`gerechnet: ${updates.length} | C1-Kante passt nicht: ${kanteDaneben} | Kerze fehlt: ${kerzeFehlt}`);
if (werte.length) {
  console.log(`FVG in Pips -- min ${werte[0].toFixed(2)} | Median ${werte[Math.floor(werte.length / 2)].toFixed(2)} | max ${werte[werte.length - 1].toFixed(2)}`);
  // Sanity: unter 0,5 Pip legt detectOrderBlocks auf M5 keine Zone an. Taucht das auf, ist die
  // Rekonstruktion falsch und nicht bloss ungenau.
  const zuKlein = werte.filter((v) => v < 0.5 - 1e-6).length;
  if (zuKlein) console.log(`ACHTUNG: ${zuKlein} Werte unter der 0,5-Pip-Erkennungsschwelle -- Rekonstruktion pruefen.`);
}

if (trockenlauf) {
  console.log("TROCKENLAUF -- nichts geschrieben.");
  Deno.exit(0);
}

for (let i = 0; i < updates.length; i += 500) {
  const teil = updates.slice(i, i + 500);
  // Einzel-Updates statt eines Upserts: ein Upsert bräuchte alle NOT-NULL-Spalten der Zeile mit.
  await Promise.all(teil.map((u) => supabase.from("trade_setups").update({ ob_fvg: u.ob_fvg }).eq("id", u.id)));
  console.log(`  geschrieben: ${Math.min(i + 500, updates.length)}/${updates.length}`);
}
console.log("fertig.");
