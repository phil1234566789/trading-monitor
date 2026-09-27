# Gold M5: Abruf erfolgreich, Feed-Gleichheit nicht bestätigt

24.09.2026. Vor dem autorisierten Gold-Rollout wurde der M5-Feed separat geprüft.
Betriebsweg: [FXCM-Feed](../../docs/fxcm-feed.md), Skill `fxcm-vps-probe`.
H4 wurde auf main veröffentlicht; Gold-Livebetrieb und M5-Datenbankimport noch nicht aktiviert.

## Native Demo-Bid-Daten

6614 geschlossene XAU/USD-M5-Kerzen vom 24.08. bis 24.09.2026, mit August-Vorlauf.
Letzte Kerze 24.09. 22:55 Europe/Berlin. Sortierung, eindeutige Zeitstempel,
OHLC-Invarianten, Schlussfilter und 0,01-USD-Raster sind fehlerfrei.
4961 gemeinsame September-M5-Kerzen mit GBP/USD für den Schwellenvergleich:
Median True Range Gold 4,19 USD, GBP 0,00028. Daraus ergibt sich für das bisherige
0,5-Pip-Minimum ein vorläufiger Wert von 0,75 USD (auf einen Tick aufgerundet).
Dieser Testwert ist keine Bestätigung der Feed-Gleichheit oder Strategieprofitabilität.

## TradingView-Gegenprobe

TradingView-MCP-Symbolsuche löst den FXCM-Goldfeed als `FX:XAUUSD` auf;
`FXCM:XAUUSD` wird von diesem Dienst als ungültiges Symbol abgewiesen.
100 zeitgleiche, geschlossene M5-Kerzen über TradingView-MCP geladen und mit dem
ForexConnect-Demo-Bid-Abruf verglichen. 96 Kerzen unterscheiden sich in mindestens
einem OHLC-Feld um mehr als einen halben Tick; 252 von 400 OHLC-Feldern betroffen.
Maximale absolute Abweichung 3,17 USD.

Mit identischem bestehenden M5-OB-Algorithmus und 0,75 USD Mindest-FVG:
Demo-Bid 13 OBs, TradingView 14 OBs. Ein bärischer OB existiert nur in TradingView;
alle 13 gemeinsamen OB-Schlüssel haben mindestens ein abweichendes Preis-/Statusfeld.
Beide liefern 7 Liquidity-Fraktale mit denselben Zeit-/Richtungsschlüsseln, aber 6
unterscheiden sich in Preis-/Statusfeldern. Das ist keine Aussage über sämtliche
September-Setups; beide Algorithmen wurden hier auf genau derselben 100-Bar-Stichprobe gerechnet.

Zusätzlicher nativer Bid-/Ask-Abruf liefert 69 gemeinsame Bars mit dem TV-Fenster:
Median absolute OHLC-Abweichung Bid 0,02 USD, Ask 0,30 USD, Mittel 0,15 USD.
Bid passt am besten; bloßer Wechsel auf Ask löst den Unterschied nicht.
Das Mittel der Bid-/Ask-OHLC ist kein tickweise rekonstruierter Mid-Chart.
Ursache weiterhin offen: keine belegte Zuschreibung an Demo-Konto, Spread oder Zeitgrenzen.

## Konsequenz und Betrieb

Philip akzeptiert die beobachtete Abweichung für den visuellen M5-Test. Die Schwelle
wird nicht an den einzelnen Unterschied angepasst. Am 27.09.2026 wurden 6614 native
M5-Kerzen und 993 historische M5-Orderblöcke idempotent ins Archiv importiert.
Die Gold-Bar-Constraint wurde erweitert und `forex-candles` mit XAUUSD-Freigabe
veröffentlicht: POST für XAUUSD/GBPUSD/EURUSD gemeinsam mit HTTP 200 geprüft.
Der lokale Gold-Schalter öffnet den historischen M5/H1/H4-Testchart; M5 zeigt zunächst
den 24.09., ältere Septemberdaten und August-Vorlauf sind per Verschieben erreichbar.
Der vorher freigeschaltete normale Gold-Chart führte zu HTTP 400, da dessen
Backend-Freigabe und Datenimport fehlten. M5-Testansicht mit 6614 Kerzen/993 OBs
im Browser geprüft. Keine produktive Collector-/Watcher-/Alarm-Änderung vorgenommen;
Gold-Livebetrieb, vollständige Strategie-Anpassung und weitere Historie bleiben offen.

Prüfcontainer ressourcenbegrenzt und ohne produktiven Datenmount. Collector vor/nach
healthy, Neustartzähler 2 unverändert. Nach Zusatzprüfung 3364 MiB RAM verfügbar,
Collector 61,22 MiB / 0,38 % CPU (Momentaufnahme, kein Dauerlasttest).

Artefakte: `candles.json`, `summary.json`, `tradingview.json`,
`tradingview-comparison.json`, `signal-comparison.json`, `side-comparison.json`.
Prüfskripte liegen daneben und enthalten keine Zugangsdaten.
