# -*- coding: utf-8 -*-
# Gemeinsame Merkmale einer Dealing Range, EINMAL definiert. Vorher lagen die Sweep-Herkunft und
# das Sweep-Alter in drei Skripten in je eigenen Kopien -- beim Nachziehen des Trends (19.09.2026)
# waere daraus eine vierte geworden. Die Auswertungs-Skripte importieren hier, rechnen selbst
# nichts davon nach.
import json, datetime

BASE = r"C:\Users\Philip\.claude\projects\c--Users-Philip-Documents-git-trading-monitor\25cfa4c0-a261-49e1-9482-af67f53adc09\tool-results"
SETUPS = BASE + r"\mcp-trading-monitor-get_trade_setups-1789808350250.txt"
CANDLES = BASE + r"\mcp-trading-monitor-get_forex_candles_archive-1789814595814.txt"
LEVELS = BASE + r"\mcp-trading-monitor-get_near_relevant_liquidity_levels-1789817921915.txt"

PIP = 0.0001
ARM = 600                     # ob_start_time + 2 M5-Kerzen = FVG bestaetigt
HORIZON = 24 * 3600
BERLIN = 2 * 3600             # CEST im gesamten Messzeitraum 15.07.-16.09.2026
WIN_FROM, WIN_TO = 480, 1080  # GBPUSD-Handelsfenster aus trading_schedules, Minuten ab Mitternacht

ts = lambda s: int(datetime.datetime.fromisoformat(s).timestamp())
utc_dt = lambda sec: datetime.datetime.fromtimestamp(sec, datetime.timezone.utc)


def lade_setups():
    return json.load(open(SETUPS))


def lade_kerzen():
    cnd = sorted(json.load(open(CANDLES)), key=lambda c: c["time"])
    return cnd, [c["time"] for c in cnd]


def lade_bekannte_level():
    """Schluessel der in liquidity_levels persistierten Level -- die Tabelle fuehrt nur 1H/4H."""
    levels = json.load(open(LEVELS))["levels"]
    return {(round(l["price"], 5), l["pivotTime"]) for l in levels}


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
