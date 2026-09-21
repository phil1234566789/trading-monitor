# -*- coding: utf-8 -*-
# ABNAHMELAUF fuer die Alters-Schwelle des Close-Checks (Task "Alarm sobald die FVG steht",
# 21.09.2026). Philips Regel: an einem sehr jungen LQ-Level soll ein Close unter dem Sweep-Level
# den Sweep weiter disqualifizieren, an einem alten nicht mehr -- die Schwelle selbst soll aber
# ein MESSERGEBNIS sein, nicht sein Gefuehl ("sagen wir 1-3 oder 1-4h").
#
# Gemessen wird deshalb je Schwelle: wie viele Dealing Ranges kommen gegenueber dem alten Verhalten
# ("Check immer an") zusaetzlich dazu, und wie sehen deren Trefferquoten aus. Sind die zusaetzlichen
# deutlich schlechter, hat der Check seinen Zweck erfuellt und die Schwelle gehoert enger.
#
# Eingabe sind die Trockenlauf-Dumps von backfillTradeSetups.ts, je Schwelle einer:
#   BACKFILL_DRY_RUN=1 BACKFILL_FROM=2026-01-05 BACKFILL_TO=2026-09-17 \
#     BACKFILL_CLOSE_CHECK_MAX_AGE_H=<immer|24|8|4|2|0> \
#     BACKFILL_DUMP=analysis/dr-reichweite/daten-setups-sim-<v>.json deno run ... \
#     supabase/functions/trading-monitor-mcp/scripts/backfillTradeSetups.ts
import json, os, statistics
import drMerkmale as dm
from drMerkmale import lade_kerzen, messe_drs, PIPS_REIHE, R_REIHE, quote, quote_r

VARIANTEN = [("Check immer an (Stand 20.09.)", "immer"), ("nur < 24h", "24"), ("nur < 8h", "8"),
             ("nur < 4h", "4"), ("nur < 2h", "2"), ("Check aus", "0")]
BASIS = "immer"

cnd, times = lade_kerzen()


def lade(variante):
    pfad = os.path.join(dm._HIER, "daten-setups-sim-%s.json" % variante)
    rows = json.load(open(pfad))
    for i, r in enumerate(rows):
        r.setdefault("id", i + 1)
    return rows


def kopf(titel):
    print(titel)
    print("  %-30s %5s  " % ("", "n") + "".join("%6dP" % X for X in PIPS_REIHE)
          + "  |" + "".join("%6dR" % k for k in R_REIHE) + "   Median P / Risiko")


def zeile(name, g):
    if not g:
        print("  %-30s %5d" % (name, 0))
        return
    print("  %-30s %5d  " % (name, len(g)) + "".join("%6.0f%%" % quote(g, X) for X in PIPS_REIHE)
          + "  |" + "".join("%6.0f%%" % quote_r(g, k) for k in R_REIHE)
          + "   %5.1f / %4.1f" % (statistics.median(x["reach"] for x in g),
                                  statistics.median(x["risk"] for x in g)))


gemessen = {}
for _, v in VARIANTEN:
    res, info = messe_drs(lade(v), cnd, times)
    gemessen[v] = (res, info)

basis_keys = {x["ob_key"] for x in gemessen[BASIS][0]}

kopf("ALLE DEALING RANGES JE SCHWELLE")
for name, v in VARIANTEN:
    zeile(name, gemessen[v][0])
print()

kopf("NUR DIE ZUSAETZLICH GEFUNDENEN (gegen 'Check immer an')")
for name, v in VARIANTEN:
    if v == BASIS:
        continue
    zeile(name, [x for x in gemessen[v][0] if x["ob_key"] not in basis_keys])
print()

print("ZEILEN/DR-ZAHLEN")
for name, v in VARIANTEN:
    res, info = gemessen[v]
    neu = sum(1 for x in res if x["ob_key"] not in basis_keys)
    print("  %-30s Zeilen %5d   DRs %5d   ausgewertet %5d   davon neu %4d (+%.0f %%)"
          % (name, info["zeilen"], info["drs"], len(res), neu,
             100.0 * neu / max(1, len(basis_keys))))

# Die Schwelle waehlt man nicht an den kumulierten Gruppen oben -- jede enthaelt alle engeren mit.
# Entscheidend ist das RANDBAND je Schwelle: genau die DRs, die dazukommen, wenn man von der
# naechst-strengeren Schwelle auf diese geht. Sie tragen das Alter, um das es geht.
print()
kopf("RANDBAENDER -- was jede Lockerung EINZELN dazuholt")
for (name, v), (_, vorher) in zip(VARIANTEN[1:], VARIANTEN[:-1]):
    davor = {x["ob_key"] for x in gemessen[vorher][0]}
    zeile(name, [x for x in gemessen[v][0] if x["ob_key"] not in davor])
zeile("Basis: Check immer an", gemessen[BASIS][0])


# Gegenprobe zur Alters-Regel: die Randbaender oben zeigen KEINEN Alterstrend -- das aelteste Band
# ist bei 15 Pips das schlechteste. Dann trennt vielleicht nicht das Alter, sondern ob der Preis
# das gesweepte Level bis zur Impuls-Kerze WIEDER ZURUECKEROBERT hat: genau das ist der Unterschied
# zwischen einem Sweep-and-Reclaim (Setup #1617) und einem echten Bruch. Reine Auswertung ueber die
# Kerzen, kein zweiter Simulationslauf -- die Setup-Zeile traegt ls_price und ob_start_time.
zeit = {x["id"]: x for x in gemessen["0"][0]}
rows0 = {r["id"]: r for r in lade("0")}
letzter_close = {}
for x in gemessen["0"][0]:
    r = rows0[x["id"]]
    obst = dm.ts(r["ob_start_time"])
    vor = [c for c in cnd if dm.ts(r["ls_touched_time"]) < c["time"] <= obst]
    if not vor:
        letzter_close[x["id"]] = None
        continue
    c = vor[-1]["close"]
    letzter_close[x["id"]] = (c < r["ls_price"]) if r["direction"] == "long" else (c > r["ls_price"])

extras = [x for x in gemessen["0"][0] if x["ob_key"] not in basis_keys]
print()
kopf("ZUSAETZLICHE DRs, aufgeteilt nach Reclaim (statt nach Alter)")
zeile("Level zurueckerobert", [x for x in extras if letzter_close[x["id"]] is False])
zeile("bei der Impulskerze noch gebrochen", [x for x in extras if letzter_close[x["id"]] is True])
zeile("Basis: Check immer an", gemessen[BASIS][0])
