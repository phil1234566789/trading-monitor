"""Statische, reproduzierbare Übersicht der gemessenen FXCM-Reichweiten."""
import json
from collections import Counter
from html import escape
from pathlib import Path
from drMerkmale import lade_setups, merkmale

ROOT = Path(__file__).resolve().parent
rows = json.loads((ROOT / "punkt1_result.json").read_text(encoding="utf-8"))
coverage = json.loads((ROOT / "fxcm-abdeckung-2025.json").read_text(encoding="utf-8"))
years = Counter(r["day"][:4] for r in rows)
ages = Counter(merkmale(r, set())["klasse"] for r in lade_setups())
major, medium = ages["Major (>=120h)"], ages["Medium (24-120h)"]
archive = Counter()
for month in coverage["months"]:
    if month["bar"] == "5m":
        archive[month["instrument"]] += month["candles"]
targets = (10, 15, 20, 25, 30, 35, 40)


def quote(group, target):
    return 100 * sum(r["reach"] >= target for r in group) / len(group)


def table(group):
    headings = "".join(f"<th>{p} Pips</th>" for p in targets)
    values = "".join(f"<td>{quote(group, p):.0f} %</td>" for p in targets)
    return f"<div class='scroll'><table><tr>{headings}</tr><tr>{values}</tr></table></div>"


monthly = []
for month in sorted({r["day"][:7] for r in rows}):
    group = [r for r in rows if r["day"].startswith(month)]
    q = quote(group, 15)
    monthly.append(
        f"<div class='month'><span>{month}</span><div class='track'>"
        f"<div class='bar' style='width:{q:.2f}%'></div></div>"
        f"<strong>{q:.0f} %</strong><small>n = {len(group)}</small></div>"
    )

year_cards = "".join(
    f"<section><h2>{escape(year)} <small>· {count} Setups</small></h2>{table([r for r in rows if r['day'].startswith(year)])}</section>"
    for year, count in sorted(years.items())
)
reports = ("basis", "quoten", "baender", "saisonalitaet", "htf-sweep", "gegenkraft",
           "alter-handelszeit", "leiter", "deckel", "find-targets", "trend", "winrate")
links = " · ".join(f"<a href='ergebnis-{r}.txt'>{escape(r)}</a>" for r in reports)
html = f"""<!doctype html>
<html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FXCM · GBPUSD 2025–2026</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#10141e;color:#e6ebf5;font:16px/1.55 system-ui,sans-serif}}
main{{max-width:1080px;margin:auto;padding:36px 24px}}h1{{font-size:clamp(28px,5vw,44px);line-height:1.15}}
h2{{font-size:22px}}small,.muted{{color:#a5b2c9}}a{{color:#86baff}}section{{background:#1a2231;padding:22px;border-radius:12px;margin:22px 0}}
.tag{{color:#72ddc0;letter-spacing:.1em}}.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}}
.card{{background:#1a2231;padding:20px;border-radius:12px}}.card strong{{display:block;font-size:32px}}
.scroll{{overflow-x:auto}}table{{border-collapse:collapse;width:100%;white-space:nowrap}}th,td{{padding:10px;text-align:left;border-bottom:1px solid #334054}}
.month{{display:grid;grid-template-columns:76px 1fr 55px 85px;gap:12px;align-items:center;margin:9px 0}}
.track{{background:#293549;height:15px;border-radius:4px}}.bar{{height:100%;background:#66cdb5;border-radius:4px}}
.note{{border-left:3px solid #dfb969;padding-left:16px}}footer{{margin:30px 0;color:#a5b2c9}}
@media(max-width:560px){{main{{padding:20px 12px}}section{{padding:14px}}.month{{grid-template-columns:70px 1fr 48px;gap:6px}}.month small{{display:none}}}}
</style><main>
<p class="tag">FXCM BID · GBPUSD · STAND 22.09.2026</p>
<h1>Ein weiteres Jahr<br>für die Setup-Auswertung.</h1>
<p class="muted">08.01.–31.12.2025 und 05.01.–21.09.2026. Gleiche Erkennung, einheitlicher Feed.
Simulierte Setups; keine Journal-Einträge erzeugt.</p>
<div class="cards"><div class="card"><strong>{format(len(rows), ',').replace(',', '.')}</strong>Setups insgesamt</div>
<div class="card"><strong>{format(years['2025'], ',').replace(',', '.')}</strong>aus 2025 ergänzt</div>
<div class="card"><strong>{quote(rows, 15):.0f} %</strong>15 Pips vor Invalidierung</div>
<div class="card"><strong>{major + medium}</strong>Sweeps ab 24 Handelsstunden</div></div>
<section><h2>Reichweite vor Invalidierung</h2>{table(rows)}
<p class="muted">Gemessen ab der nahen OB-Kante, maximal 24 Stunden. Diese Pip-Quoten sind
von der R-Leiter mit auf 6 Pips gedeckeltem Stopp zu unterscheiden.</p></section>
{year_cards}
<section><h2>15 Pips: die einzelnen Monate</h2><p class="muted">Balken auf einer Skala von 0 bis 100 %.
Januar 2025 beginnt nach sieben Tagen Warmup, September 2026 ist unvollständig.</p>{''.join(monthly)}</section>
<section><h2>Archiv und Grenzen</h2><p>2025: {archive['GBPUSD']} GBPUSD- und {archive['EURUSD']} EURUSD-M5-Kerzen.
Alle zwölf Monate vorhanden; jede archivierte H1-Stunde hat M5-Daten. H1/H4 reichen bis Juni 2024 zurück.</p>
<p class="note">{major} Major- und {medium} Medium-Sweeps bleiben kleine, abhängige Gruppen. Die größere
Stichprobe belegt keine allgemeine Überlegenheit einer Klasse. Die Auswertung enthält weder
Spread noch Slippage oder Gebühren und ist keine gemessene Rendite realer Trades.</p></section>
<footer><p><a href="README.md">Methodik und Einordnung</a> · <a href="fxcm-abdeckung-2025.json">Abdeckungsprüfung</a></p>
<p>Vollständige Tabellen: {links}</p></footer></main></html>"""
(ROOT / "auswertung.html").write_text(html, encoding="utf-8")
print(f"auswertung.html: {len(rows)} Setups, {len(monthly)} Monate")
