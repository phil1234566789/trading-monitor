// Minimal cTrader Open API client: opens a fresh TLS/protobuf connection per call,
// does the required auth handshake, fetches trendbars for one symbol, then disconnects.
// No persistent/streaming connection — matches the request/response pattern the rest of
// this codebase already uses for OKX (fetch on demand, poll on an interval from the client).
//
// Wire protocol verified manually against demo.ctraderapi.com:5035 (see chat history):
// 4-byte big-endian length prefix + binary-encoded ProtoMessage envelope. Deno's TLS
// stack negotiates a compatible version out of the box (unlike a plain Node `tls.connect`,
// which needed `minVersion: "TLSv1.2"` forced or the handshake got reset).
import protobuf from "npm:protobufjs@7";
import { CTRADER_PROTO_FILES } from "./protoSource.ts";

const HOSTS = {
  demo: "demo.ctraderapi.com",
  live: "live.ctraderapi.com",
} as const;
const PORT = 5035;
const TOKEN_URL = "https://openapi.ctrader.com/apps/token";

const PAYLOAD_TYPE = {
  APPLICATION_AUTH_REQ: 2100,
  ACCOUNT_AUTH_REQ: 2102,
  ACCOUNT_AUTH_RES: 2103,
  SYMBOLS_LIST_REQ: 2114,
  GET_TRENDBARS_REQ: 2137,
  ERROR_RES: 2142,
  GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ: 2149,
} as const;

export const TRENDBAR_PERIOD: Record<string, number> = {
  M1: 1,
  M2: 2,
  M3: 3,
  M4: 4,
  M5: 5,
  M10: 6,
  M15: 7,
  M30: 8,
  H1: 9,
  H4: 10,
  H12: 11,
  D1: 12,
  W1: 13,
  MN1: 14,
};

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// `Root.load()` resolves `import "X.proto"` statements via `protobuf.util.fetch`, which
// internally binds straight to Node's `fs.readFile` in this runtime — overriding
// `util.fetch` afterwards doesn't intercept it (learned by hitting a bundler "path not
// found" error on deploy, since the edge runtime doesn't ship these .proto files on disk).
// `protobuf.parse()` on raw strings has no such file I/O, so parse each file directly into
// one shared root, in dependency order, then resolve cross-file references once at the end.
let cachedRoot: protobuf.Root | null = null;
function loadRoot(): protobuf.Root {
  if (!cachedRoot) {
    const root = new protobuf.Root();
    for (const name of [
      "OpenApiCommonModelMessages.proto",
      "OpenApiCommonMessages.proto",
      "OpenApiModelMessages.proto",
      "OpenApiMessages.proto",
    ]) {
      protobuf.parse(CTRADER_PROTO_FILES[name], root, { keepCase: true });
    }
    root.resolveAll();
    cachedRoot = root;
  }
  return cachedRoot;
}

// Resolved once per warm isolate — avoids re-fetching account/symbol lists on every request.
let cachedAccountId: string | null = null;
const cachedSymbolIds = new Map<string, string>(); // symbolName -> symbolId (string, may exceed 2^53)

class CTraderConnection {
  private socket: Deno.TlsConn;
  private root: protobuf.Root;
  private buf = new Uint8Array(0);
  private pending = new Map<string, { resolve: (v: protobuf.Message) => void; reject: (e: Error) => void }>();
  private seq = 0;
  private readLoopPromise: Promise<void>;

  private constructor(socket: Deno.TlsConn, root: protobuf.Root) {
    this.socket = socket;
    this.root = root;
    this.readLoopPromise = this.readLoop();
  }

  static async connect(env: "demo" | "live"): Promise<CTraderConnection> {
    const root = loadRoot();
    const socket = await connectWithTimeout(HOSTS[env]);
    return new CTraderConnection(socket, root);
  }

  private async readLoop() {
    const ProtoMessage = this.root.lookupType("ProtoMessage");
    const chunk = new Uint8Array(65536);
    try {
      while (true) {
        const n = await this.socket.read(chunk);
        if (n === null) break;
        this.buf = concat(this.buf, chunk.subarray(0, n));
        while (this.buf.length >= 4) {
          const len = new DataView(this.buf.buffer, this.buf.byteOffset, 4).getUint32(0, false);
          if (this.buf.length < 4 + len) break;
          const frame = this.buf.subarray(4, 4 + len);
          this.buf = this.buf.subarray(4 + len);
          // deno-lint-ignore no-explicit-any
          const msg = ProtoMessage.decode(frame) as any;
          const entry = msg.clientMsgId ? this.pending.get(msg.clientMsgId) : undefined;
          if (entry) {
            this.pending.delete(msg.clientMsgId);
            entry.resolve(msg);
          }
        }
      }
    } catch (_e) {
      // socket closed/reset — any still-pending requests will time out below
    }
  }

  async send(payloadType: number, reqTypeName: string, payload: Record<string, unknown>): Promise<protobuf.Message> {
    const ReqType = this.root.lookupType(reqTypeName);
    const ProtoMessage = this.root.lookupType("ProtoMessage");
    const payloadBytes = ReqType.encode(ReqType.create(payload)).finish();
    const clientMsgId = `m${++this.seq}`;
    const envelope = ProtoMessage.encode(
      ProtoMessage.create({ payloadType, payload: payloadBytes, clientMsgId }),
    ).finish();
    const lenPrefix = new Uint8Array(4);
    new DataView(lenPrefix.buffer).setUint32(0, envelope.length, false);
    const frame = concat(lenPrefix, envelope);

    const result = new Promise<protobuf.Message>((resolve, reject) => {
      this.pending.set(clientMsgId, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(clientMsgId)) {
          this.pending.delete(clientMsgId);
          reject(new Error(`cTrader request timed out: ${reqTypeName}`));
        }
      }, 10000);
    });

    let written = 0;
    while (written < frame.length) {
      written += await this.socket.write(frame.subarray(written));
    }

    const envelopeRes = (await result) as unknown as { payloadType: number; payload: Uint8Array };
    if (envelopeRes.payloadType === PAYLOAD_TYPE.ERROR_RES) {
      const err = this.root.lookupType("ProtoOAErrorRes").decode(envelopeRes.payload) as unknown as {
        errorCode: string;
        description?: string;
      };
      throw new Error(`cTrader error ${err.errorCode}: ${err.description ?? ""}`);
    }
    // Envelope only carries the response's payload as raw bytes — decode it into the
    // matching Res type (cTrader consistently names these by swapping the Req/Res suffix).
    const resTypeName = reqTypeName.replace(/Req$/, "Res");
    return this.root.lookupType(resTypeName).decode(envelopeRes.payload);
  }

  close() {
    try {
      this.socket.close();
    } catch {
      // already closed
    }
  }
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

// Spotwares Token-Endpoint nimmt die Grant-Parameter als Query-String auf einem GET
// (kein Standard-OAuth2-POST-Body) und antwortet camelCase (`accessToken`/`refreshToken`),
// nicht snake_case — beides empirisch verifiziert, nicht aus offizieller Doku übernommen.
async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<RefreshedTokens> {
  const url = new URL(TOKEN_URL);
  url.searchParams.set("grant_type", "refresh_token");
  url.searchParams.set("refresh_token", refreshToken);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  const res = await fetch(url, { method: "GET" });
  const body = (await res.json()) as { accessToken?: string; refreshToken?: string; errorCode?: string; description?: string };
  if (!res.ok || !body.accessToken) {
    throw new Error(`cTrader token refresh failed: ${body.errorCode ?? res.status} ${body.description ?? ""}`);
  }
  return { accessToken: body.accessToken, refreshToken: body.refreshToken ?? refreshToken };
}

// Nur eine ECHTE Fehlerantwort vom cTrader-Server (ERROR_RES, siehe send() oben — z.B. das
// RET_ACCOUNT_DISABLED aus dem 2026-07-15-Vorfall) rechtfertigt einen Token-Refresh+Retry. Ein
// eigener Timeout (Connect oder Gesamtbudget, siehe withOverallTimeout) ist NIE ein Auth-Problem
// und ein blinder Refresh+Retry verdoppelt dabei nur die Wartezeit, statt schnell aufzugeben —
// Bug-Report Philip 2026-08-07 (vierte Runde, M5-Live-Test): ein 8s-Connect-Timeout kam durch genau
// diesen blinden Retry als 17s-Gesamtfehler zurück statt in ~8s klar zu scheitern.
function isAuthFailure(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("cTrader error ");
}

// Spotwares Refresh-Token ist Single-Use (rotiert bei jedem Refresh) — schlägt das
// Wegschreiben des NEUEN Tokens fehl, ist das ALTE (in der DB stehende) bereits verbraucht,
// und ab dann scheitert jeder weitere Refresh-Versuch mit ACCESS_DENIED, bis jemand manuell
// per Browser neu einloggt (scripts/ctrader-reauth.mjs). Kein automatisches Recovery davon.
// Vorfall Philip 2026-08-08: genau dieses Muster (vermutlich ein einmaliger transienter
// DB-Fehler beim Schreiben) legte für Stunden alle Forex-Kerzen lahm. Ein paar Retries mit
// kurzem Backoff kosten im Erfolgsfall nichts und drücken die Wahrscheinlichkeit, dass ein
// kurzer DB-Hänger zum dauerhaften Lockout wird, deutlich runter.
async function persistWithRetry(
  onTokenRefresh: (tokens: RefreshedTokens) => Promise<void> | void,
  tokens: RefreshedTokens,
): Promise<void> {
  const ATTEMPTS = 3;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      await onTokenRefresh(tokens);
      return;
    } catch (err) {
      if (attempt === ATTEMPTS) throw err;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
}

// Der Access-Token läuft nach ~30 Tagen ab (siehe PLAN-notifications.md) — statt den Ablauf
// selbst zu tracken, einfach den ersten (echten Auth-)Fehlschlag eines Requests als Signal nehmen
// und einmal mit einem frisch geholten Token neu versuchen. `onTokenRefresh` ist optional, weil
// der einmalige manuelle Re-Auth-Flow (scripts/ctrader-reauth.mjs) kein Refresh-Token/Callback
// hat — dann wird einfach der ursprüngliche Fehler durchgereicht wie bisher.
async function withAutoRefresh<T>(
  opts: { clientId: string; clientSecret: string; refreshToken?: string; onTokenRefresh?: (tokens: RefreshedTokens) => Promise<void> | void },
  accessToken: string,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(accessToken);
  } catch (err) {
    if (!opts.refreshToken || !isAuthFailure(err)) throw err;
    const refreshed = await refreshAccessToken(opts.clientId, opts.clientSecret, opts.refreshToken);
    if (opts.onTokenRefresh) {
      try {
        await persistWithRetry(opts.onTokenRefresh, refreshed);
      } catch (persistErr) {
        // Frisches Token trotzdem für DIESEN Request nutzen, auch wenn das Wegschreiben
        // (z.B. DB down) nach allen Retries weiter fehlschlägt — sonst scheitert ein
        // funktionierender Request unnötig an einem Persistenzproblem, das den nächsten
        // Kaltstart betrifft, nicht diesen Call.
        console.error("cTrader: failed to persist refreshed token after retries:", persistErr);
      }
    }
    return await fn(refreshed.accessToken);
  }
}

// Deno.connectTls() hat selbst keinen Timeout — anders als die einzelnen send()-Requests unten
// (10s), die nur auf die ANTWORT warten, nachdem die Verbindung schon steht. Bug-Report Philip
// 2026-08-07: "signal timed out" (der 20s-Client-Timeout in forexCandles.js) kam ständig, vor
// allem im Live-Modus, wo PriceChart.vue beim Mount mehrere unabhängige Verbindungen gleichzeitig
// aufmacht (loadInitial/loadTradeSetupM5/loadRangesCandles/loadObs4hCandles) — hängt der
// TCP/TLS-Handshake dabei (Netzwerk-Hänger, überlasteter Demo-Server), blieb dieser await bisher
// UNBEGRENZT offen, weit über den Client-Timeout hinaus: das Frontend gab auf, die Edge-Function-
// Invocation lief serverseitig weiter. Eigener Timeout hier macht daraus einen klaren, schnellen
// Fehler statt eines endlosen Hangs. Ein verspätet doch noch aufgebauter Socket wird gleich wieder
// geschlossen statt als Leak liegen zu bleiben.
//
// Bewusst NICHT mehr das primäre Zeitbudget (siehe withOverallTimeout weiter unten, Bug-Report
// Philip 2026-08-07, dritte Runde, M5-Live-Test): 8s statt der zwischenzeitlichen 15s — der
// Connect ist nur EINER von vier sequenziellen Schritten (Connect+App-Auth+Account-Auth+
// Trendbars), das GESAMT-Budget dort deckelt jetzt die Summe. Diese Zahl hier muss also nicht mehr
// allein die volle beobachtete Ausreißer-Bandbreite (9-15s Gesamtlaufzeit, siehe curl-Test) tragen.
const CONNECT_TIMEOUT_MS = 8_000;
function connectWithTimeout(hostname: string): Promise<Deno.TlsConn> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`cTrader TLS-Connect timed out after ${CONNECT_TIMEOUT_MS}ms: ${hostname}`));
    }, CONNECT_TIMEOUT_MS);
    Deno.connectTls({ hostname, port: PORT }).then(
      (socket) => {
        clearTimeout(timer);
        if (settled) {
          socket.close();
          return;
        }
        settled = true;
        resolve(socket);
      },
      (err) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        reject(err);
      },
    );
  });
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function authAccount(conn: CTraderConnection, accountId: string, accessToken: string): Promise<void> {
  await conn.send(PAYLOAD_TYPE.ACCOUNT_AUTH_REQ, "ProtoOAAccountAuthReq", { ctidTraderAccountId: accountId, accessToken });
}

async function authenticate(
  conn: CTraderConnection,
  clientId: string,
  clientSecret: string,
  accessToken: string,
): Promise<string> {
  await conn.send(PAYLOAD_TYPE.APPLICATION_AUTH_REQ, "ProtoOAApplicationAuthReq", { clientId, clientSecret });

  // A cached account can go stale (e.g. a broker disables/closes it) without any local
  // signal — re-validate it every time instead of trusting it forever once resolved.
  if (cachedAccountId) {
    try {
      await authAccount(conn, cachedAccountId, accessToken);
      return cachedAccountId;
    } catch {
      cachedAccountId = null;
    }
  }

  const acctRes = (await conn.send(
    PAYLOAD_TYPE.GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
    "ProtoOAGetAccountListByAccessTokenReq",
    { accessToken },
  )) as unknown as { ctidTraderAccount: { ctidTraderAccountId: string }[] };
  if (acctRes.ctidTraderAccount.length === 0) throw new Error("No cTrader accounts on this access token");

  // A token can be linked to multiple accounts (e.g. old + new prop-firm challenge accounts)
  // and the list order isn't a guarantee of which one is actually active — try each until one
  // authenticates instead of blindly trusting index 0.
  let lastError: unknown;
  for (const acct of acctRes.ctidTraderAccount) {
    const id = String(acct.ctidTraderAccountId);
    try {
      await authAccount(conn, id, accessToken);
      cachedAccountId = id;
      return id;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No usable cTrader account on this access token");
}

async function resolveSymbolId(conn: CTraderConnection, accountId: string, symbolName: string): Promise<string> {
  let symbolId = cachedSymbolIds.get(symbolName);
  if (!symbolId) {
    const symRes = (await conn.send(PAYLOAD_TYPE.SYMBOLS_LIST_REQ, "ProtoOASymbolsListReq", {
      ctidTraderAccountId: accountId,
    })) as unknown as { symbol: { symbolId: string; symbolName: string }[] };
    for (const s of symRes.symbol) cachedSymbolIds.set(s.symbolName, String(s.symbolId));
    symbolId = cachedSymbolIds.get(symbolName);
    if (!symbolId) throw new Error(`Unknown symbol on this account: ${symbolName}`);
  }
  return symbolId;
}

async function fetchOneTrendbar(
  conn: CTraderConnection,
  accountId: string,
  symbolId: string,
  period: string,
  count: number,
  toTimestampMs?: number,
): Promise<Candle[]> {
  const periodNum = TRENDBAR_PERIOD[period];
  if (!periodNum) throw new Error(`Unknown trendbar period: ${period}`);

  // Empirically verified against demo.ctraderapi.com: the API always returns exactly
  // `count - 1` trendbars (count=1 → 0 bars, count=1000 → 999, ...) — `toTimestamp` falls
  // inside the still-forming current bar, which counts toward `count` internally but is
  // never included in the response since it isn't closed yet. Request one extra to
  // transparently give callers the number of (closed) bars they actually asked for.
  const trendRes = (await conn.send(PAYLOAD_TYPE.GET_TRENDBARS_REQ, "ProtoOAGetTrendbarsReq", {
    ctidTraderAccountId: accountId,
    symbolId,
    period: periodNum,
    toTimestamp: toTimestampMs ?? Date.now(),
    count: count + 1,
  })) as unknown as {
    trendbar: { low: string; deltaOpen: string; deltaHigh: string; deltaClose: string; volume: string; utcTimestampInMinutes: number }[];
  };

  return trendRes.trendbar
    .map((b) => {
      const low = Number(b.low);
      return {
        time: b.utcTimestampInMinutes * 60,
        open: (low + Number(b.deltaOpen)) / 100000,
        high: (low + Number(b.deltaHigh)) / 100000,
        low: low / 100000,
        close: (low + Number(b.deltaClose)) / 100000,
        volume: Number(b.volume),
      };
    })
    .sort((a, b) => a.time - b.time); // API order isn't guaranteed oldest-first
}

// Bug-Report Philip 2026-08-07 (dritte Runde, M5-Live-Test): trotz des Connect-Timeouts oben kam
// "signal timed out" weiterhin vor — der deckelt nämlich NUR die TLS-Verbindung selbst. Die drei
// nachgelagerten, zwingend sequenziellen send()-Requests (App-Auth, Account-Auth-Revalidierung,
// Trendbars) haben je ihr EIGENES 10s-Limit (siehe send() oben) — im ungünstigsten Fall summierte
// sich das zu 15s (Connect, alter Wert) + 10s + 10s + 10s = bis zu 45s für EINEN einzelnen
// Kerzen-Fetch, weit über dem 20s-Client-Timeout in forexCandles.js. Ein Gesamt-Zeitbudget für den
// KOMPLETTEN Connect+Auth+Fetch-Zyklus (statt nur Teilschritte einzeln zu deckeln) fängt genau das
// ab — bewusst UNTER dem Client-Timeout, damit die Edge Function immer ZUERST mit einer klaren 502
// aufgibt (die der Frontend-Retry in forexCandles.js abfängt), statt dass der Client zuerst die
// Geduld verliert und ein für den Nutzer nichtssagendes, nicht retry-fähiges "signal timed out"
// sieht. `onTimeout` schließt eine ggf. schon offene Verbindung sofort statt sie liegen zu lassen.
async function withOverallTimeout<T>(fn: () => Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  let timer: number;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`cTrader request timed out after ${ms}ms (Connect+Auth+Fetch insgesamt)`));
    }, ms);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
// 15s: Sicherheitsmarge unter den 20s des Client-Timeouts (siehe oben), großzügig über der
// beobachteten normalen Laufzeit (700ms-1.1s, siehe curl-Test) für den Single-Fetch-Fall.
const OVERALL_REQUEST_TIMEOUT_MS = 15_000;

export interface FetchTrendbarsOptions {
  env?: "demo" | "live";
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken?: string; // wenn gesetzt: bei Auth-Fehler einmal automatisch refreshen+retry
  onTokenRefresh?: (tokens: RefreshedTokens) => Promise<void> | void;
  symbolName: string;
  period: string; // key of TRENDBAR_PERIOD
  count: number;
  toTimestampMs?: number; // defaults to now
}

export async function fetchTrendbars(opts: FetchTrendbarsOptions): Promise<Candle[]> {
  const env = opts.env ?? "demo";
  return withAutoRefresh(opts, opts.accessToken, async (accessToken) => {
    let conn: CTraderConnection | null = null;
    try {
      return await withOverallTimeout(
        async () => {
          const c = await CTraderConnection.connect(env);
          conn = c;
          const accountId = await authenticate(c, opts.clientId, opts.clientSecret, accessToken);
          const symbolId = await resolveSymbolId(c, accountId, opts.symbolName);
          return await fetchOneTrendbar(c, accountId, symbolId, opts.period, opts.count, opts.toTimestampMs);
        },
        OVERALL_REQUEST_TIMEOUT_MS,
        () => conn?.close(),
      );
    } finally {
      conn?.close();
    }
  });
}

export interface FetchTrendbarsBatchOptions {
  env?: "demo" | "live";
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken?: string;
  onTokenRefresh?: (tokens: RefreshedTokens) => Promise<void> | void;
  requests: { symbolName: string; period: string; count: number; toTimestampMs?: number }[];
}

// Ein Connect/Auth-Handshake für mehrere Trendbar-Anfragen — genutzt vom poi-watcher-Cron,
// der pro Lauf ohnehin mehrere Requests je Instrument braucht (Preis + 4H + 1H) und das
// nicht für jede einzeln neu aufbauen muss.
export async function fetchTrendbarsBatch(opts: FetchTrendbarsBatchOptions): Promise<Candle[][]> {
  const env = opts.env ?? "demo";
  // Skaliert mit der Anzahl gebündelter Requests statt eines fixen Budgets wie beim Single-Fetch
  // oben (siehe OVERALL_REQUEST_TIMEOUT_MS) — mehr sequenzielle Trendbar-Requests nach dem einen
  // gemeinsamen Auth-Handshake brauchen legitim mehr Zeit. 18s-Deckel bleibt trotzdem unter dem
  // 20s-Client-Timeout des Frontend-Batch-Pfads (forexCandles.js) — poi-watcher selbst unterliegt
  // keinem so engen Client-Timeout, profitiert vom Deckel aber trotzdem (schnellerer, klarer
  // Fehler statt eines Hangs).
  const overallTimeoutMs = Math.min(6_000 + 2_000 * opts.requests.length, 18_000);
  return withAutoRefresh(opts, opts.accessToken, async (accessToken) => {
    let conn: CTraderConnection | null = null;
    try {
      return await withOverallTimeout(
        async () => {
          const c = await CTraderConnection.connect(env);
          conn = c;
          const accountId = await authenticate(c, opts.clientId, opts.clientSecret, accessToken);
          const results: Candle[][] = [];
          for (const req of opts.requests) {
            const symbolId = await resolveSymbolId(c, accountId, req.symbolName);
            results.push(await fetchOneTrendbar(c, accountId, symbolId, req.period, req.count, req.toTimestampMs));
          }
          return results;
        },
        overallTimeoutMs,
        () => conn?.close(),
      );
    } finally {
      conn?.close();
    }
  });
}
