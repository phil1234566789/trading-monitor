<template>
  <main class="rules-page">
    <header>
      <p class="eyebrow">Milky Way · Regelprüfung</p>
      <h1>Trade Setup 2.0</h1>
      <p class="lead">Von der bestätigten Dealing Range zur Entry-Freigabe.</p>
      <p class="review-state"><strong>Entwurf · gemeinsame Absegnung offen</strong><br />Diskussionsstand vom <time datetime="2026-10-02">02.10.2026</time>. Von Philip festgelegt, zur gemeinsamen Prüfung mit seinem Trading-Partner.</p>
      <p>Die <strong>Fachregeln</strong> beschreiben die Festlegungen. Der <strong>Implementierungsstand</strong> zeigt den technischen Stand laut Regelentwurf. <strong>Offene Entscheidungen</strong> sind noch gemeinsam festzulegen.</p>
      <p><RouterLink to="/setup-regeln">Direktlink zu dieser Regelübersicht</RouterLink> · Diesen Seitenlink könnt ihr für eure gemeinsame Prüfung teilen.</p>
    </header>

    <nav class="contents" aria-label="Abschnitte der Regelübersicht">
      <RouterLink to="/setup-regeln#stufen">Stufenübersicht</RouterLink>
      <RouterLink to="/setup-regeln#abc">A–C · Bestätigung</RouterLink>
      <RouterLink to="/setup-regeln#validierung">D–E · Validierung</RouterLink>
      <RouterLink to="/setup-regeln#anti-confluences">E · Anti-Confluences</RouterLink>
      <RouterLink to="/setup-regeln#entry">Entry · Größenvarianten</RouterLink>
      <RouterLink to="/setup-regeln#zeit">F · Uhrzeit für alle Entries</RouterLink>
      <RouterLink to="/setup-regeln#confluences">G · Statistik</RouterLink>
      <RouterLink to="/setup-regeln#offen">Offene Entscheidungen</RouterLink>
    </nav>

    <section id="stufen" aria-labelledby="stufen-title">
      <h2 id="stufen-title">Die Stufen im Überblick</h2>
      <p class="section-note">Fachliche Festlegung · neue Läufe speichern die DR-Stufe mit eigener Regelversion.</p>
      <div class="table-scroll" tabindex="0" aria-label="Stufenübersicht horizontal scrollen">
        <table>
          <caption>Bestätigung, Validierung und Entry-Freigabe werden getrennt geprüft.</caption>
          <thead><tr><th scope="col">Stufe</th><th scope="col">Bedingung</th><th scope="col">Anzeige und Statistik</th><th scope="col">Entry</th></tr></thead>
          <tbody>
            <tr><th scope="row">Unbestätigte Dealing Range</th><td>A, B und C sind nicht vollständig erfüllt; eine Bedingung fehlt oder ist unbekannt.</td><td>Gilt nicht als Trade Setup 2.0. Keine Aufnahme in Setupübersicht oder Setup-2.0-Statistik.</td><td>Weitere Entry-Prüfung bricht ab.</td></tr>
            <tr><th scope="row">Bestätigte Dealing Range</th><td>A, B und C sind erfüllt.</td><td>Als Setup erkannt und in die Statistik aufnehmen, auch ohne Entry.</td><td>Bestätigung allein ist keine Entry-Freigabe.</td></tr>
            <tr><th scope="row">Validierte Dealing Range</th><td>Zusätzlich zu ABC: Targets unter D bestimmbar und keine verbindlichen E-Showstopper.</td><td>Bestätigte Range mit bestandener Validierung.</td><td>Entry-Freigabe folgt als separate Prüfung.</td></tr>
            <tr><th scope="row">Invalidierte Dealing Range</th><td>Bestätigte Range scheitert an der Validierung: Targets nicht bestimmbar oder ein verbindlich definierter E-Showstopper liegt vor.</td><td>Für Statistik und Diagnose sichtbar lassen, mit dem Grund.</td><td>Keine Entry-Freigabe.</td></tr>
          </tbody>
        </table>
      </div>
      <p><strong>Ungeprüft bleibt offen.</strong> Noch nicht geprüfte Validierungsbedingungen sind kein bestätigtes Scheitern. Aktuell gibt es unter E ausdrücklich keine Showstopper.</p>
      <p>„Invalidiert“ bezeichnet hier das Ergebnis der Validierung. Ein späteres Ende der Marktidee durch T1 oder Preisinvalidierung wird separat betrachtet.</p>
    </section>

    <section id="abc" aria-labelledby="abc-title">
      <h2 id="abc-title">A–C · Bestätigte Dealing Ranges</h2>
      <p class="section-note">Fachregel</p>
      <p>Das aktuelle ABC-Inducement-Setup heißt <strong>DR gegen M5 Trend</strong>. Der Name bezeichnet dieses Setupmodell; „bestätigt“ und „validiert“ bleiben die allgemeinen Statusstufen.</p>
      <p>Das unten beschriebene Entry-Pattern mit seinen zwei Größenvarianten gilt ausschließlich für <strong>DR gegen M5 Trend</strong>.</p>
      <dl class="criteria">
        <div><dt>A · H1-Richtung</dt><dd>Die tiefste aktuell bestätigte H1-Strukturebene bestimmt die Handelsrichtung. Unbestätigte Nested-Kandidaten zählen nicht. Ohne bestätigte Nested-Ebene gilt der Outer-Trend; äußere Ebenen bleiben Kontext. Die Übernahme zum Outer ändert die Richtung nicht.</dd></div>
        <div><dt>B · Inducement</dt><dd>Aktuell werden Major- und Medium-H1-Inducements berücksichtigt. Kleinere LS erhalten später eigene Regeln.</dd></div>
        <div><dt>C · Reaktion</dt><dd>Das Inducement aus B zeigt eine akzeptable Reaktion. Aktuell bestätigt ein diesem Sweep zugeordneter M5-Orderblock die Reaktion; andere Reaktionsmodelle können später ergänzt werden.</dd></div>
      </dl>
      <p><strong>Alle drei Bedingungen müssen erfüllt sein.</strong> Damit ist das Setup erkannt und soll auch ohne Entry in die Statistik aufgenommen werden. Fehlt eine Bedingung oder ist sie unbekannt, bricht die weitere Entry-Prüfung ab.</p>
      <p>Der M5-Trend kann beim Retracement gegenläufig sein. Eine spätere Drehung in Traderichtung nimmt die A/B-Bestätigung nicht zurück. Eine zwingende Gegenläufigkeit ist kein zusätzlich beschlossenes Gate.</p>
      <aside class="implementation"><h3>Implementierungsstand</h3><p>Neue Läufe speichern nur vollständig bestätigte ABC-Ranges als Trade Setup 2.0. Die Statistik bietet Filter für validierte, invalidierte und bestätigte Ranges mit offener Validierung. Altstände bleiben mit ihren ursprünglichen Belegen separat zugänglich.</p></aside>
    </section>

    <section id="validierung" aria-labelledby="validierung-title">
      <h2 id="validierung-title">D–E · Validierte Dealing Ranges</h2>
      <p class="section-note">Fachregel</p>
      <p>Zusätzlich zu ABC müssen die Targets unter <strong>D bestimmbar</strong> sein und unter <strong>E dürfen keine Showstopper</strong> vorliegen. Diese Stufe bleibt von der anschließenden Entry-Freigabe getrennt.</p>
      <p><strong>Exakte Validierungsregel:</strong> Bestätigte Dealing Range (ABC erfüllt) + D erfüllt (Targets vorhanden) + keine Showstopper in E = valide Dealing Range. Weitere Checklistpunkte sind keine zusätzlichen Bedingungen dieser Validierungsstufe.</p>
      <p>Fehlende Targets müssen an der bestätigten Dealing Range sichtbar bleiben, einschließlich des Grunds. So lassen sich mögliche Algorithmusfehler prüfen.</p>
      <p>Erfüllt eine bestätigte Range die Validierungsbedingungen nicht, ist sie invalidiert und erhält keine Entry-Freigabe. Sie bleibt für Diagnose und Statistik sichtbar.</p>
      <aside class="implementation"><h3>Implementierungsstand</h3><p>D entscheidet in der neuen Version über die Validierung. Ein gefundenes T1 genügt; T2 bleibt optional. Eine erfolgte Zielsuche ohne zulässiges Target invalidiert die Range mit Diagnosegrund. Fehlende Prüfdaten lassen die Validierung offen. Neue Entries setzen eine validierte Range voraus.</p></aside>
    </section>

    <section id="anti-confluences" aria-labelledby="anti-title">
      <h2 id="anti-title">E · Anti-Confluences</h2>
      <p class="section-note">Implementierungsstand · aktuell erfasste Merkmale</p>
      <ul class="evidence-list">
        <li><strong>H1-RSI-Divergenzen gegen die Traderichtung.</strong> Vorhanden wird als Warnung, fehlend als grün und fehlende Daten als unbekannt dargestellt.</li>
        <li><strong>Gegenläufige Inducements am exakten T2-Pivot.</strong> Pivotzuordnung und Altersvergleich sind vorhanden; der Stärkevergleich ist offen.</li>
        <li><strong>Gegenläufige H1-/M5-Orderblocks mit Preisüberlappung am T2.</strong> Sie werden berücksichtigt, wenn kein passendes Gegeninducement gefunden wurde. Die Ursächlichkeit der Gegenreaktion ist nicht bestätigt.</li>
      </ul>
      <aside class="implementation"><h3>Aktuelle Festlegung · keine Showstopper</h3><p>E-Merkmale werden für die spätere statistische Auswertung gespeichert. Sie sperren aktuell weder die Validierung noch den Entry. Erst nach Auswertung der Gesamtstatistik wird entschieden, ob daraus Showstopper werden.</p><p><strong>Grün unter E bedeutet nur:</strong> Es wurde keine H1-Gegendivergenz gefunden.</p></aside>
    </section>

    <section id="entry" aria-labelledby="entry-title">
      <h2 id="entry-title">Entry für DR gegen M5 Trend</h2>
      <p class="section-note">Fachregel · zwei Größenvarianten für dieses Modell</p>
      <p>Philip ordnet das vorhandene Entry-Pattern anhand der Checklist-Ansicht dem Modell <strong>DR gegen M5 Trend</strong> zu. Der bestätigte M5-CHoCH in Traderichtung bestimmt die Entry-Größe:</p>
      <dl class="criteria">
        <div><dt>Halbe Entry-Größe</dt><dd>Noch kein bestätigter M5-CHoCH in Traderichtung. Diese Variante gilt als riskanter.</dd></div>
        <div><dt>Volle Entry-Größe</dt><dd>Ein bestätigter M5-CHoCH in Traderichtung ist vorhanden.</dd></div>
      </dl>
      <p><strong>M5-BOS ist keine zusätzlich festgelegte Pflicht.</strong> Für beide Größenvarianten gelten die übrigen Entry-Bedingungen einschließlich der globalen Uhrzeitregel unter F.</p>
      <p><strong>M1 zeigt die aktuell aktive bestätigte Strukturrichtung.</strong> Ein aktiver Nested-Trend ersetzt die äußere Richtung. Bei der Übernahme zum Outer-Trend bleibt die Richtung konsistent. Äußere Ebenen werden als neutraler Kontext angezeigt. Die M1-Richtung ist kein zusätzliches Entry-Gate.</p>
      <details><summary>Einordnung des besprochenen Short-Beispiels</summary><p>Der Screenshot zeigt einen bullischen M5-Trend und unbestätigten M5-CHoCH/BOS. Diese Variante erhält halbe Größe. Sichtbar sind außerdem ein M1 Nested Downtrend, bärischer M1-CHoCH/BOS, ein M5-OB-Retest und eine nachfolgende bärische FVG.</p><p>Aus diesen sichtbaren M1-Merkmalen werden ohne weitere Festlegung keine zusätzlichen Pflichtbedingungen abgeleitet.</p></details>
      <aside class="implementation"><h3>Implementierungsstand</h3><p>Für neue gespeicherte Entries wird der M5-CHoCH am Entry-Zeitpunkt geprüft und die Größe eingefroren. Halbe Größe bedeutet 250 USD, volle Größe 500 USD Preisrisikobudget vor Lot-Abrundung. Kommission und Ergebnisse folgen dem tatsächlichen Volumen. Bestehende Ergebnisläufe bleiben unverändert.</p></aside>
    </section>

    <section id="zeit" aria-labelledby="zeit-title">
      <h2 id="zeit-title">F · Uhrzeit als Pflicht für alle Entries</h2>
      <p class="section-note">Fachregel · gilt für jedes Entry-Modell</p>
      <p><strong>Ist die Uhrzeit nach den bestehenden F-Checklistregeln nicht erlaubt, gibt es keinen Entry.</strong></p>
      <p>Das ist eine Entry-Sperre. Sie ist kein zusätzliches Gate der DR-Validierung und keine dauerhafte Invalidierung der Marktidee.</p>
      <aside class="implementation"><h3>Implementierungsstand</h3><p>Die Uhrzeitregeln unter F sind bereits implementiert. Bekannte Zeit-/News-Sperren blockieren im aktuellen Code. Unbekannte News-Abdeckung wird aktuell nicht automatisch gesperrt.</p></aside>
      <aside class="open-decision"><h3>Offene Entscheidung · unbekannte F-Ergebnisse</h3><p>Wie unbekannte F-Ergebnisse künftig behandelt werden, ist noch ausdrücklich zu klären.</p></aside>
    </section>

    <section id="confluences" aria-labelledby="confluences-title">
      <h2 id="confluences-title">G · Zusätzliche Confluences</h2>
      <p class="section-note">Fachregel · ausschließlich Statistik</p>
      <p>Später soll untersucht werden, ob zusätzliche Confluences die Winrate beeinflussen. Vorerst beeinflussen sie <strong>weder Validierung noch Entry-Freigabe</strong>.</p>
    </section>

    <section id="offen" class="decisions" aria-labelledby="offen-title">
      <h2 id="offen-title">Noch gemeinsam festzulegen</h2>
      <ol><li>Nach Auswertung der Gesamtstatistik: mögliche künftige Showstopper unter E.</li><li>Weitere Entry-Modelle und ihre Bedingungen.</li><li>Umgang mit unbekannten F-Ergebnissen, insbesondere unbekannter News-Abdeckung.</li><li>Eigene Regeln für kleinere LS.</li></ol>
      <p>Die gemeinsame Prüfung und Absegnung dieses Entwurfs steht aus.</p>
    </section>
    <footer>Bestehende Jahresläufe werden durch diese Diskussion nicht verändert. Diese Seite dokumentiert den Regelstand; sie ändert keine Scannerregeln und startet keinen neuen Scan.</footer>
  </main>
</template>

<style scoped>
.rules-page { --rule-muted: #b1b7c5; --rule-border: #434651; --rule-link: #91b8ff; width: 100%; max-width: 1120px; margin: 0 auto; padding: 32px 24px 64px; font-size: 16px; line-height: 1.65; }
h1 { margin: 0; font-size: clamp(28px, 4vw, 40px); line-height: 1.2; } h2 { margin: 0 0 12px; font-size: 23px; line-height: 1.3; } h3 { margin: 0 0 8px; font-size: 16px; }
p { margin: 12px 0; } .eyebrow, .section-note, footer { color: var(--rule-muted); font-size: 14px; } .lead { font-size: 19px; }
.review-state { padding: 16px; border-left: 3px solid #e7bc77; background: #24232a; } .review-state strong { color: #f0ce94; }
.contents { display: flex; flex-wrap: wrap; gap: 8px 20px; padding: 20px 0; border-bottom: 1px solid var(--rule-border); }
a { color: var(--rule-link); text-underline-offset: 3px; } summary { cursor: pointer; color: var(--rule-link); } :is(a,summary,.table-scroll):focus-visible { outline: 2px solid var(--rule-link); outline-offset: 4px; }
section { padding: 28px 0; border-bottom: 1px solid var(--rule-border); scroll-margin-top: 20px; }
.table-scroll { overflow-x: auto; } table { width: 100%; min-width: 680px; border-collapse: collapse; font-size: 14px; text-align: left; } caption { text-align: left; padding-bottom: 12px; color: var(--rule-muted); }
th, td { padding: 14px 12px; vertical-align: top; border: 1px solid var(--rule-border); } thead { background: #222a3a; } tbody th { min-width: 160px; } tbody tr:nth-child(even) { background: #1a202d; }
.criteria { margin: 0; } .criteria>div { display: grid; grid-template-columns: 180px 1fr; gap: 16px; padding: 12px 0; } dt { font-weight: 650; } dd { margin: 0; }
aside { padding: 16px 20px; margin-top: 20px; border-left: 3px solid var(--rule-border); background: #1a202d; } aside p:last-child { margin-bottom: 0; } .implementation h3 { color: var(--rule-link); } .open-decision { border-color: #e7bc77; } .open-decision h3 { color: #f0ce94; }
li { margin-bottom: 12px; } .evidence-list { padding-left: 24px; } footer { padding-top: 24px; }
@media(max-width:600px) { .rules-page { padding: 24px 16px 40px; } .criteria>div { grid-template-columns: 1fr; gap: 4px; } h2 { font-size: 21px; } aside { padding: 16px; } }
</style>
