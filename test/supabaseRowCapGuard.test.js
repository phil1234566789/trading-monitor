import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

// PostgREST deckelt jede Antwort serverseitig bei ~1000 Zeilen — ohne Fehler, ohne Log, einfach
// stillschweigend weniger Zeilen (CLAUDE.md-Gotcha). Derselbe Bug schlug dreimal in drei Tagen zu
// (poi-watcher trade_setups 20.09., src/obZones.js 22.09.), obwohl Gotcha und Paginier-Helfer seit
// Wochen existieren: wer einen Zweizeiler schreibt, liest keine Doku. Dieser Test ist die Mechanik
// dazu — er scannt die Quellen selbst statt sich auf Erinnerung zu verlassen.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['src', 'supabase/functions'];
const SCAN_EXT = /\.(js|ts|vue)$/;

// Eine Kette gilt als gedeckelt, wenn sie die Zeilenzahl selbst begrenzt (limit/range/single) oder
// gar keine Zeilen holt (head: true zählt nur).
const BOUNDED = /\.\s*(limit|range|single|maybeSingle)\s*\(|head\s*:\s*true/;
// Schreibketten haben kein Cap-Problem — die Zeilenzahl kommt aus dem Aufruf, nicht aus der Tabelle.
const WRITE = /\.\s*(insert|update|upsert|delete)\s*\(/;

// Ein Deckel ÜBER der Serverschwelle deckelt nichts: PostgREST kappt bei max_rows (supabase/
// config.toml: 1000), egal was die Kette anfragt — .limit(5000) sieht gedeckelt aus und wird
// trotzdem still abgeschnitten. Nur LITERALE prüfen; .range(from, from + DB_READ_PAGE_SIZE - 1)
// aus den Paginierern ist gewollt und gar nicht auswertbar.
const MAX_ROWS = 1000;
function overCap(chain) {
  const lim = /\.\s*limit\s*\(\s*(\d+)\s*\)/.exec(chain);
  if (lim && +lim[1] > MAX_ROWS) return `limit(${lim[1]}) liegt über max_rows ${MAX_ROWS}`;
  const rng = /\.\s*range\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(chain);
  const span = rng && +rng[2] - +rng[1] + 1;
  if (span && span > MAX_ROWS) return `range spannt ${span} Zeilen, über max_rows ${MAX_ROWS}`;
  return null;
}

// Bewusst unbegrenzte Lesezugriffe. Diese Liste IST die Dokumentation, warum eine Abfrage ohne
// Deckel auskommt — ein neuer Eintrag ist eine Entscheidung, kein Durchwinken. Wächst eine dieser
// Tabellen doch in Richtung 1000 Zeilen, gehört sie hier raus und die Abfrage paginiert.
const ALLOWLIST = new Set([
  // Konfigurationstabellen: eine Zeile je Einstellung, wachsen nicht mit dem Handelsbetrieb.
  'src/alarmSettings.js:alarm_settings',
  'src/chartColors.js:chart_colors',
  'src/chartLineWidths.js:chart_line_widths',
  'src/sessions.js:sessions',
  'src/tradingAccounts.js:trading_accounts',
  'src/tradingSchedules.js:trading_schedules',
  'supabase/functions/poi-watcher/index.ts:alarm_settings',
  'supabase/functions/poi-watcher/index.ts:sessions',
  'supabase/functions/poi-watcher/index.ts:trading_schedules',
  'supabase/functions/trading-monitor-mcp/db.ts:sessions',
  'supabase/functions/trading-monitor-mcp/db.ts:trading_accounts',
  'supabase/functions/trading-monitor-mcp/scripts/rsiDivergenceStats.ts:sessions',

  // Begrenzt durch die EINGABE der Abfrage, nicht durch die Tabellengröße: .in(<Liste aus einem
  // schon gedeckelten Vorlauf>) bzw. .eq(<eine ID>). Die Tabelle darf hier beliebig wachsen.
  'supabase/functions/poi-watcher/index.ts:trade_setups',          // .in über die höchstens zwei gerade erkannten OBs
  'supabase/functions/daily-structure-pivots/index.ts:daily_structure_pivots', // .gte ab dem ältesten erkannten Pivot
  'src/drawingsStore.js:claude_annotations',              // .eq(instrument) + .eq(date)
  'src/loopState.js:trading_loop_state',                           // .eq(date_str)
  'src/trades.js:trade_targets',
  'src/trades.js:trade_partial_exits',
  'src/trades.js:trade_evidence',
  'src/trades.js:dealing_ranges',
  'supabase/functions/trading-monitor-mcp/db.ts:trade_evidence',
  'supabase/functions/trading-monitor-mcp/db.ts:trade_targets',

  // Pins legt Philip von Hand an und räumt sie genauso wieder weg (remove_pin_entry) — es sind
  // immer eine Handvoll gleichzeitig, kein monotones Wachstum.
  'src/pinContext.js:pin_context',
  'supabase/functions/poi-watcher/index.ts:pin_context',
]);

function blankComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (SCAN_EXT.test(e.name)) out.push(p);
  }
  return out;
}

// Liest die Methodenkette ab `.from(` weiter, solange nach der schliessenden Klammer wieder ein
// `.methode(` folgt — deshalb über Zeilengrenzen hinweg, statt zeilenweise zu greppen.
function readChain(src, start) {
  let i = start;
  for (;;) {
    const m = /^\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(src.slice(i, i + 200));
    if (!m) break;
    let j = i + m[0].length;
    for (let depth = 1; j < src.length && depth > 0; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') depth--;
    }
    let k = j;
    while (k < src.length && /\s/.test(src[k])) k++;
    if (src[k] !== '.') { i = k; break; }
    i = k;
  }
  return src.slice(start, i);
}

function findUnbounded() {
  const hits = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file).split('\\').join('/');
      const src = blankComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(/\.from\(\s*["'`]([\w]+)["'`]\s*\)/g)) {
        const chain = readChain(src, m.index);
        if (!chain.includes('.select(') || WRITE.test(chain)) continue;
        const zeile = src.slice(0, m.index).split('\n').length;
        // Vor der Allowlist: die begründet, warum eine Abfrage OHNE Deckel auskommt — ein Deckel
        // über max_rows ist davon unabhängig immer falsch und darf nicht mit weggewunken werden.
        const zuGross = overCap(chain);
        if (zuGross) { hits.push(`${rel}:${m[1]}  (Zeile ${zeile})  ${zuGross}`); continue; }
        if (BOUNDED.test(chain)) continue;
        // Über eine Variable gebaute Ketten (let query = supabase.from(...); query = query.eq(...))
        // enden hier vor ihrem Abschluss — deshalb die Variable im Rest der Datei nachverfolgen.
        const varName = /(?:^|[;{}\n])\s*(?:let|var|const)?\s*([A-Za-z_$][\w$]*)\s*=\s*[^=;]*$/
          .exec(src.slice(Math.max(0, m.index - 300), m.index))?.[1];
        // Grosszuegig: irgendwo nach einer Erwaehnung der Variablen folgt der Abschluss, evtl. erst
        // hinter ein paar .eq()/.order()-Gliedern (z.B. fetchTrades in src/trades.js). Lieber ein
        // Fund zu wenig als ein Test, der bei jedem Refactoring rot wird und deshalb wegschaut.
        if (varName && new RegExp(String.raw`\b${varName}\b[\s\S]{0,300}?\.\s*(limit|range|single|maybeSingle)\s*\(`).test(src)) continue;
        const key = `${rel}:${m[1]}`;
        if (ALLOWLIST.has(key)) continue;
        hits.push(`${key}  (Zeile ${zeile})  ohne limit/range/single  ${chain.replace(/\s+/g, ' ').slice(0, 90)}`);
      }
    }
  }
  return hits;
}

it('holt keine Tabelle ohne limit/range/single — sonst schneidet PostgREST bei ~1000 Zeilen still ab', () => {
  expect(findUnbounded()).toEqual([]);
});
