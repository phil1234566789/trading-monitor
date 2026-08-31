---
name: handbuch-check
description: Konsistenz-Check VOR jeder geplanten Änderung an einer .md-Datei im trading-Repo (Handbuch/Trading-Steps) - prueft Ablage-Ort (Konzeptkapitel vs. operative Step-Datei), Duplikate, Glossar-Konsistenz und Querverweise, BEVOR die Edit/Write-Ausführung erfolgt. Aufrufen, sobald die geplante Änderung (Zieldatei + Inhalt) feststeht, aber bevor der Edit/Write-Tool-Call abgeschickt wird - Vorbeugung, nicht Nachbereitung.
---

# Handbuch-Check

Pre-Flight-Check für geplante Änderungen am `trading`-Repo-Handbuch (00-trading-steps/,
kontext-analyse.md, kontext-ausführung.md, glossar.md, marktstruktur.md, etc.) — läuft BEVOR die
Änderung geschrieben wird, nicht danach. Philip, 18.08.2026, explizit dazu: "ich dachte der skill
wird VOR dem Ändern einer Datei ausgeführt" — genau das ist der Punkt, an dem am selben Tag zweimal
etwas durchgerutscht wäre, hätte dieser Check schon existiert (Anti-Confluence-Regel wäre fast in
kontext-ausführung.md gelandet statt in der schon existierenden 06-anti-confluence.md;
Glossar-Eintrag "Confluence" wäre unter Fibonacci gelandet statt bei Trade-Setups).

## Wann aufrufen

Sobald feststeht, WAS geschrieben werden soll (Zieldatei + Inhalt/Formulierung), aber BEVOR der
Edit/Write-Tool-Call dafür abgeschickt wird. Der `handbuch-check-reminder`-Hook (`PreToolUse` auf
`Write|Edit`, siehe `.claude/settings.local.json`) erinnert daran im letztmöglichen Moment — spätestens
dann, aber idealerweise schon vorher, sobald die Änderung gedanklich feststeht. Gilt für JEDE
Doku-Änderung in diesem Repo, nicht nur für die offensichtlich großen.

## Prüfpunkte

Alle Punkte beziehen sich auf die GEPLANTE Änderung (bevor sie geschrieben wird), nicht auf einen
bereits vorliegenden Diff:

1. **Konzept vs. operative Step-Datei — richtiger Ort?**
   - Konzeptkapitel (`kontext-analyse.md` = Bias-Phase, `kontext-ausführung.md` = Ausführungsphase,
     `marktstruktur.md`, `liquidität.md`, `orderblöcke.md`, ...) definieren Begriffe/Regeln knapp,
     mit Beispiel — sie sind NICHT der Ort für die volle operative Checkliste eines Trading-Steps,
     sobald dafür schon eine eigene Datei unter `00-trading-steps/NN-name/NN-name.md` existiert.
   - **Bevor in ein Konzeptkapitel geschrieben wird: `Glob 00-trading-steps/**/*.md` (oder gezielt
     `00-trading-steps.md` lesen), ob es für das gerade behandelte Thema schon einen eigenen,
     final nummerierten Step gibt.** Wenn ja: die operative Regel (WENN/DANN, Beispiel,
     Bug-Beispiel, Pin-Anweisungen) gehört DORTHIN, das Konzeptkapitel bekommt nur eine kurze
     Definition + Link zurück in die Step-Datei — nicht umgekehrt.
   - Prüfen, ob `00-trading-steps.md`s eigener Verweis für den betroffenen Schritt tatsächlich auf
     diese Step-Datei zeigt (nicht auf ein Konzeptkapitel, siehe Bug-Beispiel 18.08.2026: Schritt 6
     verwies auf `kontext-ausführung.md` statt auf die längst existierende `06-anti-confluence.md`).

2. **Duplikate.** Vor dem Schreiben `Grep` nach der Kernaussage (Stichwort/Fachbegriff), die gleich
   ergänzt werden soll, über das ganze Repo laufen lassen — existiert diese Regel/Definition schon an
   anderer Stelle in voller Länge? Dann dort belassen, hier nur kurze Definition + Link setzen, statt
   ein zweites Mal die volle Regel auszuschreiben.

3. **Glossar-Konsistenz (`glossar.md`).** Wird ein neuer Fachbegriff eingeführt oder eine bestehende
   Definition erweitert: existiert dafür schon eine Zeile? In welcher Tabellensektion würde sie
   stehen (Allgemein/Marktstruktur/Liquidität/Orderblöcke/EMA/Fibonacci/Trade-Setups)? Die Sektion
   muss zum ALLGEMEINEN Begriff passen, nicht zu der Datei, in der er zuerst auffiel (Bug-Beispiel:
   Confluence ist ein allgemeiner Trade-Setup-Begriff, wäre aber fast nur als Fibonacci-Spezialfall
   einsortiert worden).

4. **Querverweise.** Wird ein Begriff umbenannt, verschoben oder eine neue Definition ergänzt: vorab
   prüfen (`Grep`), welche bestehenden Links/Erwähnungen dieses Begriffs im Repo danach angepasst
   werden müssten, und das gleich mit einplanen statt in einem zweiten Anlauf nachzuziehen.

5. **Pin-Pflicht mitdenken, falls einschlägig.** Betrifft die geplante Änderung Bestätigung/
   Invalidation/Targets/"warten bis"-Level eines Trading-Steps: wird die Pin-Pflicht-Regel (siehe
   [00-trading-steps.md → Visuelle Antworten](../../../trading/00-trading-steps/00-trading-steps.md#visuelle-antworten-chart-annotationen))
   korrekt referenziert, nicht nur implizit vorausgesetzt?

6. **Kein "Bug-Beispiel DATUM (...)" in unconditional geladenen Dateien.** `00-trading-steps/**`,
   `glossar.md` und alle anderen bei jedem Schritt automatisch geladenen Handbuch-Dateien bleiben
   knapp und operativ — nur WAS gilt, nicht WARUM/seit wann/welches Zitat dazu führte (globales
   CLAUDE.md, Abschnitt "Ladekosten"). Ein neuer Regel-Satz reicht meist mit EINEM knappen Halbsatz
   ohne Datum/Zitat aus, notfalls „(Bug-Beispiel: ...)" in maximal 1 Zeile — kein mehrzeiliger
   Absatz mit Datum, Preisen, wörtlichem Zitat und Ableitungs-Historie. Diese Historie gehört
   stattdessen ins Auto-Memory (`project_*`/`feedback_*`-Eintrag) oder in eine Commit-Message, NICHT
   in die Datei selbst. Vor dem Schreiben prüfen: „Braucht der Leser das JEDES Mal, wenn er diese
   Datei lädt, oder nur historisch interessant?" — Zweiteres raus. Philip, 31.08.2026, nachdem an
   einem Tag mehrere solcher Bug-Beispiel-Absätze in 00-trading-steps/*.md und orderblöcke.md
   gelandet waren: „lass diese legacy scheiße! ist alles nur Vermüllung unserer docs!"

## Ergebnis

Kurz im Chat vermerken, was geprüft wurde und was das für die geplante Änderung bedeutet ("Handbuch-
Check: gehört nach X statt Y, schreibe dort hin" oder "Handbuch-Check: keine Probleme, wie geplant
schreiben") — bevor der eigentliche Edit/Write-Call folgt, damit sichtbar ist, dass der Schritt
tatsächlich lief statt übersprungen wurde.
