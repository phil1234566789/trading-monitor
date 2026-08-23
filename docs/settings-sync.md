# Settings-Sync: localStorage-first, Supabase als Cross-Device-Source-of-Truth

Chart-Farben (`src/chartColors.js`) und Sessions (`src/sessions.js`) folgen beide demselben
Muster, gewählt weil es keine Auth braucht (Single-User-App, RLS-Policies erlauben einfach
`anon`):
1. Synchron aus `localStorage` laden für sofortiges Rendern.
2. Async von Supabase nachladen; hat die DB Zeilen, gewinnen sie und überschreiben den lokalen
   State.
3. Ist die DB leer, aber der lokale State nicht, den lokalen State einmalig hochpushen
   (Bootstrap) — dadurch kann ein brandneues Gerät Settings von einem Gerät übernehmen, das schon
   welche hat, ohne dass ein leeres Gerät je eine bestehende Konfiguration stillschweigend
   leerräumt.
4. Jede lokale Mutation schreibt sofort in `localStorage` und debounced (500ms) nach Supabase.

`chart_colors` ist ein fixes Key/Value-Set (nur Upsert). `sessions` ist eine dynamische Liste mit
Add/Remove, daher ist ihr Remote-Save ein vollständiges Delete-then-Insert statt eines
Per-Row-Upserts. Es gibt keine echte Konfliktauflösung — das zuletzt speichernde Gerät gewinnt —
akzeptierter Tradeoff für eine Single-User-App, kein Versehen.

Beim Bau eines neuen, ähnlich synchronisierten Settings-Stores dieses Muster wiederverwenden statt
neu zu erfinden.
