Anthropic Academy — Model Context Protocol: Advanced Topics:

https://anthropic.skilljar.com/model-context-protocol-advanced-topics

Unsere beiden MCP-Server (`trading-monitor-mcp`, `milk-city`) nutzen bisher nur das
Basis-Primitiv "Tools" über HTTP (Supabase Edge Function, Bearer-Token). Die hier gelisteten
Konzepte sind das, was der Kurs zusätzlich behandelt und was unsere Server (noch) nicht nutzen.

## Sampling

Server fordert *während* eines Tool-Calls über den Client einen LLM-Call an, statt selbst ein
Modell anzubinden (JSON-RPC über die offene Verbindung, nicht möglich bei purem REST). Löst zwei
strukturelle Probleme, keine reine Effizienzfrage:

1. **Kein eigener API-Key im Server nötig.** Relevant für Server, die von *fremden* Leuten
   installiert werden (Open-Source/öffentlich verteilt) — sonst müsste entweder der Server-Autor
   für den API-Zugriff aller Nutzer zahlen, oder jeder Nutzer zusätzlich zu seinem eigenen
   Claude/GPT-Abo einen zweiten, separaten Key nur für dieses eine Tool einrichten. Mit Sampling
   nutzt der Server automatisch das Modell/Abo, das der jeweils angeschlossene Client schon hat.
2. **Der Client sieht/genehmigt jeden LLM-Call, bevor er passiert** — mit eigenem Server-Key
   könnte der Server das Modell unsichtbar für den Nutzer aufrufen, mit Sampling läuft jeder Call
   zwingend sichtbar über den Client.

**Für uns nicht relevant**: beide Server laufen nur bei uns selbst, kein fremder Vertrieb, keine
fremden Nutzer, die sich einen eigenen Key sparen müssten. Unsere Tools liefern ohnehin nur
Rohdaten — die Analyse macht Claude in der Session, nicht der Server selbst.

## Roots

Permission-System: Server bekommt vom Client mitgeteilt, auf welche Verzeichnisse er zugreifen
darf (Security-Boundary). Betrifft nur dateisystem-basierte MCP-Server — unsere sind reine
HTTP/DB-Server ohne Dateisystemzugriff, daher nicht anwendbar.

## Log & Progress Notifications

Echtzeit-Feedback für lange Operationen: Context-Objekte, Logging-Callbacks, Progress-Reporting.
Könnte für einen zukünftigen lang laufenden Tool-Call relevant werden (z.B. ein Backfill-Tool,
das mehrere Minuten läuft) — aktuell laufen alle unsere Tools schnell genug (einzelne DB-Queries),
kein Bedarf.

## Transports

- **STDIO** — Standard-I/O-Streams, Initialisierungs-Handshake. Das war der ursprüngliche
  Transport von `mcp-server/` (lokal, `npx tsx`), bevor beide Server am 2026-08-16/17 auf HTTP
  umgestellt wurden (siehe Haupt-CLAUDE.md "MCP server"-Abschnitt).
- **StreamableHTTP** — Server-Sent Events (SSE) für Server→Client-Kommunikation, Session-
  Management, Dual-Connection-Architektur. Das ist der Transport, den unsere Edge Functions
  faktisch nutzen (HTTP + Bearer-Token, `verify_jwt = false`).
  - **Advanced Topics**: Konfigurations-Flags, server-initiierte Requests — potenziell relevant,
    falls ein Server mal proaktiv (statt nur auf Anfrage) etwas an die Session pushen soll.
  - **State & StreamableHTTP**: stateless HTTP für horizontale Skalierung hinter einem
    Load-Balancer. Relevant, falls einer unserer Server je unter nennenswerte Last kommt —
    Supabase Edge Functions skalieren ohnehin automatisch, aber falls Session-State zwischen
    Requests gebraucht wird (aktuell nicht der Fall, jeder Tool-Call ist zustandslos), lohnt sich
    ein Blick hier, bevor man sich versehentlich in einen zustandsbehafteten Server hineinbaut.
- **JSON Message Architecture** — Unterscheidung Request-Result-Paare vs. Notification-Messages.
  Hintergrundwissen fürs Debuggen, falls mal ein Tool-Call sich seltsam verhält.

## Fazit

Am ehesten interessant, falls wir mal erweitern: Progress Notifications (lang laufende Tools)
und die StreamableHTTP-Advanced-/State-Themen (falls Last/Skalierung je ein Thema wird). Sampling
und Roots passen strukturell nicht zu unserem aktuellen Server-Design (reine Daten-Tools, kein
Dateisystem, keine serverseitige LLM-Logik).
