# -*- coding: utf-8 -*-
# Holt die Eingabedaten der Auswertung direkt aus Supabase in diesen Ordner.
#
# Vorher lagen SETUPS/CANDLES/LEVELS als Pfade auf Tool-Ergebnisdateien einer einzelnen
# Claude-Session in drMerkmale.py -- die sind nach der Session weg, die Auswertung damit nicht
# wiederholbar. Seit dem Backfill (20.09.2026, 336 -> 1231 Setup-Zeilen) sprengt der Bestand
# ausserdem das limit=500 von get_trade_setups, deshalb hier direkt ueber PostgREST statt ueber
# den MCP.
#
# Die geschriebenen Dateien sind Rohdaten und bleiben per .gitignore aus dem Repo -- reproduzierbar
# ist das Skript, nicht der Datenstand.
#
#   python zieheDaten.py [INSTRUMENT] [VON] [BIS]
#   Default: GBPUSD 2026-01-01 2026-09-19
import json, os, re, sys, urllib.request, urllib.parse

INSTRUMENT = sys.argv[1] if len(sys.argv) > 1 else "GBPUSD"
VON = sys.argv[2] if len(sys.argv) > 2 else "2026-01-01"
BIS = sys.argv[3] if len(sys.argv) > 3 else "2026-09-19"

hier = os.path.dirname(os.path.abspath(__file__))
env_pfad = os.path.abspath(os.path.join(hier, "..", "..", ".env"))
env = dict(re.findall(r"^([A-Z_]+)=(.*)$", open(env_pfad).read(), re.M))
BASE = env["VITE_SUPABASE_URL"].strip() + "/rest/v1/"
KEY = env["VITE_SUPABASE_ANON_KEY"].strip()


def hole_alle(tabelle, felder, filter_str, sortier_feld):
    """PostgREST deckelt eine Antwort serverseitig bei ~1000 Zeilen (siehe CLAUDE.md) -- deshalb
    blaettern und den Cursor am TATSAECHLICH gelieferten Stand weiterschieben, nicht an der
    angefragten Seitengroesse."""
    raus, offset = [], 0
    while True:
        p = "%s?%s&select=%s&order=%s.asc&limit=1000&offset=%d" % (tabelle, filter_str, felder, sortier_feld, offset)
        req = urllib.request.Request(BASE + p, headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
        teil = json.loads(urllib.request.urlopen(req, timeout=120).read().decode())
        if not teil:
            break
        raus.extend(teil)
        offset += len(teil)
        print("  %s: %d" % (tabelle, len(raus)), end="\r")
    print()
    return raus


print("Setups ...")
setups = hole_alle(
    "trade_setups",
    "id,instrument,direction,fractal_price,fractal_pivot_time,ls_price,ls_pivot_time,ls_touched_time,ls_timeframe,ob_top,ob_bottom,ob_start_time,ob_zone_id,notified,created_at",
    "instrument=eq.%s&ob_start_time=gte.%s&ob_start_time=lt.%s" % (INSTRUMENT, VON, BIS),
    "ob_start_time",
)
json.dump(setups, open(os.path.join(hier, "daten-setups.json"), "w"))
print("  %d Setup-Zeilen, davon %d mit ls_timeframe" % (len(setups), sum(1 for r in setups if r["ls_timeframe"])))

print("LQ-Level (nur noch fuer Altzeilen ohne ls_timeframe) ...")
levels = hole_alle("liquidity_levels", "price,pivot_time,timeframe,direction",
                   "instrument=eq.%s" % INSTRUMENT, "pivot_time")
json.dump(levels, open(os.path.join(hier, "daten-levels.json"), "w"))
print("  %d Level" % len(levels))

print("M5-Kerzen ...")
kerzen = hole_alle(
    "forex_candles",
    "time,open,high,low,close",
    "instrument=eq.%s&bar=eq.5m&time=gte.%s&time=lt.%s" % (INSTRUMENT, VON, BIS),
    "time",
)
# Auf die Form bringen, die die Auswertungs-Skripte erwarten (Unix-Sekunden statt ISO).
import datetime
for k in kerzen:
    k["time"] = int(datetime.datetime.fromisoformat(k["time"]).timestamp())
json.dump(kerzen, open(os.path.join(hier, "daten-kerzen.json"), "w"))
print("  %d M5-Kerzen" % len(kerzen))
