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
    const socket = await Deno.connectTls({ hostname: HOSTS[env], port: PORT });
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

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export interface FetchTrendbarsOptions {
  env?: "demo" | "live";
  clientId: string;
  clientSecret: string;
  accessToken: string;
  symbolName: string;
  period: string; // key of TRENDBAR_PERIOD
  count: number;
  toTimestampMs?: number; // defaults to now
}

export async function fetchTrendbars(opts: FetchTrendbarsOptions): Promise<Candle[]> {
  const env = opts.env ?? "demo";
  const conn = await CTraderConnection.connect(env);
  try {
    await conn.send(PAYLOAD_TYPE.APPLICATION_AUTH_REQ, "ProtoOAApplicationAuthReq", {
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
    });

    if (!cachedAccountId) {
      const acctRes = (await conn.send(
        PAYLOAD_TYPE.GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ,
        "ProtoOAGetAccountListByAccessTokenReq",
        { accessToken: opts.accessToken },
      )) as unknown as { ctidTraderAccount: { ctidTraderAccountId: string }[] };
      if (acctRes.ctidTraderAccount.length === 0) throw new Error("No cTrader accounts on this access token");
      cachedAccountId = String(acctRes.ctidTraderAccount[0].ctidTraderAccountId);
    }
    const accountId = cachedAccountId;

    await conn.send(PAYLOAD_TYPE.ACCOUNT_AUTH_REQ, "ProtoOAAccountAuthReq", {
      ctidTraderAccountId: accountId,
      accessToken: opts.accessToken,
    });

    let symbolId = cachedSymbolIds.get(opts.symbolName);
    if (!symbolId) {
      const symRes = (await conn.send(PAYLOAD_TYPE.SYMBOLS_LIST_REQ, "ProtoOASymbolsListReq", {
        ctidTraderAccountId: accountId,
      })) as unknown as { symbol: { symbolId: string; symbolName: string }[] };
      for (const s of symRes.symbol) cachedSymbolIds.set(s.symbolName, String(s.symbolId));
      symbolId = cachedSymbolIds.get(opts.symbolName);
      if (!symbolId) throw new Error(`Unknown symbol on this account: ${opts.symbolName}`);
    }

    const period = TRENDBAR_PERIOD[opts.period];
    if (!period) throw new Error(`Unknown trendbar period: ${opts.period}`);

    const toTimestamp = opts.toTimestampMs ?? Date.now();
    const trendRes = (await conn.send(PAYLOAD_TYPE.GET_TRENDBARS_REQ, "ProtoOAGetTrendbarsReq", {
      ctidTraderAccountId: accountId,
      symbolId,
      period,
      toTimestamp,
      count: opts.count,
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
  } finally {
    conn.close();
  }
}
