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
