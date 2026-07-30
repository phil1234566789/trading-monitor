-- Erweiterung des Claude-Notizen-Imports (siehe src/claudeAnnotations.js, ClaudeAnnotationsModal.vue):
-- ein einzelner Paste kann jetzt mehrere Zeichnungs-Gruppen ({"drawings":[{title,annotations},...]})
-- enthalten, die jeweils als EIGENE Zeile gespeichert werden (statt wie bisher immer genau eine
-- Zeile pro "Zeichnen"-Klick). title macht die Zeilen in der Liste unterscheidbar (vorher nur
-- Zeitstempel + Element-Anzahl); visible erlaubt Ein-/Ausblenden pro Zeichnung, zusätzlich zum
-- bestehenden globalen Toggle in App.vue (useClaudeAnnotations.js filtert flatAnnotations jetzt
-- zusätzlich nach dieser Spalte). Farbe pro Annotation (optionales "color"-Feld, Hex-String) lebt
-- weiterhin im annotations-jsonb selbst, braucht keine eigene Spalte.
alter table claude_annotations
  add column title text not null default 'Claude-Notizen',
  add column visible boolean not null default true;

alter table claude_annotations alter column title drop default;
