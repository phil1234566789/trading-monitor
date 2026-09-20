# -*- coding: utf-8 -*-
# Holt zu jeder gemessenen Dealing Range den 1H-Market-Structure-Trend zu ihrem Startzeitpunkt und
# legt ihn als trend-je-dr.json ab. Ohne diese Datei kann keine der Auswertungen nach Trend/
# Gegen-Trend trennen -- die Grundmessung und die vier Filter kennen den Trend gar nicht.
#
# Ging bis zum 19.09.2026 nicht: get_data_export starb fuer jeden aelteren Replay-Zeitpunkt an
# "cTrader error INVALID_REQUEST: Count must be bigger than ZERO", weil compute1hStructureState
# sich am neuesten Daily-Pivot relativ zu JETZT verankerte (Commit 740375f, milk-city-Task
# compute1hstructurestate-daily-pivot-anker-crasht-bei-altem-replayuntilsec).
#
# Gespeichert werden beide Ebenen: `trend` (aeussere Struktur) und `nestedTrend` (innere, oft null).
# Die Auswertung entscheidet selbst, was sie damit macht -- "unknown" bleibt eine eigene Gruppe und
# wird NICHT durch den Trend der Elternebene ersetzt (siehe Memory kraft-abwaegung-bei-unknown-trend:
# bei unbekanntem inneren Trend gehoert eine echte Kraftabwaegung hin, kein mechanischer Ersatz).
import json, os, sys, time, datetime, urllib.request

MCP_URL = "https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/trading-monitor-mcp"
ZIEL = "trend-je-dr.json"
from drMerkmale import lade_setups, ts, ARM



def mcp(name, args, _id=[0]):
    _id[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _id[0], "method": "tools/call",
                       "params": {"name": name, "arguments": args}}).encode()
    req = urllib.request.Request(MCP_URL, data=body, headers={
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": "Bearer " + os.environ["TRADING_MONITOR_MCP_TOKEN"]})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read().decode()
    if raw.lstrip().startswith(("event:", "data:")):
        raw = "".join(l[5:].strip() for l in raw.splitlines() if l.startswith("data:"))
    msg = json.loads(raw)
    if "error" in msg:
        raise RuntimeError(msg["error"])
    inhalt = msg["result"]["content"][0]["text"]
    if msg["result"].get("isError"):
        raise RuntimeError(inhalt[:200])
    return json.loads(inhalt)


setups = {r["id"]: r for r in lade_setups()}
drs = json.load(open("punkt1_result.json"))
out = json.load(open(ZIEL)) if os.path.exists(ZIEL) else {}

for n, x in enumerate(drs, 1):
    if str(x["id"]) in out:
        continue
    start = ts(setups[x["id"]]["ob_start_time"]) + ARM
    try:
        s = mcp("get_data_export", {"instrument": "GBPUSD", "replayUntilSec": start})["structure1h"]
        rng = s.get("currRange") or {}
        # nestedTrend ist im Export das ganze verschachtelte Struktur-Objekt; hier interessiert nur
        # sein Trend -- sonst ist die Datei das Hundertfache gross.
        nested = s.get("nestedTrend")
        out[str(x["id"])] = {
            "trend": s.get("trend"),
            "nestedTrend": nested.get("trend") if isinstance(nested, dict) else nested,
            # Range-Grenzen mitgenommen, damit sich spaeter auch "wo in der Range entsteht die DR"
            # fragen laesst, ohne alle 255 Aufrufe zu wiederholen.
            "rangeHigh": (rng.get("high") or {}).get("price"),
            "rangeLow": (rng.get("low") or {}).get("price"),
        }
    except Exception as e:
        out[str(x["id"])] = {"fehler": str(e)[:160]}
    if n % 25 == 0:
        json.dump(out, open(ZIEL, "w"))
        print("%d/%d" % (n, len(drs)), flush=True)
    time.sleep(0.2)

json.dump(out, open(ZIEL, "w"))
fehler = sum(1 for v in out.values() if "fehler" in v)
print("fertig: %d Zeilen, %d Fehler" % (len(out), fehler))
if fehler:
    print("Beispiel:", next(v["fehler"] for v in out.values() if "fehler" in v))
