# -*- coding: utf-8 -*-
# Gemeinsame Merkmale einer Dealing Range, EINMAL definiert. Vorher lagen die Sweep-Herkunft und
# das Sweep-Alter in drei Skripten in je eigenen Kopien -- beim Nachziehen des Trends (19.09.2026)
# waere daraus eine vierte geworden. Die Auswertungs-Skripte importieren hier, rechnen selbst
# nichts davon nach.
import json, datetime
from zoneinfo import ZoneInfo

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
BERLIN = ZoneInfo('Europe/Berlin')  # Die Jahresauswertung enthält CET und CEST.
WIN_FROM, WIN_TO = 480, 1080  # GBPUSD-Handelsfenster aus trading_schedules, Minuten ab Mitternacht

ts = lambda s: int(datetime.datetime.fromisoformat(s).timestamp())
utc_dt = lambda sec: datetime.datetime.fromtimestamp(sec, datetime.timezone.utc)
berlin_dt = lambda sec: utc_dt(sec).astimezone(BERLIN)


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


def dr_schluessel(r):
    """Stabile Identitaet einer DR ueber Datenstaende hinweg: Richtung + Impuls-Kerze. Die `id` aus
    lade_setups() ist der ZEILENINDEX und zeigt nach einem neuen Simulationslauf auf eine andere DR
    -- eine damit geschluesselte Datei (trend-je-dr.json) waere danach still falsch statt leer."""
    return "%s|%s" % (r["direction"], r["ob_start_time"])


def lade_trend():
    """dr_schluessel -> {trend, nestedTrend}, geschrieben von messeTrendJeDr.py. Fehlt die Datei,
    liefert diese Funktion ein leeres dict -- die Auswertung soll dann sagen koennen, dass der Trend
    fehlt, statt mit einer Ausnahme abzubrechen."""
    try:
        return json.load(open(os.path.join(_HIER, "trend-je-dr.json")))
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
    bt = berlin_dt(ts(r["ob_start_time"]))
    min_of_day = bt.hour * 60 + bt.minute
    t = (trend_map or {}).get(dr_schluessel(r), {})
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


def lauf(x, ziel_pips, stop_pips, retest=False):
    """Laeuft die M5-Kerzen ab FVG-Bestaetigung ab -> 'win' | 'loss' | 'offen' | 'kein Retest'.

    Beides gemessen ab der nahen OB-Kante; der Entry bleibt fix dort, nur so sind zwei
    Stopp-Platzierungen vergleichbar. Ziel und Stopp in DERSELBEN M5-Kerze zaehlen als Verlust,
    wie in _shared/tradeSetupOutcome.ts.

    retest=True zaehlt erst ab der Kerze, die die nahe OB-Kante tatsaechlich wieder beruehrt, und
    liefert 'kein Retest', wenn das binnen HORIZON nie passiert. Das Standardmodell unterstellt
    einen Entry an der Kante, ohne zu pruefen, ob der Preis je dorthin zurueckkommt -- der Pfad
    startet damit schon so weit im Plus, wie die FVG gross ist. Fuer die meisten Schnitte ist das
    egal, fuer einen Schnitt NACH DER FVG-GROESSE ist es genau die gemessene Groesse (siehe
    fvgBaender.py: im Standardmodell steigt die 3R-Quote von 47 auf 91 %, mit Retest-Entry ist sie
    flach)."""
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
    drin = not retest
    while i < len(cnd) and cnd[i]["time"] <= start + HORIZON:
        c = cnd[i]
        if not drin:
            drin = (c["high"] >= ref) if d == "short" else (c["low"] <= ref)
            if not drin:
                i += 1
                continue
        traf_ziel = (c["low"] <= ziel) if d == "short" else (c["high"] >= ziel)
        traf_stop = (c["high"] >= stop) if d == "short" else (c["low"] <= stop)
        if traf_ziel and traf_stop:
            return "loss"
        if traf_ziel:
            return "win"
        if traf_stop:
            return "loss"
        i += 1
    return "offen" if drin else "kein Retest"

# --- Grundmessung je Dealing Range -------------------------------------------------------------
# Von messeDrReichweite.py (Hauptauswertung) und vergleicheCloseCheck.py (Abnahmelauf der
# Close-Check-Schwelle, 21.09.2026) gemeinsam genutzt. Vorher lag die Messung nur als Rumpf in
# messeDrReichweite.py -- der Vergleichslauf haette sie kopieren muessen, und genau daran driften
# zwei Messungen auseinander.
import collections as _collections
import bisect as _bis


def gruppiere_drs(rows):
    """Eine DR = ein M5-OB, Zeilen desselben OB werden zusammengefasst. Merkmalstraeger der Gruppe
    ist die Zeile mit einem EIGENEN bestaetigten Fraktal -- dieselbe Wahl wie setup_quelle in der
    Migration, damit Auswertung und Tabelle dieselbe Zeile meinen."""
    for r in rows:
        r["_B"] = (r["fractal_price"] == r["ls_price"] and r["fractal_pivot_time"] == r["ls_pivot_time"])
    groups = _collections.defaultdict(list)
    for r in rows:
        groups[(r["direction"], r["ob_start_time"], r["ob_top"], r["ob_bottom"])].append(r)
    return [(key, ([r for r in g if not r["_B"]] or g)[0], g) for key, g in groups.items()]


def messe_drs(rows, cnd, times):
    """Reichweite/Risiko/Invalidierungszeit je DR, gemessen ab FVG-Bestaetigung
    (ob_start_time + ARM) -> (res, info)."""
    drs = gruppiere_drs(rows)
    res, sanity = [], 0
    for key, lead, g in drs:
        d, obst, obtop, obbot = key
        start = ts(obst) + ARM
        if not (times[0] <= start <= times[-1] - 3600):
            continue
        inval = obtop if d == "short" else obbot
        ref = obbot if d == "short" else obtop
        # Sanity: Invalidierung muss auf der richtigen Seite der Referenz liegen
        if (inval <= ref) if d == "short" else (inval >= ref):
            sanity += 1
            continue
        i = _bis.bisect_left(times, start)
        reach, t_inval = 0.0, None
        while i < len(cnd) and cnd[i]["time"] <= start + HORIZON:
            c = cnd[i]
            fav = (ref - c["low"]) if d == "short" else (c["high"] - ref)
            reach = max(reach, fav / PIP)
            if (c["high"] >= inval) if d == "short" else (c["low"] <= inval):
                t_inval = (c["time"] - start) / 60.0
                break
            i += 1
        res.append(dict(id=lead["id"], dir=d, reach=reach, t_inval=t_inval,
                        risk=abs(inval - ref) / PIP, day=obst[:10],
                        ob_key=(d, ts(obst))))
    return res, dict(zeilen=len(rows), drs=len(drs), sanity=sanity,
                     ohne_fraktal=sum(1 for _, lead, _ in drs if lead["_B"]))


# --- Leitern gegen den gedeckelten Stopp -------------------------------------------------------
# Lagen bis 23.09.2026 nur in baenderTabellen.py. Das Skript druckt beim Import seine ganze
# Auswertung, ein zweiter Nutzer (fvgBaender.py) haette sie also kopieren muessen -- und genau so
# driften zwei Messungen auseinander.
DECKEL = 6  # Philips Stopp-Deckel, seit 20.09.2026 die Konvention (siehe PLAN-dr-statistik-ui.md)


def mess_gedeckelt(g, k):
    """-> (Quote, Treffer, unentschieden) fuer ein k-faches des gedeckelten Stopps.
    Unentschieden = weder Ziel noch Stopp binnen 24h."""
    w = l = o = 0
    for x in g:
        stop = min(x["risk"], DECKEL)
        erg = lauf(x, k * stop, stop)
        if erg == "offen":
            o += 1
        elif erg == "win":
            w += 1
        else:
            l += 1
    return (100.0 * w / (w + l) if w + l else float("nan")), w, o


# Die Pip-Leiter misst GEGEN DENSELBEN STOPP: min(strukturelles Risiko, Deckel) -- nicht pauschal
# 6 Pips, bei einer engen DR ist der Stopp enger. Zwei Leitern nebeneinander duerfen nicht zwei
# verschiedene Fragen beantworten ("bevor mein Stopp fiel" gegen "bevor die Range strukturell starb").
def mess_pips_gedeckelt(g, X):
    """-> (Quote, Treffer, unentschieden) fuer ein festes Pip-Ziel gegen den gedeckelten Stopp."""
    w = l = o = 0
    for x in g:
        erg = lauf(x, X, min(x["risk"], DECKEL))
        if erg == "offen":
            o += 1
        elif erg == "win":
            w += 1
        else:
            l += 1
    return (100.0 * w / (w + l) if w + l else float("nan")), w, o


# Leitkennzahl: Trefferquote (siehe quotenTabelle.py) -- hier, damit der Vergleichslauf und die
# Haupttabellen dieselbe Rechnung benutzen.
PIPS_REIHE = (10, 15, 20, 25, 30, 35, 40)
R_REIHE = (2, 3, 4, 5, 6)
quote = lambda g, X: 100.0 * sum(1 for x in g if x["reach"] >= X) / len(g)
quote_r = lambda g, k: 100.0 * sum(1 for x in g if x["reach"] >= k * x["risk"]) / len(g)
