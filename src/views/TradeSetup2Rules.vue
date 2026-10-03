<template>
  <main class="rules-page">
    <header>
      <p class="eyebrow">Milky Way · Regelprüfung</p>
      <h1>Trade Setup 2.0</h1>
      <p class="lead">Countertrend · Bestätigung nach A bis E, Validierung über F.</p>
      <p class="review-state"><strong>Entwurf · gemeinsame Absegnung offen</strong><br />Diskussionsstand vom <time datetime="2026-10-03">03.10.2026</time>. Von Philip festgelegt, zur gemeinsamen Prüfung mit seinem Trading-Partner.</p>
      <p>Die <strong>Fachregeln</strong> beschreiben die Festlegungen. Der <strong>Implementierungsstand</strong> zeigt den technischen Stand laut Regelentwurf. <strong>Offene Entscheidungen</strong> sind noch gemeinsam festzulegen.</p>
      <p><RouterLink to="/setup-regeln">Direktlink zu dieser Regelübersicht</RouterLink> · Diesen Seitenlink könnt ihr für eure gemeinsame Prüfung teilen.</p>
    </header>

    <section id="abcd" aria-labelledby="abcd-title">
      <h2 id="abcd-title">Countertrend · DR-Stufen</h2>
      <dl class="criteria">
        <div><dt>A · Liquidity Sweep</dt><dd>Ein erkanntes Setup 1.0 liegt vor: Sweep, Protected-M5-Fraktal und zugehöriger M5-Orderblock. Kein H1-Alterskriterium.</dd></div>
        <div><dt>B · Reaktion</dt><dd>Vorerst der zugehörige M5-Orderblock aus Setup 1.0. Eine Verbesserung der Reaktionsprüfung folgt erst nach der Jahresstatistik.</dd></div>
        <div><dt>C · M5-Trend (äußerster)</dt><dd>Der äußerste M5-Trend ab dem bekannten D1-Fraktal der Periode 4 ersetzt den H1-Trend. C muss in Setup-Richtung zeigen. Bei Gegenrichtung oder unbekanntem Trend wird abgebrochen, ohne D auszuwerten.</dd></div>
        <div><dt>D · M5-Trend (aktuell)</dt><dd>Die tiefste bestätigte M5-Strukturebene zum Erkennungszeitpunkt bestimmt den aktuellen Trend. Unbestätigte Nested-Kandidaten zählen nicht; ohne bestätigten Nested-Trend gilt der äußere Trend.</dd></div>
        <div><dt>E · Targets</dt><dd>Die bestehende Target-Auswahl bleibt erhalten. Targets gefunden bestätigt die DR; ohne Targets bleibt sie unbestätigt.</dd></div>
        <div><dt>F · Anti-Confluences</dt><dd>Jede Regel speichert ihren Fundstatus und ihre Belege. Der Schalter „invalidates“ bestimmt, ob ein Fund die DR invalidiert oder nur beobachtet wird. Zum Start ist ausschließlich die H1-RSI-Gegendivergenz eingeschaltet: bullisch bei Short, bärisch bei Long. Ohne Fund ist die DR validiert; bei fehlenden Daten bleibt die Validierung offen.</dd></div>
        <div><dt>G · Confluences</dt><dd>Beobachtungen für die Statistik; ändern die DR-Stufe nicht.</dd></div>
        <div><dt>H · Entry finden</dt><dd>Entry-Modell 1 benötigt M5-CHoCH und M1-BOS in Setup-Richtung, den Retest eines passenden M5-OB und anschließend eine bestätigte gleichgerichtete M1-FVG. Der Entry liegt am Schluss ihrer Bestätigungskerze. Die Reihenfolge von CHoCH und BOS ist frei; M1-Trendrichtung und M1-CHoCH bleiben Kontext. Handelszeiten, Session- und News-Sperren prüft das zentrale Gate unmittelbar vor jedem Entry.</dd></div>
      </dl>
      <p><strong>Countertrend:</strong> C zeigt in Setup-Richtung und D dagegen. A bis E erfüllt bestätigt die Dealing Range; F entscheidet validiert oder invalidiert. Ein CHoCH ist dafür keine Bedingung. Die bestehende Preisinvalidierung bleibt wirksam.</p>
      <p><strong>Trendfortführung:</strong> C und D zeigen in Setup-Richtung. Der Typ wird erkannt, der Pfad bricht mit „Typ Trendfortführung, noch nicht umgesetzt“ ab.</p>
      <p><strong>Abbruch:</strong> C zeigt gegen die Setup-Richtung oder ist unbekannt. Grund: „äußerster M5-Trend gegen Setup-Richtung“ beziehungsweise „M5-Trend unbekannt“.</p>
      <p>C und D werden am Bekannt-Zeitpunkt des Setups mit den bis dahin geschlossenen Kerzen ausgewertet. Spätere Replay-Kerzen ändern diese Typ-Prüfung nicht.</p>
      <p>Für den Retest zählen gleichgerichtete M5-OBs, die ab der DR-Bestätigung nach A bis E entstehen, auch zwischen Bestätigung und Validierung. Als ausdrücklich benannte Startregel zählt der OB aus Setup 1.0 ebenfalls. Jede Entry-Möglichkeit speichert die vier Belege samt Zeitpunkten und dem geretesteten OB. Nach T1 oder dem Lifecycle-Ende entstehen keine neuen Entries.</p>
      <p>Größe und Exit bleiben erhalten: 250 oder 500 USD Risiko, ganze Lots, 5 USD Roundturn-Kommission je begonnenem Lot, halber Exit bei T1, danach BE für den Rest bis T2. Weil der M5-CHoCH im neuen Modell Pflicht ist, liefert die bestehende Größenlogik hier den vollen Faktor; die alte Halbierungsregel bleibt im Altmodell.</p>
      <aside class="open-decision"><h3>Nächste Festlegungen offen</h3><p>Short 97 und 105 sind Countertrend-Referenzen. Der äußerste M5-Trend ist Pflicht. Die Trendfortführung folgt später.</p><p>Die Target-Auswahl und die Erkennung der H1-Gegendivergenz bleiben unverändert. Weitere Anti-Confluence-Regeln werden separat festgelegt; die Regelliste ermöglicht zunächst reine Beobachtung.</p></aside>
    </section>

    <details class="countertrend-rules">
      <summary>Countertrend · bisheriger Ablauf und historische Regeln</summary>
      <p>Der bisherige Ablauf bleibt erhalten. Seine folgende A–G-Zuordnung und Entry-Regeln gehören zum alten Countertrend-Modell, nicht zur neuen A–D-Checkliste.</p>

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
      <p class="section-note">Implementierter Iststand · Entry 1</p>
      <p>Entry 1 benötigt eine validierte, noch aktive DR, keine bekannte F-Sperre, einen eindeutigen M5-Anker und eine bestimmbare M1-P5-Struktur mit geschlossenen Kerzen.</p>
      <p>Danach gilt: <strong>Retest desselben C-M5-Orderblocks → erste bestätigte gleichgerichtete M1-FVG nach der Retestkerze → Entry am Schluss der FVG-Bestätigungskerze.</strong> Setupidentität, Richtung, DR-Validierung und F werden am Entry-Zeitpunkt erneut geprüft.</p>
      <p><strong>M1-Richtung, M1-CHoCH und M1-BOS sind aktuell keine Pflichtgates.</strong> Ihre Checklist-Haken zeigen Merkmale. Eine bestimmbare M1-Struktur ist erforderlich, ihre Richtung muss nicht gleichgerichtet sein. M5-BOS ist ebenfalls kein Pflichtgate.</p>
      <p>Gegen den M5-Trend ist ein bestätigter M5-CHoCH in Traderichtung Pflicht. Bei erlaubten Entries bestimmt er zusätzlich die Größe:</p>
      <dl class="criteria">
        <div><dt>Halbe Entry-Größe</dt><dd>M5 bereits gleichgerichtet, aber noch kein bestätigter M5-CHoCH in Traderichtung.</dd></div>
        <div><dt>Volle Entry-Größe</dt><dd>Ein bestätigter M5-CHoCH in Traderichtung ist vorhanden.</dd></div>
      </dl>
      <p><strong>M5-BOS ist keine zusätzlich festgelegte Pflicht.</strong> Für beide Größenvarianten gelten die übrigen Entry-Bedingungen einschließlich der globalen Uhrzeitregel unter F.</p>
      <p><strong>M1 zeigt die aktuell aktive bestätigte Strukturrichtung.</strong> Ein aktiver Nested-Trend ersetzt die äußere Richtung. Bei der Übernahme zum Outer-Trend bleibt die Richtung konsistent. Äußere Ebenen werden als neutraler Kontext angezeigt. Die M1-Richtung ist kein zusätzliches Entry-Gate.</p>
      <details><summary>Einordnung des besprochenen Short-Beispiels</summary><p>Der Screenshot zeigt einen bullischen M5-Trend und unbestätigten M5-CHoCH/BOS. Nach der aktuellen Regel erhält dieser gegenläufige Fall ohne bestätigten M5-CHoCH keinen Entry. Sichtbar sind außerdem ein M1 Nested Downtrend, bärischer M1-CHoCH/BOS, ein M5-OB-Retest und eine nachfolgende bärische FVG.</p><p>Aus diesen sichtbaren M1-Merkmalen werden ohne weitere Festlegung keine zusätzlichen Pflichtbedingungen abgeleitet.</p></details>
      <aside class="implementation"><h3>Implementierungsstand</h3><p>Für neue gespeicherte Entries wird der M5-CHoCH am Entry-Zeitpunkt geprüft und die Größe eingefroren. Halbe Größe bedeutet 250 USD, volle Größe 500 USD Preisrisikobudget vor Lot-Abrundung. Kommission und Ergebnisse folgen dem tatsächlichen Volumen. Der Septemberlauf verwendet diese Regeln.</p></aside>
      <aside class="open-decision"><h3>Implementiert · M5-Gegenrichtung</h3><p><strong>Bei einem Entry gegen den M5-Trend muss ein bestätigter M5-CHoCH in Traderichtung vorhanden sein. Fehlt er, gibt es keinen Entry.</strong> Long und Short werden spiegelbildlich behandelt. Für diesen Fall ersetzt die neue Pflicht die bisherige halbe Größe ohne CHoCH. Der bereits gleichgerichtete M5-Fall erhält dadurch keine neue Regel.</p></aside>
      <aside class="open-decision"><h3>Implementiert · kausale C-Reaktion</h3><p>Die erstmalige OB-Erkennung am Schluss der FVG-Bestätigungskerze wird getrennt von der späteren Sweep-Zuordnung angezeigt. Die FVG-Bildungskerze muss strikt nach dem konkreten M5-Sweep-Touch aus B liegen; die Impulskerze und der Bestätigungsschluss bleiben eigene Zeitpunkte.</p></aside>
    </section>

    <section id="zeit" aria-labelledby="zeit-title">
      <h2 id="zeit-title">F · Uhrzeit als Pflicht für alle Entries</h2>
      <p class="section-note">Fachregel · gilt für jedes Entry-Modell</p>
      <p><strong>Ist die Uhrzeit nach den bestehenden F-Checklistregeln nicht erlaubt, gibt es keinen Entry.</strong></p>
      <p>Das ist eine Entry-Sperre. Sie ist kein zusätzliches Gate der DR-Validierung und keine dauerhafte Invalidierung der Marktidee.</p>
      <aside class="implementation"><h3>Implementierungsstand</h3><p>Die Uhrzeitregeln unter F sind bereits implementiert. Bekannte Zeit-/News-Sperren blockieren im aktuellen Code. Unbekannte News-Abdeckung wird aktuell nicht automatisch gesperrt.</p></aside>
      <aside class="implementation"><h3>Handelszeiten vor der Scannerbewertung</h3><p>Neue Scannerläufe prüfen die gespeicherten Handelsfenster des Instruments in Europe/Berlin vor der H1-/M5-/M1-Setup-Suche. Außerhalb entstehen keine neuen Bewertungsstände. Die vollständige Kerzenhistorie bleibt für die nächste erlaubte Bewertung erhalten. Fehlende oder ungültige historische Handelsfenster führen zu einer Konfigurationsdiagnose.</p><p>Verläufe bereits gespeicherter DRs und Entries werden weiterhin über das gesamte Auswertungsfenster verfolgt. Ein Target-, Invalidierungs- oder Exit-Ereignis außerhalb der Handelszeiten erhält seinen echten Ereigniszeitpunkt und ersetzt keinen erlaubten Checklist-Bewertungsstand.</p></aside>
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
    </details>
    <footer>Bestehende Läufe behalten ihre gespeicherten Stufen. Die neue Countertrend-Version bestätigt A bis E und validiert über F. Diese Seite startet keinen Scan.</footer>
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
