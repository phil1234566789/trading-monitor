# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal Forex/crypto trading dashboard for Philip. Vue 3 SPA (deployed to GitHub Pages) +
Supabase (Postgres + Edge Functions) backend. Live price charts (BTC-USDT via OKX, GBPUSD/EURUSD
via Twelve Data) with order-block/liquidity/trade-setup detection, a cron-driven alert watcher
that posts to Telegram, and a trade journal ("Protokoll").

`PLAN-notifications.md` is a running dev log/plan doc with historical context on major features
and decisions (dated entries) — check it for the "why" behind non-obvious design choices before
assuming something is a bug.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build (GitHub Pages, base path `/trading-monitor/`)
- `npm run test` — run all tests once (Vitest)
- `npm run test:watch` — Vitest watch mode
- `npx vitest run test/<file>.test.js` — run a single test file
- `npm run typecheck` — `tsc` — **only checks the 3 files listed in `tsconfig.json`'s `include`**
  (`src/pivotMarkers.ts`, `src/marketStructureAnalysis.ts`,
  `test/tdd_mit_claude/ranges/tdd_mit_claude.ts`). Nothing else in the repo (not `.vue`, not
  `.js`, not `supabase/functions/**`) is type-checked by this command.

Supabase (edge functions + DB), via `npx supabase` (no global install in this repo):
- `npx supabase functions deploy <name>` — deploy one edge function
- `npx supabase db push` — apply pending migrations in `supabase/migrations/` to the linked
  remote project (there is no local Supabase/Docker dev stack in normal use here — `db push`
  talks straight to the remote DB; ignore the Docker-not-running warning it prints)
- `npx supabase migration repair --status applied <version>` — fix migration-history drift when
  someone ran a migration's SQL by hand in the Supabase dashboard instead of via the CLI (this
  has happened more than once in this repo — `db push` fails with "relation already exists" when
  it does)
- Login/link are already set up against the linked project; `npx supabase login` /
  `npx supabase link --project-ref <ref>` only needed on a fresh machine

## Architecture

### Two runtimes, one algorithm set, deliberately duplicated

Order-block, liquidity-level, and trade-setup detection each exist **twice**, independently
ported, not shared code:

| Concept | Frontend (Vue, live chart) | Backend (Deno edge function, alerting) |
|---|---|---|
| Order blocks | `src/orderBlocks.js` | `supabase/functions/_shared/orderBlocks.ts` |
| Liquidity levels | `src/liquidity.js` | `supabase/functions/_shared/liquidity.ts` |
| Trade setups | `src/tradeSetup.js` | `supabase/functions/_shared/tradeSetup.ts` |

This is unavoidable (browser bundle vs. Deno edge runtime, no shared build step between them),
but it means **a detection-logic bug fix almost always needs to land in both files**. The
Pine Script source of truth for the trade-setup tuning constants lives in a sibling
`tv-indikator` project (`tv-indikator/src/inputs.pine`), referenced in comments but not in this
repo.

### Forex candle data: Twelve Data, not a broker API

GBPUSD/EURUSD candles come from the Twelve Data REST API (`supabase/functions/_shared/twelvedata/client.ts`),
proxied through the `forex-candles` edge function so the frontend never holds the API key.
`src/forexCandles.js` is the frontend fetch wrapper (mirrors the shape of the OKX fetch functions
used for BTC: `{time,open,high,low,close,volume}`, oldest-first).

This replaced a cTrader Open API integration (`supabase/functions/_shared/ctrader/`,
`ctrader-candles` function, `scripts/ctrader-reauth.mjs`, the `ctrader_oauth_tokens` table) after
the broker/challenge provider changed and no longer offered cTrader. That code is intentionally
left in place but unwired (not imported by anything live) rather than deleted, in case a future
broker supports cTrader again — don't be surprised it's there, and don't wire it back up without
checking whether the OAuth tokens are even still valid.

**Twelve Data free tier is tight**: 800 requests/day, 8/minute. Both `poi-watcher` and the
frontend's interactive polling (e.g. toggling the EMA overlay pulls extra M5 history) draw from
the same per-account limit — a 429 from Twelve Data is a real, expected failure mode on the free
tier, not a bug. `poi-watcher` already throttles aggressively (see below); if 429s keep
happening, the real fix is upgrading the plan, not further shaving edge-function requests.

### `poi-watcher`: the alert cron, and its request-budget throttling

`supabase/functions/poi-watcher/index.ts` runs on a `pg_cron` schedule (every 5 min, see
`supabase/migrations/20260713120000_poi_watcher_cron_5min.sql`) and does three things per
instrument (BTC via OKX, GBPUSD/EURUSD via Twelve Data): detect order-block zones, detect 1H
liquidity levels, detect trade setups (M5 sweep + fractal + OB) — persisting all of it to
`ob_zones` / `liquidity_levels` / `trade_setups`, and sending a Telegram message the first time a
zone/level is "touched" by price, gated by both a trading-hours window and per-alert-type toggles
in the `alarm_settings` table (the "Alarme" page in the UI).

Because Twelve Data has only closed candles and a tight rate limit, this function does **not**
naively re-fetch everything every 5 minutes:
- Forex fetching only happens inside a fetch window around the configured trading session
  (`isForexFetchWindow`) — outside it, GBPUSD/EURUSD are skipped entirely (BTC/OKX is unaffected,
  no rate limit there).
- 4H candles are only re-fetched once per 4H boundary (`isH4RefreshTick`); in between, only the
  already-detected zones in `ob_zones` are checked against the live price (no re-fetch, no
  re-detect).
- 1H candles are only re-fetched once per hour (`isH1RefreshTick`); in between, 1H OB-zone/
  liquidity-level checks work the same DB-only way as 4H, and the trade-setup logic (which needs
  a 1H series on every 5-minute run, unlike the zone checks) reads a cached copy from the
  `forex_h1_cache` table instead of re-fetching.
- M5 is fetched every run (trade setups need it fresh) and also supplies the "current price" used
  for live-touch checks — there's no separate M1 ticker call.

If you add a new Twelve-Data-backed feature to `poi-watcher`, think about which of these three
throttling tiers it belongs to before wiring in a fresh per-run fetch.

### Market structure algorithm (`src/marketStructureAnalysis.ts`)

The "1h-Range" trend/protected-low/LQ-sweep algorithm (confirms uptrends from H1 pivots, tracks a
rolling protected-low, reclassifies swept lows) has its rules indexed in
[`src/marketStructureAnalysis.rules.md`](src/marketStructureAnalysis.rules.md) — one sentence per
rule plus a pointer to the exact test that verifies it, not a restatement of the logic (that would
drift). **Whenever you change a rule in this file (not just refactor), update the matching line in
`marketStructureAnalysis.rules.md` in the same change** — add a new row for a new rule, adjust the
wording for a changed one, add a test reference once a new test exists. Don't let this doc fall
behind the algorithm the way the JS/TS detection-logic duplication above already does.

Since 2026-07-31, this file holds ONLY the pure algorithm (no chart drawing, no browser-only
imports) — the state-to-chart-primitives rendering (`renderMarketStructureAnalysis` and friends)
was split out into `src/marketStructureRendering.ts`, specifically so the algorithm stays importable
outside the browser (see CLAUDE.md "MCP server" → `get_data_export`'s structure-trend). Don't add a
new rendering-related import (chart colors, line widths, lightweight-charts primitives) back into
`marketStructureAnalysis.ts` — that belongs in the rendering file instead.

### Frontend data flow (`PriceChart.vue`)

`src/components/PriceChart.vue` is the largest component and the hub: it fetches candles (OKX for
BTC, `forexCandles.js` for GBPUSD/EURUSD), runs the frontend copies of the detection algorithms,
renders everything via `lightweight-charts` primitives, and drives the debug-metadata panel (see
below). `src/candleCache.js` (`fetchCandlesCached`) wraps the raw fetch functions with an
incremental-fetch cache so timeframe/symbol switches and polling don't refetch a whole window
just to get the newest bar.

### Settings sync: localStorage-first, Supabase as cross-device source of truth

Chart colors (`src/chartColors.js`) and sessions (`src/sessions.js`) both follow the same pattern,
used because it needs no auth (single-user app, RLS policies just allow `anon`):
1. Load from `localStorage` synchronously for instant render.
2. Async-fetch from Supabase on load; if the DB has rows, they win and overwrite local state.
3. If the DB is empty but local state isn't, push local state up once (bootstrap) — this is what
   lets a brand-new device pick up settings from whichever device already has them, without ever
   letting an empty device silently blank out an existing configuration.
4. Every local mutation writes to `localStorage` immediately and to Supabase debounced (500ms).

`chart_colors` is a fixed key/value set (upsert-only). `sessions` is a dynamic list with
add/remove, so its remote save is a full delete-then-insert rather than a per-row upsert. There
is no real conflict resolution — last device to save wins — which is an accepted tradeoff for a
single-user app, not an oversight.

### Debug metadata panel

`.debug/metadata.json` (gitignored, machine-local) holds a snapshot of the chart's current live
state — symbol, timeframe, replay state, and the data for whichever overlays are currently
toggled on (`buildActiveMetadataSnapshot` in `PriceChart.vue`, gating logic in
`debugMetadata.js`). It's written automatically: once on mount and then every 30s
(`DEBUG_AUTOSAVE_INTERVAL_MS`) via a POST to a dev-only Vite middleware (`vite.config.js`,
`saveDebugMetadataLocally`) — **only while `vite dev` is running** (`import.meta.env.DEV`; the
endpoint doesn't exist in a production build). There's also a "📋 kopieren + lokal speichern"
button in the debug-metadata panel for an on-demand clipboard copy + save, kept as a **separate**
function from the auto-save specifically so the 30s timer never silently clobbers the system
clipboard.
Read this file when asked to debug something about the live chart state instead of asking the
user to hand-transcribe numbers from their screen — but it only reflects whatever machine most
recently had `vite dev` running, so check the file's mtime (or just ask) before trusting it's
current.

### Trading-hours / timezone handling

User-facing trading-session logic (session bands on the chart, `poi-watcher`'s alert window) is
timezone-aware via `Intl.DateTimeFormat` with `timeZone: "Europe/Berlin"`, not fixed UTC offsets —
this is deliberate (DST correctness was a specific bug report) and any new time-window logic
should follow the same pattern rather than hardcoding a UTC offset. `poi-watcher`'s Twelve-Data
refetch-throttle boundaries (`isH1RefreshTick`/`isH4RefreshTick`) are the one exception and use
raw UTC hours on purpose, since they need to align with Twelve Data's own (UTC-based) candle
boundaries and the UTC-based `pg_cron` schedule, not with Berlin trading hours.

**When Claude transcribes/seeds a timestamp itself** (e.g. a one-off data migration entering
trade history Philip pasted from a screenshot or a broker/bot export), default the source
timestamp to **Europe/Berlin local time**, not UTC, before converting to the UTC value actually
stored — Philip is in Germany, and unless he explicitly says a timestamp is already UTC (or some
other zone), assume it isn't. Bug report 2026-07-30: 11 seeded BTC trades were off by exactly 2h
because the raw pasted timestamps were entered as literal UTC instead of being treated as
CEST/UTC+2 first. Double-check CEST vs. CET for the actual date rather than assuming a fixed
offset.

Per-instrument trading/alarm windows (which weekdays and hours a trade may open, and separately
when `poi-watcher` is allowed to actually send a Telegram message) live in the `trading_schedules`
table, edited via the "Handelszeiten" page — **not** hardcoded constants. This replaced a single
global `isTradingHours()` window that checked only the time of day, never the weekday (bug report
2026-07-25: a Saturday Telegram alert fired because Twelve Data keeps serving candles on weekends
too). `poi-watcher` reads `alarm_windows` per instrument each run (`isInWindows()`); `trading_windows`
on the same table is currently reference/display-only, read by the Handelszeiten page but not yet
gating anything in code. Per-asset chart sessions (`sessions` table/`src/sessions.js`, edited via
the Sessions modal on the chart) got an `instrument` column at the same time (one session list per
asset, no longer global) plus a `danger` level (`normal`/`caution`/`forbidden`) — this is how a
sub-window like the GBPUSD/EURUSD "MMM" caution session or a BTC no-trade window is expressed,
rather than a second schedule concept.

### Trade journal: `dealing_ranges` vs. `trade_positions`

Since 2026-07-31, the trade journal is split into two tables instead of one flat `signals` row:

- **`dealing_ranges`** — the trade *idea* (POI → target, "dealing range" in Philip's own
  terminology): `instrument`, `direction`, `invalidation` (the price at which the whole idea is
  invalidated — NOT necessarily any one execution's stop-loss), `trade_setup_id` (link to the
  detected M5-sweep+fractal+OB pattern that originated the idea).
- **`trade_positions`** (renamed from `signals`) — one *execution* of that idea: `entry_price`,
  `stop_loss`, `exit_price`/`exit_time`, `outcome`, `r_multiple`, `source`, `reasoning`,
  `trading_account_id`, FK'd to its `dealing_range_id`. A dealing range can have 1-n positions
  (re-entries), each with its own entry/stop/outcome — Philip's explicit reasoning: "pro
  Positions-Ausführung kann es sein, dass sie verschiedene Entry-Kriterien hatten [...] nur die
  Invalidierung der gesamten Trade-Idee gehört zur dealing range. Stop Loss gehört zu einer
  Positions-Ausführung."

`trade_targets` (planned target levels) FK to `dealing_ranges` — a target applies to the whole
idea, shared across every re-entry underneath it. `trade_partial_exits` stay FK'd to
`trade_positions` — partial closes belong to one specific execution.

`trade_confirmations` is dual-level on purpose: a row FKs to *either* `dealing_range_id` *or*
`trade_position_id` (nullable columns, `CHECK` constraint enforcing exactly one is set, not a
generic `parent_type`/`parent_id` pair) — Philip: "gibt confirmations, die mir das GO für die
dealing range gibt, gibt noch andere confirmations, die mir das go für den entry geben." The old
`setup_entry` column (the entry-criteria price for a specific execution, formerly its own field on
`signals`) was dropped entirely and folded into this — an entry criterion and a confirmation are,
in Philip's words, "so ziemlich das gleiche". `createTradeFromSetup` (`src/tradeIntake.js`) now
inserts the M5-OB-derived entry price as a `kind='ob'` confirmation on the new position instead of
a separate field. There's no UI yet to add a *dealing-range-level* confirmation (only
position-level, via the existing Trade-Modus "Bestätigung hinzufügen" flow) — deferred along with
the TSC rework below, not an oversight.

`src/trades.js`'s `fetchTrades` still returns one flat row per **position** (not per dealing
range) with the parent range's fields embedded (`instrument`/`direction`/`invalidation`/
`tradeSetupId`/`dealingRangeId`) — this keeps `TradesTable.vue`/`TradeEditModal.vue`/
`PriceChart.vue`'s existing one-row-per-trade rendering working unchanged. There is deliberately no
new UI yet for viewing a dealing range as a group of its positions, or for adding a second
position/re-entry to an existing range — Philip, same chat: the TSC ("heftig veraltet") is the
next thing to tackle, this change is the data-layer foundation for that, not the UI rework itself.

### Trade-Setup-Cockpit: No-Gos and anti-confluences

`src/tradeSetupCockpit.ts` (see the file's own header comment for the aggregation-only rule) tracks
things that speak *against* taking a trade, shown as a "Spricht dagegen" section on the cockpit
card. `AntiConfluence.isNoGo` is a hard block (always locks the card, shown as "🚫 KEIN TRADE"),
independent of `ANTI_CONFLUENCE_THRESHOLD` (currently 10) — deliberately not modeled as
"weight == threshold" so raising the threshold later can never silently unblock a No-Go.

High-impact economic news is a No-Go, sourced from the `news_events` table — **not** an external
news API. Philip sends a ForexFactory calendar screenshot (already filtered to EUR/GBP/USD, only
the red/high-impact rows matter); Claude reads the red rows off the screenshot and writes them via
a one-off data migration (e.g. `supabase/migrations/20260726120100_news_events_seed_2026-07-23.sql`),
same pattern as the existing one-off data migrations in this repo (see e.g.
`20260705170000_move_test_trade_entry.sql`). ForexFactory calendar times are Europe/Berlin,
DST-aware — convert to UTC before inserting. `currentNewsNoGo()` treats an event as a No-Go for
±`NEWS_NOGO_WINDOW_MINUTES` (30, a judgment call, not something Philip specified) around its
timestamp, for whichever instrument's currency pair it affects (`EURUSD`→EUR/USD, `GBPUSD`→GBP/USD).
`syncNewsEvents()` (`src/newsEvents.js`) loads the **entire** table, no "recent only" filter — an
earlier version filtered to the last 24h and that silently hid any event more than a day old,
breaking both the No-Go check and the chart markers below for anything not freshly entered; the
table stays small enough (a few rows/week) that loading everything is simpler and safer than
re-adding a filter.

There's also a second, manual write path: `NewsModal.vue` ("⚙" next to the "News" toolbar toggle,
`addNewsEvent`/`removeNewsEvent` in `src/newsEvents.js`) for when Claude isn't available to
transcribe a screenshot. The table's RLS grants anon both `SELECT` (original migration) and
`INSERT`/`UPDATE`/`DELETE` (`20260726150000_news_events_anon_write.sql`, added once the manual path
existed) — same permissive anon-write model as sessions/chart_colors/trading_schedules. Unlike
those stores, this one does **not** do a "local array mirrors remote, full delete+insert on save"
sync (sessions.js's pattern) — Claude's migration-inserted rows and Philip's browser-inserted rows
coexist in the same table, so writes are per-row insert/delete followed by a full re-fetch, never a
bulk resync that could wipe out rows the other path added.

News events also get a purely visual marker on the chart (`src/newsMarkers.js`, "News" toolbar
toggle next to EMA/Replay in `Dashboard.vue`) — a dashed vertical line at each relevant event's
time, independent of the TSC's No-Go window (shows past AND future events, not just ones inside
±30min of now). Its labels hide at low zoom via the same `canShowLabels`/`MIN_PIXELS_PER_HOUR_FOR_LABELS`
threshold as session-band labels — that's expected, not a bug, if a label seems to be missing. The
label itself (`formatEventLabel()`) is deliberately just weekday-short + time (Europe/Berlin,
e.g. "Do 14:15"), drawn rotated 90° anchored at the bottom of the pane — not currency/title, that
was Philip's explicit call ("bissl beschriften, damit man sie leichter zuordnen kann"), not an
oversight. Its color is `chartColors.newsEvent` (StyleModal group "News"), like every other
chart-drawn indicator in this repo — don't hardcode a color literal here if you touch this file.

### MCP server (`mcp-server/`)

A local, stdio-transport MCP server exposing this app's data as tools for Claude, added 2026-07-31
to replace the manual "Daten-Export button → copy/paste into a separate claude.ai Project → paste
drawings back" workflow. Own `package.json`/`tsconfig.json` (separate deps from the Vite frontend:
`@modelcontextprotocol/sdk`, `@supabase/supabase-js`, `zod`, run via `npx tsx`, no build step for
local use). Registered project-scoped in the committed `.mcp.json` (alongside the pre-existing
`okx-market` server) — auto-available whenever this repo is opened in Claude Code, after a one-time
approval prompt.

**Auth**: same anon-key pattern as `src/supabaseClient.js` (not service_role) — every table it
touches already has permissive anon RLS (see the tables' migrations). Read-only for
`ob_zones`/`liquidity_levels`/`trade_setups`/`trade_partial_exits`/`news_events`/
`trading_schedules`/`trading_accounts`; read+insert for `claude_annotations` (matches
`src/claudeAnnotationsStore.js`'s own insert shape exactly); full read/write for `dealing_ranges`/
`trade_positions`/`trade_targets` via the trade-journal tools (see below).

**`get_data_export` is the intended first call** in a session (its tool description tells Claude
this explicitly) — bundles M5 candles + Asia-session range, the 1H structure/trend, relevant
liquidity levels, and relevant OB zones for an instrument in one call, so Claude doesn't have to
fire off half a dozen granular `get_*` tools just to get oriented (Philip's explicit ask
2026-07-31). Structure-trend params (`periodOuter`/`periodInner`/`lookbackHours*`/
`fixedStartActive`/`fixedStartTime`) default to the same rolling 7-day/period-5/2 values as the
"Daten-Export" button — if Philip has a non-default "fixer Start" set in his Dashboard, that only
lives in his browser's `localStorage` (never synced to Supabase, unlike sessions/chartColors), so
the tool can't discover it on its own; Laniakea (`/l`) should ask Philip when it matters, not guess.

**Why this isn't just `src/dataExport.js` reused verbatim**: `buildDataExport` (and everything it
transitively imports — `liquidity.js`, `chartColors.js`, `sessions.js`) touches `localStorage` and
Vite's `import.meta.env` at module-load time, which don't exist under plain Node — importing any of
it here crashes immediately. `mcp-server/src/db.ts` instead reads the already-persisted
`ob_zones`/`liquidity_levels` tables (written by `poi-watcher` every 5min) rather than re-detecting
from candles — no third port of the detection algorithms, no drift risk. Small, stable,
self-contained pieces (the Berlin-timezone date-range math, the liquidity "relevant"-levels filter,
the `claude_annotations` JSON-shape validation) ARE duplicated here in Node-safe form, since
re-deriving those from scratch would be worse than a small, low-risk copy — see
`mcp-server/src/berlinTime.ts`, `db.ts`'s `filterRelevantRows`, `tools/annotations.ts`'s
`validateAnnotations`. If you change the originals (`src/dataExport.js`'s Berlin-time helpers,
`src/liquidity.js`'s `filterRelevantLevels`, `src/claudeAnnotations.js`'s `validateAnnotationList`),
check whether the port here needs the same fix.

**Trade-journal write tools (`tools/trades.ts`, added 2026-07-31)**: `create_trade` inserts a
`dealing_ranges` row (the idea — instrument/direction/invalidation/`trade_setup_id`) plus ONE
`trade_positions` row (the execution — entry/stop/exit/outcome/`trading_account_id`) plus optional
`trade_targets`, matching the entity split from `20260731120000_dealing_ranges_trade_positions.sql`
(see that migration's own comment for the full "idea vs. execution, 1-n" reasoning). No real
transaction (the Supabase JS client can't do that without a dedicated Postgres RPC) — on failure
after the `dealing_ranges` insert, `createTrade` deletes that row again rather than leaving an
orphan. `update_trade_position`/`update_dealing_range` patch only the fields actually passed
(`Object.keys(fields)`-driven, see `db.ts`), so omitting a field leaves it untouched while passing
`null` explicitly clears it. `add_trade_position(dealingRangeId, ...)` adds a SECOND (or third, ...)
execution to an EXISTING `dealing_ranges` row instead of making a new idea — common case per Philip
2026-07-31 ("es gibt ja auch dealing ranges, wo ich keinen entry finde oder meine Limit Order nicht
abgeholt wird"), i.e. re-entries or a delayed fill on the same idea. Shares its insert logic with
`create_trade` via `db.ts`'s `insertTradePosition`/`TradePositionInput` — don't duplicate that
field-mapping if you touch either tool, change the shared helper instead. `dealingRangeId` is the
same id Philip refers to verbally via the chart's "Long#18"/"Short#N" numbering. Unlike
`post_chart_annotations`, these are deliberately NOT allow-listed — a wrong chart drawing is cosmetic, a wrong journal entry corrupts
Philip's trade history, so they still prompt for confirmation unless Philip says otherwise.

**`marketStructureAnalysis.ts` / `marketStructureRendering.ts` split (2026-07-31)**: the trend
algorithm used to be one file that imported `liquidity.js` (for `detectLiquidityLevels`) and, for
its own chart-drawing half, `chartColors.js`/`chartLineWidths.js` — both of which crash under Node
(see above). Investigation showed only ONE function (`detectLiquidityLevels`) was actually needed by
the pure pivot/trend math (`computeRangesPivots`/`buildMarketStructureState`/
`summarizeMarketStructureState`); everything else imported from `liquidity.js` was used exclusively
by the drawing code. Fix: `detectLiquidityLevels`/`filterRelevantLevels`/the fractal-detection
internals moved to a new dependency-free `src/liquidityDetection.js` (`liquidity.js` now imports and
re-exports from there, so its own public API is unchanged); `marketStructureAnalysis.ts` was split
at its own "--- Zeichnung ---" comment marker — everything above (the algorithm) stayed, everything
below (`renderMarketStructureAnalysis`, `collectH1LqLevels`, `computeFibLevels`/`collectFibLevels`,
the Arrow/RangeLine/FibTick primitive classes) moved to the new `src/marketStructureRendering.ts`,
which still imports `chartColors.js`/`liquidity.js`'s primitives as before. `pivotTimeOf` had to be
exported from `marketStructureAnalysis.ts` (was module-private) since the rendering file's CHoCH-
label code needs it across the new file boundary. `PriceChart.vue` and the affected tests now import
`renderMarketStructureAnalysis`/`collectH1LqLevels`/`collectFibLevels`/`computeFibLevels`/
`RANGE_FIB_MIN_PP_DISTANCE_PIPS` from `marketStructureRendering` instead of `marketStructureAnalysis`
— everything else (`computeRangesPivots`/`buildMarketStructureState`/`summarizeMarketStructureState`/
`initMarketStructureState`/`applyMarketStructurePivot`/`applyInnerMarketStructurePivot`/
`pivotForDisplay`) kept its old import path, unchanged for existing callers. `tsconfig.json`'s
`include` list covers both files now. `mcp-server/tsconfig.json` uses `moduleResolution: "bundler"`
+ `allowJs: true` + `noEmit: true` (matching the root tsconfig) specifically so it can type-check
this cross-directory import (`../../../src/marketStructureAnalysis.js`) without NodeNext's stricter
extension/declaration-file rules producing spurious errors — this doesn't affect the mcp-server's
actual runtime (it always runs via `tsx`, never via `tsc` emit).

**Write tool (`post_chart_annotations`) safety**: originally deliberately kept OFF any permission
auto-allow list ("Schreiben nur mit Philips Zustimmung", Philip 2026-07-31, same day) — reversed a
few hours later the same day ("L darf jetzt immer zeichnen, brauch kein go von mir"), now allow-
listed in `.claude/settings.local.json` (`mcp__trading-monitor__post_chart_annotations`, gitignored
personal-machine setting, not `.claude/settings.json`) so it runs without a confirmation prompt.
If Philip asks to tighten this again, remove that allow-list entry — there's no other gate.

**"Laniakea" persona (`/l`)**: `.claude/commands/l.md` switches a session from this file's normal
coding-assistant behavior into "Laniakea", Philip's trading-sparring-partner persona (Bias/Setup-
analysis, not code) — pointer to `trading/claude-project-instructions.md` (the same persona
instructions used in Philip's separate claude.ai Project) plus a note to use this repo's MCP tools
for live data instead of waiting for pasted charts. Deliberately NOT merged into this file's own
instructions (see "MCP server" intro above) — the persona only applies when explicitly invoked, not
to every session in this repo.

## Conventions

- Comments are in German, and are written to explain **why** (a past bug, a non-obvious
  constraint, a rejected alternative), not what the code does. Match this when editing
  existing files.
- **Respond to Philip in German** (chat replies, not just code comments) — confirmed 2026-07-30
  ("bro DEUTSCH!"). Code identifiers/commit messages/PR text stay English as usual; this is about
  the conversational reply text.
- Prefer small, targeted edits with a comment explaining the non-obvious reasoning over
  refactoring for its own sake — this is a solo hobby project with a lot of hard-won bugfix
  history encoded in comments; don't erase that context while "cleaning up."
- When explaining a detection-algorithm bug that hinges on price levels/timing (why a setup did
  or didn't fire, why a sweep did or didn't count), default to a Claude Artifact with an annotated
  price diagram (candles + the relevant levels/zones/callouts, reusing this app's own
  `chartColors.js` tokens: `candleUp`/`candleDown`/`liquidityLow`/`liquiditySweep`/`obBull` etc.)
  instead of a purely textual walkthrough — confirmed 2026-07-28 ("WOW hammer hammer hammer!
  Nächstes mal bitte genauso, dann muss ich den Text nicht so anstrengend cognitiv übertragen").
  A text explanation is fine for non-price-geometric questions (e.g. "does X path apply to both
  Long and Short").
- **When renaming a user-facing label/feature, rename the underlying code identifiers too, not
  just the visible string** — file names, component names, function/variable names, CSS classes,
  debug-metadata section keys, and comments that reference the old name. Bug report 2026-07-31:
  the "Backtest-Daten" button was renamed to "Daten-Export" but `backtestExport.js`,
  `BacktestExportModal.vue`, `showBacktestExport`, `.backtest-export-btn` etc. were left as-is —
  Philip explicitly called this out ("das dient zur code-lesbarkeit"). Do the full rename in the
  same change (`git mv` for files, update every import), and verify with a repo-wide grep for the
  old name afterward, not just the one call site that was pointed at.
