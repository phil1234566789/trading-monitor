# -*- coding: utf-8 -*-
# Winrate nach Philips eigener Definition: "Wenn die DR ihr Target erreicht, bevor sie den
# Invalidierungspunkt erreicht, dann gilt sie als erfolgreich. Punkt."
#
# Daraus folgt: DIE Winrate gibt es nicht. Sie haengt daran, welches Ziel man setzt -- ein nahes
# Ziel wird oft erreicht und bringt wenig, ein weites selten und bringt viel. Deshalb steht hier
# immer Quote UND RR UND Erwartungswert nebeneinander, nie die Quote allein.
#
# Abgrenzung zu get_trade_setup_winrate (trade_setup_outcomes): das Tool rechnet je SETUP-ZEILE
# gegen ein festes 2,5-RR-Ziel mit bei 6 Pips gedeckeltem Stopp. Hier zaehlt eine DEALING RANGE
# (Path-A- und Path-B-Zeile desselben M5-OB zusammengefasst) gegen ein Ziel aus find_targets und
# gegen das Extrem-Fraktal als Invalidierung. Beide Zahlen sind richtig, sie beantworten nur
# verschiedene Fragen.
import statistics
from drMerkmale import lade_setups, lade_bekannte_level, lade_trend, merkmale
import filterGegenkraft as gk
import messeFindTargets as ft

med = lambda v: statistics.median(v) if v else float("nan")

drs = ft.drs_laden()
roh = ft.roh_laden()
known, trend = lade_bekannte_level(), lade_trend()
by_id = {r["id"]: r for r in lade_setups()}
gliste = gk.build(20)
gdrs = {x["id"]: x for x in gliste}
for d in drs:
    d["kand"] = ft.kandidaten(d, roh[d["id"]])
    d.update(merkmale(by_id[d["id"]], known, trend))
    g = gdrs.get(d["id"])
    d["konstellation"] = gk.konstellation(g, gliste, "broad") if g else None

REGELN = [("nahster Kandidat", ft.nahster), ("Ziel >=10 Pips", ft.erster_ab(10)),
          ("Ziel >=15 Pips", ft.erster_ab(15)), ("Ziel >=20 Pips", ft.erster_ab(20)),
          ("Ziel >=30 Pips", ft.erster_ab(30))]

# Die Filter stapeln sich in der Reihenfolge ihrer Belegstaerke (siehe README): Handelszeit zuerst,
# dann Gegenkraft, dann Sweep-Herkunft. Die letzte Stufe ist mit n=30 bewusst als Ausblick gedacht.
GRUPPEN = [
    ("alle DRs", lambda d: True),
    ("im Handelsfenster 08-18", lambda d: d["in_fenster"]),
    ("+ keine lebende Gegen-DR", lambda d: d["in_fenster"] and d["konstellation"] == "keine Gegen-DR"),
    ("+ HTF-Sweep", lambda d: d["in_fenster"] and d["konstellation"] == "keine Gegen-DR" and d["htf_broad"]),
]


def quote(menge, pick):
    """Nur ENTSCHIEDENE DRs: Ziel erreicht oder invalidiert. Eine DR, die binnen 24h weder das
    eine noch das andere getan hat, waere noch offen und gehoert in keine Quote."""
    paare = [(x, k) for x, k in (ft.ergebnis(d, pick) for d in menge) if k]
    entsch = [(x, k) for x, k in paare if x is not None]
    if not entsch:
        return None
    tr = [k for x, k in entsch if x > 0]
    return (len(entsch), 100.0 * len(tr) / len(entsch), med([k["rr"] for _, k in paare]),
            sum(x for x, _ in entsch) / len(entsch))


for gname, f in GRUPPEN:
    menge = [d for d in drs if f(d)]
    print("%s  (n=%d Dealing Ranges)" % (gname, len(menge)))
    for rn, rp in REGELN:
        q = quote(menge, rp)
        if q:
            print("   %-18s entschieden %3d | Winrate %3.0f%% | RR-Median %4.2f | EV %+.2f R" % (rn, *q))
    print()

print("Die R-Rechnung ist die der IDEE: Einstieg an der nahen OB-Kante, Stopp am Extrem-Fraktal.")
print("Der reale Entry liegt woanders -- den macht Philip selbst, siehe README-Grenzen.")
