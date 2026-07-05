-- `notified_at` bedeutet jetzt exklusiv "hier ging wirklich eine Telegram-Nachricht raus"
-- und ist deshalb für Alt-Zonen ohne echten Versand leer. Fürs Protokoll (immer sichtbare
-- "Erreicht am"-Zeit) und fürs Chart-Rendering (Zonen-Box einfrieren statt bis "jetzt"
-- weiterzuziehen) braucht es eigene, vom Versand unabhängige Zeitpunkte.
alter table ob_zones
  add column touched_at timestamptz,
  add column invalidated_at timestamptz;

-- Backfill best-effort: fuer bereits getouchte/invalidierte Zonen ist der exakte
-- historische Zeitpunkt nicht mehr rekonstruierbar (updated_at wird bei jedem Cron-Lauf
-- ueberschrieben) - nutzt daher den zuletzt bekannten updated_at als Naeherung, ab jetzt
-- friert der poi-watcher touched_at/invalidated_at beim jeweiligen Uebergang endgueltig ein.
update ob_zones set touched_at = coalesce(notified_at, updated_at) where touched and touched_at is null;
update ob_zones set invalidated_at = updated_at where invalidated and invalidated_at is null;
