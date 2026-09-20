# -*- coding: utf-8 -*-
# Gemeinsame Merkmale einer Dealing Range, EINMAL definiert. Vorher lagen die Sweep-Herkunft und
# das Sweep-Alter in drei Skripten in je eigenen Kopien -- beim Nachziehen des Trends (19.09.2026)
# waere daraus eine vierte geworden. Die Auswertungs-Skripte importieren hier, rechnen selbst
# nichts davon nach.
import json, datetime

# Von zieheDaten.py geschrieben, liegen neben diesem Skript. Bis zum 20.09.2026 zeigten diese
# Pfade auf Tool-Ergebnisdateien einer einzelnen Claude-Session -- nach der Session weg und die
# Auswertung damit nicht wiederholbar.
import os
_HIER = os.path.dirname(os.path.abspath(__file__))
CANDLES = os.path.join(_HIER, "daten-kerzen.json")
LEVELS = os.path.join(_HIER, "daten-levels.json")

# Die Auswertung laeuft auf der SIMULATION ueber den ganzen Zeitraum (daten-setups-sim.json,
# erzeugt von backfillTradeSetups.ts im Trockenlauf), nicht auf der DB-Tabelle.
#
# Grund: die Tabelle ist gemischter Herkunft -- bis 15.07.2026 backgefuellt, danach live erkannt.
# Ueber denselben Zeitraum gerechnet liefern die beiden Verfahren NICHT dasselbe: Live-Zeilen
# kommen auf einen Reichweiten-Median von 12,9 Pips, simulierte auf 15,2, bei praktisch gleichem
# Risiko-Median (4,3 gegen 4,6). Die Einzel-Setups stimmen zu 96 % ueberein, aber der Live-Cron
# verpasst Ticks, und wer ein Setup einen Tick spaeter zuerst sieht, paart es mit einem anderen
# bestaetigenden OB -- andere OB-Kante, andere gemessene Reichweite.
#
# Fuer einen Monatsvergleich waere diese Naht toedlich: der Sprung zwischen Juni und Juli waere
# zur Haelfte ein Methodenwechsel. Deshalb EIN Verfahren ueber alles. Die DB-Tabelle bleibt
# unangetastet, sie ist die echte Alarm-Historie; daten-setups.json liegt fuer Gegenproben daneben.
SETUPS = os.path.join(_HIER, "daten-setups-sim.json")

PIP = 0.0001
ARM = 600                     # ob_start_time + 2 M5-Kerzen = FVG bestaetigt
HORIZON = 24 * 3600
BERLIN = 2 * 3600             # CEST im gesamten Messzeitraum 15.07.-16.09.2026
WIN_FROM, WIN_TO = 480, 1080  # GBPUSD-Handelsfenster aus trading_schedules, Minuten ab Mitternacht

ts = lambda s: int(datetime.datetime.fromisoformat(s).timestamp())
utc_dt = lambda sec: datetime.datetime.fromtimestamp(sec, datetime.timezone.utc)


def lade_setups():
    """Die simulierten Zeilen tragen keine DB-id -- die Auswertung braucht aber einen stabilen
    Schluessel je Zeile, also wird der Index vergeben (Reihenfolge ist deterministisch)."""
    rows = json.load(open(SETUPS))
    for i, r in enumerate(rows):
        r.setdefault("id", i + 1)
    return rows


def lade_kerzen():
    cnd = sorted(json.load(open(CANDLES)), key=lambda c: c["time"])
    return cnd, [c["time"] for c in cnd]


def lade_bekannte_level():
    """Schluessel der in liquidity_levels persistierten Level -- die Tabelle fuehrt nur 1H/4H.
    Wird seit dem Backfill nur noch fuer die Altzeilen ohne ls_timeframe gebraucht."""
    levels = json.load(open(LEVELS))
    return {(round(l["price"], 5), ts(l["pivot_time"])) for l in levels}


def lade_trend():
    """id -> {trend, nestedTrend}, geschrieben von messeTrendJeDr.py. Fehlt die Datei, liefert
    diese Funktion ein leeres dict -- die Auswertung soll dann sagen koennen, dass der Trend fehlt,
    statt mit einer Ausnahme abzubrechen."""
    try:
        return json.load(open("trend-je-dr.json"))
    except FileNotFoundError:
        return {}


def handelsstunden(a, b):
    """Stunden zwischen a und b, Samstag/Sonntag herausgerechnet (wie _shared/ageTier.ts)."""
    if b <= a:
        return 0.0
    sec, cur = 0, a
    while cur < b:
        nxt = min(b, cur + 3600)
        if utc_dt(cur).weekday() < 5:
            sec += nxt - cur
        cur = nxt
    return sec / 3600.0


def sweep_herkunft(r, known):
    """Ehrliche Dreiteilung statt einer unvollstaendigen Zuordnung:

      HTF sicher : in liquidity_levels gefunden, ODER Abstand zum Fraktal >5 Pips, ODER Vorlauf
                   >45 Min -- die beiden letzten sind fuer ein M5-LS per maxDistanceM5/
                   lsMaxLeadSecM5 unmoeglich (_shared/tradeSetup.ts).
      M5 sicher  : ls_pivot liegt NICHT auf einer vollen Stunde -- ein 1H-Pivot kann das nie.
      unklar     : auf voller Stunde, aber keines der HTF-Merkmale. Enthaelt echte M5-Pivots
                   (rund jeder 12.) und 1H-Level, deren Zeile nicht mehr existiert.
    """
    # Seit dem Backfill (20.09.2026) steht die Herkunft fuer 895 der 1231 Zeilen EXAKT in
    # ls_timeframe -- beim Erkennen mitgeschrieben statt hinterher geschaetzt. Die Heuristik
    # darunter gilt nur noch fuer die Altzeilen von vor dem 19.09.2026.
    if r.get("ls_timeframe") == "1H":
        return "HTF sicher"
    if r.get("ls_timeframe") == "5M":
        return "M5 sicher"
    dist = abs(r["ls_price"] - r["fractal_price"]) / PIP
    lead = (ts(r["fractal_pivot_time"]) - ts(r["ls_touched_time"])) / 60.0
    if ((round(r["ls_price"], 5), ts(r["ls_pivot_time"])) in known) or dist > 5.0 or lead > 45.0:
        return "HTF sicher"
    return "unklar" if ts(r["ls_pivot_time"]) % 3600 == 0 else "M5 sicher"


def merkmale(r, known, trend_map=None):
    """Alle Nicht-Preis-Merkmale einer DR aus ihrer Setup-Zeile."""
    herkunft = sweep_herkunft(r, known)
    alter = handelsstunden(ts(r["ls_pivot_time"]), ts(r["ls_touched_time"]))
    bt = utc_dt(ts(r["ob_start_time"]) + BERLIN)
    min_of_day = bt.hour * 60 + bt.minute
    t = (trend_map or {}).get(str(r["id"]), {})
    return {
        "herkunft": herkunft,
        # strict = nur die sicheren HTF-Faelle, broad = zusaetzlich die unklaren. Beide Varianten
        # werden gebraucht: strict untertreibt die HTF-Zahl, broad ueberschaetzt sie.
        "htf_strict": herkunft == "HTF sicher",
        "htf_broad": herkunft != "M5 sicher",
        "age_h": alter,
        "klasse": "Major (>=120h)" if alter >= 120 else ("Medium (24-120h)" if alter >= 24 else "Minor (<24h)"),
        "stunde": bt.hour,
        "min_of_day": min_of_day,
        "in_fenster": bt.weekday() < 5 and WIN_FROM <= min_of_day < WIN_TO,
        "trend": t.get("trend"),
        "nestedTrend": t.get("nestedTrend"),
    }


def trendlage(dr_richtung, trend):
    """Steht die DR mit dem 1H-Trend oder gegen ihn? uptrend + long = mit dem Trend.

    'unknown' bleibt eine eigene Gruppe und wird NICHT durch die Elternebene ersetzt -- bei
    unbekanntem Trend gehoert eine echte Kraftabwaegung hin, kein mechanischer Ersatz."""
    if trend not in ("uptrend", "downtrend"):
        return "Trend unklar"
    passt = (trend == "uptrend") == (dr_richtung == "long")
    return "mit dem Trend" if passt else "gegen den Trend"


# --- Pfad-Simulation, von deckelStopp.py und baenderTabellen.py gemeinsam genutzt --------------
import bisect as _bisect

_cache = {}


def lauf(x, ziel_pips, stop_pips):
    """Laeuft die M5-Kerzen ab FVG-Bestaetigung ab -> 'win' | 'loss' | 'offen'.

    Beides gemessen ab der nahen OB-Kante; der Entry bleibt fix dort, nur so sind zwei
    Stopp-Platzierungen vergleichbar. Ziel und Stopp in DERSELBEN M5-Kerze zaehlen als Verlust,
    wie in _shared/tradeSetupOutcome.ts."""
    if not _cache:
        _cache["setups"] = {r["id"]: r for r in lade_setups()}
        _cache["cnd"], _cache["times"] = lade_kerzen()
    setups, cnd, times = _cache["setups"], _cache["cnd"], _cache["times"]
    r = setups[x["id"]]
    d = x["dir"]
    ref = r["ob_bottom"] if d == "short" else r["ob_top"]
    start = ts(r["ob_start_time"]) + ARM
    ziel = ref - ziel_pips * PIP if d == "short" else ref + ziel_pips * PIP
    stop = ref + stop_pips * PIP if d == "short" else ref - stop_pips * PIP
    i = _bisect.bisect_left(times, start)
    while i < len(cnd) and cnd[i]["time"] <= start + HORIZON:
        c = cnd[i]
        traf_ziel = (c["low"] <= ziel) if d == "short" else (c["high"] >= ziel)
        traf_stop = (c["high"] >= stop) if d == "short" else (c["low"] <= stop)
        if traf_ziel and traf_stop:
            return "loss"
        if traf_ziel:
            return "win"
        if traf_stop:
            return "loss"
        i += 1
    return "offen"
