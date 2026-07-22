#!/usr/bin/env node
// Manuelle Re-Authentifizierung für den cTrader Open API Access-Token (läuft nach ~30
// Tagen ab, siehe PLAN-notifications.md "Bekannte Lücken"). Kein automatischer Refresh
// im Projekt eingebaut, daher dieser einmalige Helper statt eines Postman/curl-Handrolls.
//
// Nutzung:
//   1) Env setzen (nicht committen!):
//        $env:CTRADER_CLIENT_ID="..."; $env:CTRADER_CLIENT_SECRET="..."
//      (Werte stehen im Spotware Connect Dashboard unter der App, siehe connect.spotware.com)
//   2) node scripts/ctrader-reauth.mjs
//      -> öffnet/druckt die Autorisierungs-URL, im Browser einloggen + genehmigen
//      -> Browser landet auf http://localhost:5173/oauth/callback?code=XYZ (Seite lädt
//         nicht, das ist ok — den "code"-Parameter aus der Adresszeile kopieren)
//   3) node scripts/ctrader-reauth.mjs <code>
//      -> tauscht den Code gegen ein frisches Access-/Refresh-Token, druckt beide plus
//         den fertigen `supabase secrets set`-Befehl zum Kopieren

const CLIENT_ID = process.env.CTRADER_CLIENT_ID;
const CLIENT_SECRET = process.env.CTRADER_CLIENT_SECRET;
const REDIRECT_URI = process.env.CTRADER_REDIRECT_URI || "http://localhost:5173/oauth/callback";
const TOKEN_URL = "https://openapi.ctrader.com/apps/token";
const AUTH_URL = "https://connect.spotware.com/apps/auth";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("CTRADER_CLIENT_ID / CTRADER_CLIENT_SECRET fehlen als Env-Variablen.");
  process.exit(1);
}

const code = process.argv[2];

if (!code) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "accounts");
  console.log("Schritt 1: Diese URL im Browser öffnen und mit dem cTrader-Konto einloggen/genehmigen:\n");
  console.log(url.toString());
  console.log("\nDanach den `code`-Parameter aus der Ziel-URL (localhost:5173/oauth/callback?code=...)");
  console.log("kopieren und erneut aufrufen: node scripts/ctrader-reauth.mjs <code>");
  process.exit(0);
}

const tokenUrl = new URL(TOKEN_URL);
tokenUrl.searchParams.set("grant_type", "authorization_code");
tokenUrl.searchParams.set("code", code);
tokenUrl.searchParams.set("redirect_uri", REDIRECT_URI);
tokenUrl.searchParams.set("client_id", CLIENT_ID);
tokenUrl.searchParams.set("client_secret", CLIENT_SECRET);

const res = await fetch(tokenUrl, { method: "GET" });
const body = await res.json();

if (!res.ok || body.errorCode) {
  console.error("Token-Exchange fehlgeschlagen:", body);
  process.exit(1);
}

console.log("Neues Access-Token:", body.accessToken);
console.log("Neues Refresh-Token:", body.refreshToken);
console.log("Läuft ab in (s):", body.expiresIn);
console.log(
  "\nDiese SQL-Zeile in der Supabase-SQL-Editor-Konsole ausführen, um die Tabelle" +
    " `ctrader_oauth_tokens` zu seeden (das ist jetzt die eigentliche Quelle, aus der" +
    " ctrader-candles/poi-watcher lesen — nicht mehr das CTRADER_ACCESS_TOKEN-Secret,",
);
console.log("das nur noch als Erst-Deployment-Fallback dient):\n");
console.log(
  `insert into ctrader_oauth_tokens (id, access_token, refresh_token) values (1, '${body.accessToken}', '${body.refreshToken}')` +
    " on conflict (id) do update set access_token = excluded.access_token, refresh_token = excluded.refresh_token;",
);
