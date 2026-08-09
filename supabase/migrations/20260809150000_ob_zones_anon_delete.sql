-- Ergänzt die anon-Insert-Policy von eben (20260809140000) um DELETE — gebraucht, um fehlerhafte
-- Zeilen aus einem Backfill-Lauf korrigieren zu können (Chat 2026-08-09: ein Pagination-Bug in
-- backfillObZones.ts las nur die ersten 1000 statt aller archivierten Kerzen, dadurch wurden
-- 5M/1H-Zonen aus einer unvollständigen Kerzenserie erkannt und geschrieben). Gleiches
-- Single-User-Anon-Modell wie der Rest des Schemas.
create policy "ob_zones delete for anon"
  on ob_zones for delete
  to anon
  using (true);
