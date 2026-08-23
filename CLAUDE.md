# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal Forex trading dashboard for Philip. Vue 3 SPA (deployed to GitHub Pages) +
Supabase (Postgres + Edge Functions) backend. Live price charts (GBPUSD/EURUSD via cTrader Open
API) with order-block/liquidity/trade-setup detection, a cron-driven alert watcher that posts to
Telegram, and a trade journal ("Protokoll"). BTC-USDT/OKX support was removed entirely (frontend
chart branch, `poi-watcher`'s OKX fetch, the `okx-market` MCP server) — existing BTC rows in
`ob_zones`/`trade_positions`/etc. are untouched, just no longer written to or read from by live
code.

`PLAN-notifications.md` is a running dev log/plan doc with historical context on major features
and decisions — check it for the "why" behind non-obvious design choices before assuming
something is a bug. `git log -p -- CLAUDE.md` recovers the fuller history/dates/quotes behind any
rule below if needed.

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

### Forex candle data: cTrader Open API, not Twelve Data

GBPUSD/EURUSD candles come from the cTrader Open API (`supabase/functions/_shared/ctrader/client.ts`,
`ctrader_oauth_tokens` table for the OAuth token pair), proxied through the `forex-candles` edge
function so the frontend never holds credentials directly. `src/forexCandles.js` is the frontend
fetch wrapper — response shape `{time,open,high,low,close,volume}`, oldest-first. Currently on a
regular Pepperstone Razor demo account (not a prop-firm challenge account — chosen to avoid
challenge-account deactivation).

The Twelve Data client (`_shared/twelvedata/client.ts`) is left in place but unwired — don't
assume it's live without checking `poi-watcher`'s `INSTRUMENTS` config first (everything fetches
via cTrader now). **Don't switch OB/FVG detection back to Twelve Data**: its 60+
liquidity-provider aggregation smooths away the exact wick extremes the detection depends on — a
structural mismatch, not a bug in `orderBlocks.ts`/`liquidity.ts`.

**cTrader's hard limit is 14000 bars/request** (see `fetchOneTrendbar` in `_shared/ctrader/client.ts`).
`poi-watcher`'s throttling below is not about surviving a rate limit; it's for cache consistency
and to avoid hammering the OAuth-token-backed connection unnecessarily.

### Frontend data flow (`PriceChart.vue`)

`src/components/PriceChart.vue` is the largest component and the hub: it fetches candles
(`forexCandles.js` for GBPUSD/EURUSD), runs the frontend copies of the detection algorithms, and
renders everything via `lightweight-charts` primitives. `src/candleCache.js`
(`fetchCandlesCached`) wraps the raw fetch functions with an incremental-fetch cache so
timeframe/symbol switches and polling don't refetch a whole window just to get the newest bar.

### Trading-hours / timezone handling

User-facing trading-session logic (session bands on the chart, `poi-watcher`'s alert window) is
timezone-aware via `Intl.DateTimeFormat` with `timeZone: "Europe/Berlin"`, not fixed UTC offsets —
any new time-window logic should follow the same pattern rather than hardcoding a UTC offset.

**When Claude transcribes/seeds a timestamp itself** (e.g. a one-off data migration entering
trade history Philip pasted from a screenshot or a broker/bot export), default the source
timestamp to **Europe/Berlin local time**, not UTC, before converting to the UTC value actually
stored — Philip is in Germany, and unless he explicitly says a timestamp is already UTC (or some
other zone), assume it isn't. Double-check CEST vs. CET for the actual date rather than assuming a
fixed offset.

Per-instrument trading/alarm windows (which weekdays and hours a trade may open, and separately
when `poi-watcher` is allowed to actually send a Telegram message) live in the `trading_schedules`
table, edited via the "Handelszeiten" page — **not** hardcoded constants. `poi-watcher` reads
`alarm_windows` per instrument each run (`isInWindows()`); `trading_windows` on the same table is
currently reference/display-only, read by the Handelszeiten page but not yet gating anything in
code. Per-asset chart sessions (`sessions` table/`src/sessions.js`, edited via the Sessions modal
on the chart) have an `instrument` column (one session list per asset) plus a `danger` level
(`normal`/`caution`/`forbidden`) — this is how a sub-window like the GBPUSD/EURUSD "MMM" caution
session is expressed, rather than a second schedule concept.

### Trade journal: `dealing_ranges` vs. `trade_positions`

The trade journal is split into two tables instead of one flat row:

- **`dealing_ranges`** — the trade *idea* (POI → target, "dealing range" in Philip's own
  terminology): `instrument`, `direction`, `invalidation` (the price at which the whole idea is
  invalidated — NOT necessarily any one execution's stop-loss), `trade_setup_id` (link to the
  detected M5-sweep+fractal+OB pattern that originated the idea).
- **`trade_positions`** — one *execution* of that idea: `entry_price`, `stop_loss`,
  `exit_price`/`exit_time`, `outcome`, `r_multiple`, `source`, `reasoning`, `trading_account_id`,
  FK'd to its `dealing_range_id`. A dealing range can have 1-n positions (re-entries), each with
  its own entry/stop/outcome — only the invalidation of the whole idea belongs to the dealing
  range, the stop-loss belongs to one execution.

`trade_targets` (planned target levels) FK to `dealing_ranges` — a target applies to the whole
idea, shared across every re-entry underneath it. `trade_partial_exits` stay FK'd to
`trade_positions` — partial closes belong to one specific execution.

`trade_confirmations` is dual-level on purpose: a row FKs to *either* `dealing_range_id` *or*
`trade_position_id` (nullable columns, `CHECK` constraint enforcing exactly one is set, not a
generic `parent_type`/`parent_id` pair) — some confirmations give the GO for the dealing range
itself, others give the GO for a specific entry. `createTradeFromSetup` (`src/tradeIntake.js`)
inserts the M5-OB-derived entry price as a `kind='ob'` confirmation on the new position. There's
no UI yet to add a *dealing-range-level* confirmation (only position-level, via the existing
Trade-Modus "Bestätigung hinzufügen" flow) — deferred along with a TSC rework, not an oversight.

`src/trades.js`'s `fetchTrades` still returns one flat row per **position** (not per dealing
range) with the parent range's fields embedded (`instrument`/`direction`/`invalidation`/
`tradeSetupId`/`dealingRangeId`) — this keeps `TradesTable.vue`/`TradeEditModal.vue`/
`PriceChart.vue`'s existing one-row-per-trade rendering working unchanged. There is deliberately no
UI yet for viewing a dealing range as a group of its positions, or for adding a second
position/re-entry via the UI (only via the MCP server's `add_trade_position` tool for now).

### "Laniakea" persona (`/l`)

`.claude/commands/l.md` switches a session from this file's normal coding-assistant behavior into
"Laniakea", Philip's trading-sparring-partner persona (Bias/Setup-analysis, not code) — pointer to
`trading/claude-project-instructions.md` (the same persona instructions used in Philip's separate
claude.ai Project) plus a note to use this repo's MCP tools for live data instead of waiting for
pasted charts. Deliberately NOT merged into this file's own instructions — the persona only
applies when explicitly invoked, not to every session in this repo.

## Gotchas

- **Supabase/PostgREST caps a single response's row count server-side (empirically ~1000)
  regardless of what `.limit()`/`.range()` asks for** — no error, just silently fewer rows than
  requested. Any `.limit()`/`.range()` read against any table that could plausibly need more than
  ~1000 rows needs a proper pagination loop — advance the cursor by the actually-returned row
  count (`data.length`), never by the requested page size, and only treat a truly *empty* page as
  "done". Hit this repeatedly across `backfillObZones.ts`'s read-pagination,
  `forexCandles.js`'s `fetchInitialCandles`/`fetchOlderCandles`, and
  `get_forex_candles_archive`'s `getForexCandlesArchive` — assume any new one needs the same fix.
  A code fix alone doesn't clear an already-poisoned `candleCache.js` IndexedDB entry cached as
  "complete" from before the fix — bump `DB_VERSION` alongside a fix here.
- **`REPLAY_LOOKAHEAD_SEC` (`timeframes.js`) is a fixed *seconds* value calibrated for M5** — for a
  finer timeframe (M1) the same seconds value scales into far more lookahead bars than intended,
  which can blow through what the live edge function returns in one request and silently show
  candles from the wrong window. `candleCache.js`'s `MAX_LOOKAHEAD_BARS` caps how many lookahead
  bars any timeframe can request, with the time-window derived from the *capped* bar count (not
  the raw seconds value) so count and window stay consistent.
- **`poi-watcher`'s refresh-tick boundaries (`isH1RefreshTick`/`isH4RefreshTick`) use raw UTC
  hours, not Berlin time** — the one deliberate exception to the Berlin-timezone convention above,
  since they must align with the UTC-based `pg_cron` schedule. Don't "fix" this to Berlin time.

## Conventions

- Comments are in German, and are written to explain **why** (a past bug, a non-obvious
  constraint, a rejected alternative), not what the code does. Match this when editing
  existing files.
- **Respond to Philip in German** (chat replies, not just code comments) — code
  identifiers/commit messages/PR text stay English as usual; this is about the conversational
  reply text.
- **When Philip corrects a mistake in how Claude worked (not a trading-analysis call, but the
  agent's own process — wrong tool priority, a skipped step, a missed convention), fix it
  durably, not by writing an auto-memory entry alone.** Memory is a recall aid, not an enforced
  mechanism — the same mistake can still happen again next time even with a memory entry in
  place, since nothing guarantees the entry gets read before the mistake repeats. The actual fix
  belongs wherever it will structurally take effect next time: this CLAUDE.md itself, an MCP
  tool's own description, a step file in the `trading` repo, a `PreToolUse` hook, or server-side
  validation — whichever closes the root cause, not just the one symptom. A memory entry can
  still be written in addition (context/why), but never as a substitute for the durable fix.
- Prefer small, targeted edits with a comment explaining the non-obvious reasoning over
  refactoring for its own sake — this is a solo hobby project with a lot of hard-won bugfix
  history encoded in comments; don't erase that context while "cleaning up."
- When explaining a detection-algorithm bug that hinges on price levels/timing (why a setup did
  or didn't fire, why a sweep did or didn't count), default to a Claude Artifact with an annotated
  price diagram (candles + the relevant levels/zones/callouts, reusing this app's own
  `chartColors.js` tokens: `candleUp`/`candleDown`/`liquidityLow`/`liquiditySweep`/`obBull` etc.)
  instead of a purely textual walkthrough. A text explanation is fine for non-price-geometric
  questions (e.g. "does X path apply to both Long and Short").
- **When renaming a user-facing label/feature, rename the underlying code identifiers too, not
  just the visible string** — file names, component names, function/variable names, CSS classes,
  debug-metadata section keys, and comments that reference the old name. Do the full rename in
  the same change (`git mv` for files, update every import), and verify with a repo-wide grep for
  the old name afterward, not just the one call site that was pointed at.
- **milk-city task status**: at the start of any task, check whether it clearly matches an open
  task in the `milk-city` MCP server (`list_tasks`). If it clearly matches, call
  `set_task_status(id, "work in progress")` immediately and start working, no confirmation
  needed. If it's unclear whether/which task applies, ask Philip before starting the actual work.
  **On finishing, do NOT set `status="done"` directly — set `status="review"` yourself, the
  moment implementation is done, without waiting for Philip's go-ahead** — only set
  `status="done"` once Philip has explicitly confirmed the result in chat. Any follow-up
  change/refinement request (not just an explicit "das passt nicht") means the task isn't done —
  proactively revert to `status="work in progress"` before starting on it, then repeat the
  work-in-progress → review cycle until Philip confirms. **Once the agent actually runs `git
  push` for that task's commit(s), it must call `set_task_status(id, "released")` itself right
  after the push succeeds** — never rely on a shared CI/deploy step to bulk-flip `done`→`released`,
  since multiple agents can push different tasks' commits in the same deploy and only the pushing
  agent knows which task it shipped.
- **milk-city: auto-create a task from a confirmed-feasible idea**: when Philip asks a
  "geht das/ist das teuer einzubauen?"-style question about a potential feature and the answer
  confirms it's feasible with a concrete approach (not just "yes in theory"), call `create_task`
  for it immediately (`projectId` = whichever repo it belongs to, `description` = the concrete
  approach, not just the restated problem) instead of leaving it sitting in chat. If it's unclear
  which project the idea belongs to, ask rather than guess. Creating the task doesn't imply
  starting it — only call `set_task_status(id, "work in progress")` once work actually begins.
