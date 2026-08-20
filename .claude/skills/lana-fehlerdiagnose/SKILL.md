---
name: lana-fehlerdiagnose
description: Diagnose-Ablauf für gemeldetes Lana-Fehlverhalten bei 00-trading-steps (live oder Backtest) - benennt anhand der vier AI-Capabilities-Eigenschaften (Next Token Prediction/Knowledge/Working Memory/Steerability), welche kollidiert sind, prueft die Diagnose gegen, und routet zum passenden STRUKTURELLEN Fix statt nur den einen Output zu patchen. Aufrufen, sobald Philip eine enttäuschende/fehlerhafte Lana-Antwort während einer Trading-Analyse meldet (z.B. "das hat nicht gepasst", "du hast X vergessen/übersehen", falscher Wert) - vor der eigentlichen Korrektur, nicht danach.
---

# Lana-Fehlerdiagnose

Hintergrund/volle Kurs-Zusammenfassung: [trading-monitor/docs/steerabilty-vs-wrong-ai-outputs.md](../../../trading-monitor/docs/steerabilty-vs-wrong-ai-outputs.md)
(Anthropic Academy "AI Capabilities and Limitations"). Dieser Skill wendet die dortige
Exercise-Methode ("The Failure Diagnosis") konkret auf gemeldetes Lana-Fehlverhalten bei
`00-trading-steps` an, statt nur den betroffenen Output zu korrigieren.

## Wann aufrufen

Sobald Philip ein Fehlverhalten/eine Enttäuschung bei einer laufenden oder abgeschlossenen
Trading-Analyse meldet — egal ob live oder Backtest. Läuft VOR der eigentlichen Korrektur des
Outputs, nicht als Nachbereitung danach.

## Ablauf

1. **Fall kurz fassen:** was wurde erwartet, was kam tatsächlich raus.
2. **Diagnose:** welche der vier Eigenschaften waren wahrscheinlich im Spiel, und warum? Bekannte
   Diagnose-Paare aus der Lesson (siehe Doku oben für Details):
   - Next Token Prediction + Knowledge → halluzinierte Details.
   - Working Memory + Steerability → Drift in langen Sessions (der häufigste Fall bei uns, siehe
     Doku "Bezug zu unserem Problem").
   - Reasoning Drift (mehrstufige Kette, früher Fehler pflanzt sich fort).
   - Letter-over-Spirit (Anweisung wörtlich befolgt, Zweck verfehlt).
   - Brüchige Arithmetik (native Zahlen-/Logik-Präzision).
3. **Diagnose kritisch gegenprüfen, nicht blind übernehmen** — Sykophantie-Gefahr: die eigene
   Erklärung stimmt der eigenen Rahmung evtl. zu bereitwillig zu. Aktiv nach einer anderen Deutung
   suchen, bevor die erste als Diagnose gilt.
4. **Aus der bestätigten Diagnose den gezielten, STRUKTURELLEN Fix ableiten** — deckt sich mit der
   bestehenden CLAUDE.md-Regel "Korrekturen — Doku/Regel fixen, nicht nur den Output": ein reiner
   Output-Patch (Chart-Zeichnung, Chat-Antwort, State-Datei) ohne begleitenden Fix gilt NICHT als
   erledigt.

## Routing: Diagnose → typischer Fix-Ort

| Diagnose | Typischer Fix |
|---|---|
| Working Memory (Fakt da, aber nicht mehr "in der Nähe") | `trading-runs/.../trade-analysis.state.md`-Struktur prüfen/erweitern, fehlenden Checkpoint ergänzen |
| Steerability, wiederkehrendes Vergessen | Neuer/erweiterter Skill (aktiv geladene Checkliste im richtigen Moment, siehe `dealing-range-anlegen`) statt nur eine Doku-Zeile |
| Steerability, Regel-Konflikt/zu "leise" | `CLAUDE.md`/`l.md`-Regel schärfen oder Reihenfolge/Gewichtung klarstellen |
| Next Token Prediction + Knowledge (Halluzination) | Tool mit Source Grounding (MCP-Tool an echte Quelle binden statt Modell-Wissen) |
| Brüchige Arithmetik | Deterministisches Berechnungs-Tool statt Modell-Rechnen (Beispiel: `calc_rr`-Task) |
| Reasoning Drift | Checkpoint/Zwischenergebnis-Bestätigung in die mehrstufige Kette einbauen |
| Letter-over-Spirit | Ziel (nicht nur die Anweisung) in der betroffenen Regel explizit machen |

## Ergebnis

Wird der Fix nicht sofort umgesetzt: als Task unter dem milk-city-Feature "Steerability-Optimierung"
(Projekt `trading`) festhalten, statt nur im Chat stehen zu lassen. Wird er sofort umgesetzt: kurz
im Chat benennen, welche Diagnose zu welchem Fix geführt hat, bevor die Korrektur selbst folgt.
