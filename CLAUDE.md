# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal Forex trading dashboard for Philip. Vue 3 SPA (deployed to GitHub Pages) +
Supabase (Postgres + Edge Functions) backend. Live price charts (GBPUSD/EURUSD via cTrader Open
API) with order-block/liquidity/trade-setup detection, a cron-driven alert watcher that posts to
Telegram, and a trade journal ("Protokoll"). Until 2026-08-21 this also tracked BTC-USDT via OKX
(crypto) alongside Forex — Philip stopped trading BTC with the current strategy, so that code path
(frontend chart branch, `poi-watcher`'s OKX fetch, the `okx-market` MCP server) was removed
entirely; existing BTC rows in `ob_zones`/`trade_positions`/etc. are untouched, just no longer
written to or read from by live code.

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

### Forex candle data: cTrader Open API (again), not Twelve Data

GBPUSD/EURUSD candles come from the cTrader Open API (`supabase/functions/_shared/ctrader/client.ts`,
`ctrader_oauth_tokens` table for the OAuth token pair), proxied through the `forex-candles` edge
function so the frontend never holds credentials directly. `src/forexCandles.js` is the frontend
fetch wrapper — response shape `{time,open,high,low,close,volume}`, oldest-first.

This flipped back and forth twice — worth knowing the full history since the "current" state has
changed direction before and may again:
1. Originally cTrader, on a prop-firm challenge account.
2. The challenge account got deactivated (twice, actually — both prior cTrader outages were this,
   not a Spotware/cTrader problem itself) → switched to the Twelve Data REST API
   (`supabase/functions/_shared/twelvedata/client.ts`) as a broker-independent fallback.
3. Bug report 2026-07-27 ("Setups auf FOREXCOM sichtbar, auf Twelve Data nicht"): Twelve Data
   aggregates 60+ liquidity providers, and that aggregation smooths away the exact wick extremes
   the FVG/OB detection depends on — a structural mismatch, not a bug in `orderBlocks.ts`/`liquidity.ts`.
4. **Since 2026-08-03: back to cTrader**, this time on a regular Pepperstone Razor demo account
   instead of a prop-firm challenge (see `PLAN-notifications.md` "Status: cTrader Open API" for the
   full writeup) — chosen specifically to avoid another challenge-account deactivation.

The Twelve Data client code (`_shared/twelvedata/`) is the one left in place-but-unwired now (mirror
image of how the cTrader code sat unused during step 2) — don't be surprised it's still there, and
don't assume it's what's live without checking `poi-watcher`'s `INSTRUMENTS` config first (all
entries fetch via cTrader now that BTC/OKX is gone, see below).

**cTrader's hard limit is 14000 bars/request** (see `fetchOneTrendbar` in `_shared/ctrader/client.ts`)
— generous compared to Twelve Data's free-tier 800/day, 8/minute, which is why `poi-watcher`'s
throttling (see below) is no longer about surviving a tight rate limit; it's now purely for cache
consistency and to avoid hammering the OAuth-token-backed connection unnecessarily.

### `poi-watcher`: the alert cron, and its request-budget throttling

`supabase/functions/poi-watcher/index.ts` runs on a `pg_cron` schedule (every 5 min, see
`supabase/migrations/20260713120000_poi_watcher_cron_5min.sql`) and does three things per
instrument (GBPUSD/EURUSD via cTrader): detect order-block zones, detect 1H
liquidity levels, detect trade setups (M5 sweep + fractal + OB) — persisting all of it to
`ob_zones` / `liquidity_levels` / `trade_setups`, and sending a Telegram message the first time a
zone/level is "touched" by price, gated by both a trading-hours window and per-alert-type toggles
in the `alarm_settings` table (the "Alarme" page in the UI).

Only closed candles are available (no live ticker), so this function does **not** naively
re-fetch everything every 5 minutes — this throttling predates the 2026-08-03 switch back to
cTrader (it was originally built to survive Twelve Data's tight rate limit) but is kept
unchanged for cache consistency, not because cTrader needs it the same way:
- Forex fetching only happens inside a fetch window around the configured trading session
  (`isForexFetchWindow`) — outside it, GBPUSD/EURUSD are skipped entirely.
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

`src/components/PriceChart.vue` is the largest component and the hub: it fetches candles
(`forexCandles.js` for GBPUSD/EURUSD), runs the frontend copies of the detection algorithms,
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
sub-window like the GBPUSD/EURUSD "MMM" caution session is expressed, rather than a second
schedule concept.

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

### MCP server (`mcp-server/` source → `supabase/functions/trading-monitor-mcp/` deployed)

Exposes this app's data as tools for Claude, added 2026-07-31 to replace the manual "Daten-Export
button → copy/paste into a separate claude.ai Project → paste drawings back" workflow. Originally a
local, stdio-transport server (`mcp-server/`, `npx tsx src/index.ts`) — **since 2026-08-16/17
(`c0fb43b`/`c154887`) deployed as the `trading-monitor-mcp` Supabase Edge Function**, HTTP transport,
so it no longer needs Claude Code (or any local process) running to work. `.mcp.json` now points at
`https://<project>.supabase.co/functions/v1/trading-monitor-mcp` with an
`Authorization: Bearer ${TRADING_MONITOR_MCP_TOKEN}` header (own bearer-token scheme, not a Supabase
JWT — `verify_jwt = false` for this function in `supabase/config.toml`, same pattern as milk-city's
own `mcp` function) instead of the old "one-time local approval prompt" flow. Because the transport
is HTTP now rather than stdio, this server (like milk-city's) can also be registered as a custom/
remote connector directly in Claude Desktop or claude.ai — not just Claude Code.

`mcp-server/` (own `package.json`/`tsconfig.json`, `@modelcontextprotocol/sdk`/`@supabase/supabase-js`/
`zod`, run via `npx tsx`) still exists and is **not dead code** — it's the hand-edited authoring
source: a change is written there first, then manually ported into
`supabase/functions/trading-monitor-mcp/` (Deno-compatible imports — `npm:`-prefixed specifiers and
`.ts` instead of `.js` extensions, see `c0fb43b`'s commit message for the exact conversion steps). The
two copies are otherwise kept identical; if you change tool logic in one, check whether the other
needs the same edit. `mcp-server/src/scripts/` (`backfillForexCandles.ts`, `backfillObZones.ts`,
`backfillLiquidityLevels.ts`, `rsiDivergenceStats.ts`) is the one part that stays Node-only on
purpose — one-off local scripts,
never ported to the edge function (a stray copy of these was even removed again from the edge
function directory in `c154887` for exactly that reason).

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
`fixedStartActive`/`fixedStartTime`) default to the same period-5/2 values as the "Daten-Export"
button, but a longer 21-day rolling lookback (`STRUCTURE_LOOKBACK_HOURS` in `dataExport.ts`,
mcp-server-only — the button itself stays at 7 days) — bumped from 7 days 2026-08-09 because a
too-short window can cut off the origin of a multi-level nested trend (see
`marketStructureAnalysis.rules.md` "beliebige Verschachtelungstiefe") before it ever forms. If
Philip has a non-default "fixer Start" set in his Dashboard, that only
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
few hours later the same day ("L darf jetzt immer zeichnen, brauch kein go von mir"). **Since
2026-08-17 (`a9cd42b`), `post_chart_annotations` is documented as NACHRANGIG (secondary) to the Pin
tools below** — Philip: "sie soll primär die Pin-Funktion benutzen, chart_annotations nur noch, wenn
eine Pin-Funktion das nicht kann" (remaining cases: marking a single candle, a free price note with
no underlying detected object, RSI-divergence special cases). The tool's own description now states
this explicitly, so Claude should reach for `add_pin_entry` first for anything with a matching Pin
`kind`. `.claude/settings.local.json` (gitignored, personal-machine, not `.claude/settings.json`)
allow-lists all three write tools — `add_pin_entry`/`remove_pin_entry`/`post_chart_annotations` —
so none of them prompt for confirmation; `post_chart_annotations`'s entry had briefly dropped out of
that file (caught and re-added 2026-08-17), so double-check the file directly if a confirmation
prompt for it ever reappears unexpectedly.

**Pin (`tools/pins.ts`, renamed from "Laniakea" 2026-08-17, `f2146a8`)**: lets Claude pin/unpin chart
POIs — `ob_zone`/`liquidity_level`/`trade_setup`/`m5_ob`/`m5_liquidity_level`/`rsi_divergence` — into
the `pin_context` table (renamed from `laniakea_context` in the same commit), mirroring Philip's own
right-click "an Lana übergeben" action in the browser (Trades-Tabelle, Chart-Trade-Marker, an OB-zone,
the setup-origin `#<id>` box, a confirmation box, an LQ-level line, an M5-OB box, or an RSI-divergence
line). Was read-only until 2026-08-17 (`c724b33`) — Philip then asked for write access too so Claude
doesn't have to wait for him to pin things manually. `trade_position`/`trade_confirmation` stay
browser-only (right-click is the only way to add those, no MCP write tool for them) — Pin's write
tools only cover the six chart-object kinds above. Since 2026-08-23 (Task "Chart-Objekte: OBs auf
kanonische ob_zones-ID konsolidieren", Punkt 6), `m5_ob` is **not** a separate DB kind anymore —
pinning one does a find-or-create into `ob_zones` (timeframe `'5M'`, same natural key as `poi-watcher`'s
1H/4H rows) and stores the pin as an ordinary `kind='ob_zone'` row, same as a 1H/4H pin. `m5_ob` stays
a distinct value only on the *input* side of `add_pin_entry`/the chart's client-side pin-candidate
list (`PriceChart.vue`: `findNearbyPinCandidates`), since resolving it still needs the find-or-create
step instead of the plain by-id lookup 1H/4H uses. `m5_liquidity_level`/`rsi_divergence` remain pure
snapshots (never persisted as their own DB rows — liquidity levels on a non-1H timeframe and RSI
divergences are both live-detected, not stored), so a pin's underlying RSI reading (or, for an M5 OB
pin specifically, its touched/invalidated state — see below) can still drift from what was true at
pin time, with no later refresh.

Two side effects landed in the same 2026-08-17 change (`c724b33`), not just the MCP tools themselves:
chart highlighting (a "Pin-Halo" behind the line/box) for the previously-missing `liquidity_level`/
`m5_liquidity_level` kinds (`src/liquidity.js`) and `rsi_divergence` (`src/rsiRendering.js`) — `m5_ob`
already rode along on the existing `pinObZoneKeys` highlight set; and a Telegram "touch" alarm in
`poi-watcher`, a consolidated pass over `pin_context` after the main per-instrument loop, checking
`ob_zone`/`liquidity_level`/`trade_setup` pins against the freshly-upserted `touched` state from that
same run and `m5_liquidity_level` pins directly against the current price — gated by its own
`alarm_settings` toggle (`pin_context`) and `notified`/`notified_at` columns, same pattern as every
other alert type in this function. Since the Punkt-6 consolidation above, a pinned M5 OB is a
`kind='ob_zone'` row too, but `poi-watcher` only ever live-tracks/updates `touched`/`invalidated` for
1H/4H rows (M5 stays live-recompute-only for the indicator overlay, see "Persistierungs-Umfang" in
`PLAN-chart-objekte-forex.md`) — so `resolvePinTouch` (`poi-watcher/index.ts`) special-cases
`ob_zones.timeframe === '5M'` back to a direct price-vs-bounds comparison instead of trusting the
(permanently stale) `touched` flag, same effective check as the old dedicated `m5_ob` alarm branch.
`rsi_divergence` pins are deliberately excluded from this alarm (a formation event, not a touch
event — different alarm shape, left as a separate future task).

**RSI/EMA (`get_forex_rsi`/`get_forex_ema`, added 2026-07-31)**: M5-only indicator tools for
GBPUSD/EURUSD, both sharing the same `dateStr`/`replayUntilSec` window semantics as
`get_data_export` (`mcp-server/src/indicatorWindow.ts`'s `resolveDayWindow`/`fetchM5WithWarmup`/
`isWithinDayWindow`) — no `dateStr` means the current day live, `dateStr` picks a specific
Europe/Berlin calendar day, `replayUntilSec` caps that day at a simulated point in time. Unlike
`get_data_export`'s M5 candles, both tools additionally fetch warmup candles *before* the day
starts (`fetchM5WithWarmup`) so the indicator's own recursion has settled by the first point of
the day that's actually returned — without that lead-in, the first hour or so of any requested
day would show inaccurate values, since neither indicator can be seeded correctly from a cold
start at midnight.

- `get_forex_rsi`: Wilder RSI(14) (`mcp-server/src/rsi.ts`) — GBPUSD/EURUSD only (the only two
  instruments this app tracks; a separate `okx-market` MCP server previously covered BTC's RSI via
  `market_get_indicator`, removed 2026-08-21 along with the rest of the BTC/OKX code path).
  Divergence detection (HH/LH, LL/HL) is deliberately NOT computed here — Claude compares the returned price+RSI series itself once the
  numbers exist; the error-prone part worth coding is the Wilder smoothing itself (an LLM can't
  reliably re-derive it by eyeballing candles), not the pattern-matching on top of it. Per
  `trading/rsi.md`'s own "Philips RSI-Nutzung" section, Philip barely watches RSI actively — only
  comment on it when it's genuinely notable (extreme divergence, zone exit) or strongly against an
  open setup, not as a routine indicator dump.
- `get_forex_ema`: EMA(50)/EMA(200), reusing `computeEma` from `src/ema.js` directly
  (cross-directory import, same pattern as `marketStructureAnalysis.ts` above) rather than a port —
  `computeEma` is already dependency-free (no `localStorage`/`import.meta.env`), so there's no
  Node-safety reason to duplicate it, and it's the exact function the live chart's EMA overlay
  uses, so there's no drift risk either. Warmup is a fixed 1000 candles (`EMA_WARMUP_CANDLES`,
  matching `PriceChart.vue`'s own `TREND_ANALYSIS_CANDLE_COUNT`) rather than a period-derived
  multiplier, since `computeEma` seeds its recursion from the first candle's close (see that
  file's own comment) and needs substantially more lead-in than RSI's Wilder smoothing does,
  especially for the 200-period EMA. Per `trading/ema.md`, this is a trend filter (price vs.
  EMA200) and a consolidation warning (EMA50/EMA200 converging or crossing on M5 only — 4H/1H
  convergence doesn't count), never an entry/exit signal; convergence itself isn't precomputed,
  same reasoning as RSI divergence above.

**Persisted candle archive (`forex_candles`, since 2026-08-09)**: `get_forex_candles`/the live
chart both routed every historical read through a fresh cTrader connection (own OAuth handshake
per request) — that's the actual cause of the cTrader timeouts behind `PriceChart.vue`'s
`showLoadOlderButton` (see there), and it's just as true for Laniakea: the MCP server runs in
Node, has no IndexedDB (that's a browser API — `src/candleCache.js`'s cache never applies here),
so every `get_forex_candles` call was a live fetch, every time, no caching anywhere.
`forex_candles` (migration `20260809120000_forex_candles.sql`, one row per candle — deliberately
not a JSON-blob-per-day table, to stay consistent with every other table in this schema and stay
directly queryable by time range) is a growing, append-only archive of *closed* candles meant to
fix both gaps at once, backfilled by a manual one-off script
(`mcp-server/src/scripts/backfillForexCandles.ts`, itself just calling the same `forex-candles`
edge function other callers use, paginated, batch-upserted with `ON CONFLICT DO NOTHING` for
idempotency/resumability — cTrader connects are flaky enough that a plain sequential fetch loop
needs its own retry-with-delay, see the script's `withRetries`; parametrized via
`BACKFILL_INSTRUMENTS`/`BACKFILL_BARS`/`BACKFILL_START_DATE` env vars instead of hand-editing
constants per extension). Current coverage: GBPUSD + EURUSD, 5m/1h/4h, from 2026-01-01 onward.

**The backfill script must never read the archive it's writing to.** `backfillForexCandles.ts`
imports `fetchLiveForexCandles` (the plain live-only function, now exported from
`mcp-server/src/forexCandles.ts` specifically for this) instead of that module's own
`fetchForexCandles` (archive-first, see above). Bug-Report Philip 2026-08-10, mid-EURUSD-backfill:
once the script had already written a few pages for the instrument/timeframe it was currently
backfilling, *later* pages of the SAME run started hitting those freshly-written (but still
incomplete) archive rows through `fetchForexCandles`'s archive-first path — a partial archive hit
triggered its "top up from live" branch, and the returned candle count no longer matched what the
script's own pagination cursor expected (gap/duplicate risk). Any other one-off script that writes
to `forex_candles` should import `fetchLiveForexCandles` the same way, not `fetchForexCandles`.

**Both the frontend chart AND Laniakea's `fetchForexCandles` are archive-first, transparently** —
this took two passes to actually get right, worth knowing if you touch either again. Pass one
(2026-08-09) added `get_forex_candles_archive` as a new, separate MCP tool and made the
*frontend's* `fetchOlderCandles`/`fetchInitialCandles` (`src/forexCandles.js`) archive-first, but
left the MCP server's own `fetchForexCandles` (`mcp-server/src/forexCandles.ts` — used by
`get_data_export`, `get_forex_rsi`/`get_forex_ema` via `indicatorWindow.ts`'s
`fetchM5WithWarmup`, AND `get_forex_candles` itself) untouched: still 100% live, every call, no
exception. Bug-Report Philip 2026-08-10: Laniakea tried live cTrader 3× (all timed out) for a
GBPUSD date squarely inside the archived range, then had to notice this herself and manually
call `get_forex_candles_archive` as a workaround instead of it just working — a documentation/
wiring gap, not a data gap (the candles were there all along). Pass two fixed this properly:
`fetchForexCandles` (mcp-server) itself now tries the archive first (`db.ts`'s new
`getForexCandlesArchiveUpTo` — "newest N candles up to a cutoff", the same query shape as the
frontend's `fetchArchivedUpTo`, NOT the same as `getForexCandlesArchive`'s "ascending from a
`fromTime`" shape, which serves a different query pattern and is kept as a separate function),
live only for whatever's missing, with the same graceful-degradation-on-live-failure as the
frontend. Since `fetchForexCandles` is the single low-level function every MCP forex-candle
caller goes through, this fixed `get_data_export`/RSI/EMA/`get_forex_candles` all at once, no
call-site changes needed anywhere else. `get_forex_candles_archive` remains useful as its own
tool only for an *explicit* `fromTime`+`toTime` range query (multi-day historical scans) — for
anything with "newest N up to a point" semantics, `get_forex_candles` already covers it now, no
need to reach for the archive tool directly. `pollRecent()` (frontend live-tail polling) stays
live-only, on purpose — the archive is frozen at whatever the last backfill run saw, it
structurally can't serve "the candle that just closed". There is **no ongoing sync** otherwise —
the table stops growing the moment a backfill script run finishes; extending `poi-watcher`'s
already-running M5 fetch to also persist here (avoiding any extra cTrader load) is the natural
next step once Philip wants it, not yet built.

**Historical `ob_zones` backfill (`mcp-server/src/scripts/backfillObZones.ts`, since 2026-08-09)**:
`ob_zones` used to only ever hold what `poi-watcher`'s live cron detected going forward — a
Laniakea backtest of an old date (e.g. April 2026) had literally no OB zones to read, since this
app didn't even track GBPUSD that far back. Fixed the same way as the candle gap: run the exact
same detection function (`detectOrderBlocks`, already Node-safe/dependency-free in
`src/orderBlockDetection.js` — no third port) once over the *entire* archived candle series per
instrument/timeframe instead of a live rolling window, then upsert the results
(`onConflict: instrument,timeframe,start_time,direction`, `ignoreDuplicates: true` — deliberately
NOT a real update, so this backfill can never clobber a zone `poi-watcher` is already live-tracking
with more accurate intraday touch data; a re-run is always safe/idempotent). No `sendTelegram`
call anywhere in this script — historical zones must never trigger a real alert, and
`notified`/`notified_at` are set the same way `poi-watcher` itself already handles a zone that's
already touched the first time it's ever seen (`notified: z.touched`, `notified_at: null`, see
`index.ts`'s `!existing` branch) so a live run later doesn't re-fire on it either. No new MCP tool
needed — `get_ob_zones`'s existing `asOfSec` param (`applyAsOfZones` in `db.ts`) already
reconstructs "as of a past point in time" correctly against the backfilled rows.

Two schema changes this required, both worth knowing about if you touch `ob_zones` again:
- `timeframe` CHECK constraint extended to allow `'5M'` (migration
  `20260809130000_ob_zones_allow_5m.sql`) — M5 OB zones were *never* persisted before this,
  deliberately (`poi-watcher` still doesn't; `get_data_export`'s `m5ObZones` still live-redetects
  over a rolling 7-day window for the same reason). Persisting M5 here is a scoped exception for
  the *backfilled historical archive only* — a fixed past backtest date has nothing to gain from
  "live" redetection, unlike a rolling live window. Don't read this as "M5 is persisted now" in
  general.
- `ob_zones` was anon-select-only before (only `poi-watcher`, via `service_role`, could write) —
  unlike almost every other table in this schema. The backfill script runs with the anon key (no
  `service_role` available for a local one-off script), so two migrations
  (`20260809140000_ob_zones_anon_insert.sql`, `...150000_ob_zones_anon_delete.sql`) opened it up,
  aligning it with the permissive single-user model everywhere else. `poi-watcher` itself still
  writes via `service_role`, unchanged.

**Historical `liquidity_levels` backfill (`mcp-server/src/scripts/backfillLiquidityLevels.ts`,
since 2026-08-23)** — same shape as the `ob_zones` backfill above, same underlying cause:
`poi-watcher` only ever detects 1H liquidity levels over a rolling `FOREX_H1_LOOKBACK_CANDLES=3000`
(~125 days) window, so a pivot older than that relative to *every* run since the window was last
widened (2026-08-02) was never persisted, no matter how long you wait for the next cron tick —
this is what a 2026-08-23 bug report ("Dieses Liquiditäts-Level ist noch nicht gespeichert") traced
back to, for a February 2026 level. Runs `detectLiquidityLevels` (dependency-free,
`src/liquidityDetection.js`) once over the entire archived 1H candle series per instrument instead
of the live rolling window, upserts with `ignoreDuplicates: true` (never clobbers a live-tracked
row) and the same "already-touched-when-first-seen counts as notified" trick as the OB version, so
no retroactive Telegram alert fires later. `liquidity_levels` needed the same anon-insert-policy
treatment as `ob_zones` (`20260823130000_liquidity_levels_anon_insert.sql`) for the same reason
(local script, no `service_role`). Run manually whenever a pin/lookup hits this gap again:
`SUPABASE_URL=... SUPABASE_ANON_KEY=... [BACKFILL_INSTRUMENTS=GBPUSD,EURUSD] npx tsx
mcp-server/src/scripts/backfillLiquidityLevels.ts`.

**Gotcha (hit THREE times while building this — it's not just a backfill-script thing)**:
Supabase/PostgREST caps a single response's row count server-side (empirically confirmed at
1000 here) *regardless of what `.limit()`/`.range()` asks for* — no error, just silently fewer
rows than requested. First surfaced in `backfillObZones.ts`'s read-pagination (a `.range()` loop
that advanced `from` by the requested page size instead of the actually-returned row count skips
most of the data once a page comes back capped — only saw the first 1000 of a 44k-row M5 series,
produced 262 wrong `ob_zones` rows from that truncated view, individually deleted by `created_at`
before re-running correctly). Looked fixed there, but the SAME bug was still live in
`src/forexCandles.js`'s `fetchInitialCandles`/`fetchOlderCandles` (a plain `.limit(count)` with
`count` > 1000 for a replay jump with `REPLAY_LOOKAHEAD_SEC` lookahead, or a large
`FOREX_HISTORY_PAGE_SIZE` scroll-back) AND in `get_forex_candles_archive`'s `getForexCandlesArchive`
— Bug-Report Philip 2026-08-09: a GBPUSD M5 replay jump to 08.07. 13:40 showed almost no candles,
because the capped single-page fetch silently returned a candle window from *after* the lookahead
end instead of around the actual replay point. Fixed by paginating properly in all three places
(`fetchArchivedPage` in `forexCandles.js`, same shape in `getForexCandlesArchive`) — advance the
cursor by `data.length`, never by the requested page size, and only treat a truly *empty* page as
"done". Also bumped `candleCache.js`'s `DB_VERSION` (3rd time this exact poisoning class has
forced a bump, see the version-3 comment there) — the broken fetch got cached as "complete" like
any other successful one, so a code fix alone doesn't clear an already-poisoned IndexedDB entry.
**If you add another `.limit()`/`.range()` read against `forex_candles` (or any table) that could
plausibly need more than ~1000 rows, assume it needs the same pagination loop — don't rely on
`.limit()` alone.**

**A second, unrelated gotcha in the same neighborhood**: `REPLAY_LOOKAHEAD_SEC` (`timeframes.js`)
is a fixed *seconds* value, calibrated for M5 (2500 bars). For a finer timeframe (M1: 60s/bar
instead of 300s), the same seconds value scales into 12,500 lookahead bars instead of 2500 —
`targetCount + lookaheadBars` then blows straight through whatever the live edge function can
return in one request, and the *same* wrong-window symptom as above shows up again (candles from
near the far, lookahead-shifted end of the request instead of around the real replay point,
`clipReplay()` then filters all of it away — empty chart, no error). Bug-Report Philip
2026-08-10: GBPUSD M1 in replay mode, blank chart. Fixed two ways together (`candleCache.js`'s
`fetchCandlesCached`): `MAX_LOOKAHEAD_BARS` (2500, M5's own original calibration value) caps how
many lookahead bars any timeframe can request — and the `toMs` pushed into the future for that
lookahead is derived from the *capped* bar count converted back to seconds, not from the raw
`REPLAY_LOOKAHEAD_SEC`, so count and time-window stay consistent. Paired with raising the
`forex-candles` edge function's own `MAX_COUNT` from 1000 to 5000 (deployed via `npx supabase
functions deploy forex-candles` — this one's a live edge function, a git commit alone doesn't
ship it) so `targetCount(2500) + MAX_LOOKAHEAD_BARS(2500)` — the largest case, from
`TRADE_SETUP_M5_CANDLE_COUNT` — actually fits in one request; still well under cTrader's own
14,000-bar limit. `DB_VERSION` bumped to 6 for the same "already-poisoned cache from before the
fix" reason as version 5.

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
- **When Philip corrects a mistake in how Claude worked (not a trading-analysis call, but the
  agent's own process — wrong tool priority, a skipped step, a missed convention), fix it
  durably, not by writing an auto-memory entry alone.** Memory is a recall aid for Claude itself,
  not an enforced mechanism — the same mistake can still happen again next time even with a memory
  entry in place, because nothing guarantees the entry gets read or applied before the mistake
  repeats. The actual fix belongs wherever it will structurally take effect next time: this
  CLAUDE.md itself, an MCP tool's own description, a step file in the `trading` repo, a
  `PreToolUse` hook, or server-side validation — whichever closes the root cause, not just the one
  symptom. A memory entry can still be written in addition (context/why), but never as a
  substitute for the durable fix. Bug report 2026-08-17 (missed the Pin-before-
  `post_chart_annotations` rule during a EURUSD analysis): "wie oft soll ich noch sagen, dass es
  mir nichts bringt wenn du die memory anpasst... dann machst du es beim nächsten mal wieder
  falsch." This generalizes the same principle already documented for the Laniakea persona in
  `trading/claude-project-instructions.md` ("Korrekturen — Doku/Regel fixen, nicht nur den
  Output", scoped there to trading-analysis mistakes) to any process mistake in this repo, not
  just trading-analysis ones.
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
- **milk-city task status**: at the start of any task, check whether it clearly matches an open
  task in the `milk-city` MCP server (`list_tasks`) — e.g. a task mentioning "RSI" clearly
  matches the `rsi-divergenz` task. If it clearly matches, call `set_task_status(id, "work in progress")`
  immediately and start working, no confirmation needed. If it's unclear whether/which task
  applies, ask Philip immediately before starting the actual work. **On finishing the task, do NOT
  set `status="done"` directly — set `status="review"` instead** and tell Philip it's ready for
  review; only set `status="done"` once Philip has explicitly confirmed the result in chat ("passt"
  o.ä.). **Setting `status="review"` is the agent's own action the moment it's done implementing —
  never wait for Philip to say "go ahead and set it to review" or phrase a reply as if that
  decision were his to trigger** (e.g. don't say "sag Bescheid, dann setz ich auf review" — set it
  first, then tell him it's ready). Only the done↔review handoff itself needs his confirmation, not
  the work-in-progress→review one. Missed 2026-08-14: after finishing implementation, the agent
  told Philip it would set `status="review"` once he confirmed it looked right, instead of setting
  it immediately and asking him to review — Philip had to point out the mixup. If he instead says something needs fixing, set `status="work in progress"` again and repeat
  the cycle (work in progress → review) until he confirms. **"Needs fixing" includes any plain
  follow-up change/refinement request, not just an explicit "das passt nicht" — and the revert to
  `work in progress` must happen proactively, before starting on the new request, not only after
  Philip notices the status is stale and asks about it himself.** Missed twice, 2026-08-14: a
  task was moved to `review`, Philip replied with a follow-up change request (no explicit "passt
  nicht"), the agent just started implementing it without reverting the status first — Philip had
  to ask "ist der status nicht zurück in work in progress gegangne?" himself both times. **Once the
  agent actually runs `git push`
  for that task's commit(s), it must call `set_task_status(id, "released")` itself right after the
  push succeeds** — don't leave it on `done` waiting for something else to notice. Do NOT rely on a
  CI/deploy step to bulk-flip `done`→`released` on every deploy: several agents commonly work in
  parallel across different tasks with separate commits/pushes, so a shared deploy trigger can't
  tell which specific task a given deploy actually shipped — only the agent that did the push knows.
  (Philip 2026-08-14, rejecting a "deploy auto-marks all done tasks released" task idea proposed
  right after this: "da gleich mehrere agenten arbeiten und unterschiedliche commits und pushes
  machen, muss jeder agent den task status selbst setzen, nachdem er gepusht hat".) This is what
  drives milk-city's live "who's working on what" display — see `milk-city/supabase/functions/mcp/`
  for the tool implementations. (Renamed from "ticket" to "task" 2026-08-14, Philip: "Ticket passt iwie nicht
  mehr, Task passt viel besser" — same DB table/MCP tools, just renamed throughout, see milk-city's
  own migration `20260814090000_tickets_rename_to_tasks.sql`. `review` status added 2026-08-14
  right after the `carried`→`work in progress` rename, same chat, Philip: "das bedeutet: du bist
  fertig, ich soll es reviewen ... sobald ich sag: das passt noch nicht, fix das und jenes => dann
  wieder von vorne: work-in-progress -> review" — in the world, the responsible character stays in
  its idle animation during review but shows an exclamation-mark badge over its head instead of the
  working animation, see milk-city's `WorldScene.js` `handleTaskReview()`.)
- **milk-city: auto-create a task from a confirmed-feasible idea**: when Philip asks a
  "geht das/ist das teuer einzubauen?"-style question about a potential feature and the answer
  confirms it's feasible with a concrete approach (not just "yes in theory"), call `create_task`
  for it immediately (`projectId` = whichever repo it belongs to, `description` = the concrete
  approach, not just the restated problem) instead of leaving it sitting in chat — don't wait to
  be told "make this a task" each time. If it's unclear which project the idea belongs to, ask
  rather than guess. Creating the task doesn't imply starting it — only call
  `set_task_status(id, "work in progress")` once work actually begins, per the convention above. Philip
  2026-08-14, right after the `tasks.description` column shipped, gave a worked example (Tile-
  Editor undo-stack question) and said explicitly "wenn ich dir sowas gebe, sollst du das direkt
  in einen task umwandeln."
