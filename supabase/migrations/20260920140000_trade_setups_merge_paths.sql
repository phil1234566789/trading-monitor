-- Path A und Path B zu EINEM Setup je bestätigender M5-OB zusammenführen.
--
-- Philip 20.09.2026: "Fachlich gesehen ist mir scheissegal, ob Path A oder B. Ich brauche diese
-- Info nicht. ... Sobald es erkannt worden ist, gilt es halt einfach als Trade Setup." Der Pfad
-- ist reine Erkennungsmechanik; die Tabelle führte ihn trotzdem als Identität, weil der Schlüssel
-- (instrument, direction, fractal_pivot_time) war. Derselbe OB erzeugte damit zwei Zeilen, sobald
-- die Pfade auf verschiedene Sweeps liefen, und JEDER Verbraucher musste selbst entduplizieren
-- (die Auswertung fasste zusammen, der Alarm brauchte eine eigene ob_zone_id-Sperre, die R-Skala
-- übersprang Path B).
--
-- Neuer Schlüssel: (instrument, direction, ob_start_time). Über den Bestand geprüft — die OB-Box
-- unterscheidet sich zwischen den Zeilen eines Paares in NULL Fällen.
--
-- Neue Spalte `invalidation`: die ferne OB-Kante, also das von widenObForSweep (_shared/
-- tradeSetup.ts) beim Erkennen aufgezogene Sweep-Extrem. Gemessen über 889 Path-A-Zeilen stimmt
-- sie in 96 % auf unter 1 Pip mit dem später bestätigten Extrem-Fraktal überein, in 87 %
-- punktgenau — der period-5-Pivot bestätigt also nur einen Preis, der beim Entstehen des OB längst
-- feststeht, und die 25 Minuten Wartezeit auf ihn entfallen fachlich. Wo beide auseinanderliegen,
-- liegt die Kante in 30 von 33 Fällen WEITER weg, also nie zu eng. Generiert statt befüllt, damit
-- sie nicht von ob_top/ob_bottom wegdriften kann.
--
-- `fractal_price`/`fractal_pivot_time` bleiben als Debug-Info stehen (der bestätigte period-5-
-- Pivot, falls es einen gab) — sie sind ab jetzt weder Schlüssel noch Invalidierungsquelle.
--
-- Bekannte Einschränkung des Altbestands: 83 Zeilen vom 16.07.–03.08.2026 stammen aus der Zeit
-- vor/um widenObForSweep, ihre OB-Kante weicht vom Sweep-Extrem ab (72 davon zu eng, max 9,6 Pip).
-- Keine einzige Zeile aus dem Backfill vom 20.09. weicht ab. Bewusst nicht nachgerechnet: dafür
-- bräuchte es das Kerzenarchiv, und die betroffenen Ideen sind längst abgeschlossen.

-- 1) Zuordnung Zeile -> Überlebender der Gruppe. Überlebender ist die ÄLTESTE Zeile (min(id)):
--    an ihr hängen die Fremdschlüssel, ihr created_at ist der tatsächliche Erkennungszeitpunkt
--    (das ist der Zeitstempel, auf den der Replay-Filter in getTradeSetups geht).
create temporary table setup_zuordnung on commit drop as
select id, min(id) over (partition by instrument, direction, ob_start_time) as survivor_id
from trade_setups;

-- 2) Quelle für die Erkennungsfelder: die Zeile mit einem EIGENEN bestätigten Fraktal
--    (fractal_price <> ls_price), sonst der Überlebende selbst. Alle Felder aus DERSELBEN Zeile,
--    damit fractal und ls zueinander passen (der Sweep muss das Fraktal auch geswept haben).
create temporary table setup_quelle on commit drop as
select distinct on (z.survivor_id)
  z.survivor_id,
  t.fractal_price,
  t.fractal_pivot_time,
  t.ls_price,
  t.ls_pivot_time,
  t.ls_touched_time,
  t.ls_timeframe,
  t.ob_zone_id
from setup_zuordnung z
join trade_setups t on t.id = z.id
order by z.survivor_id, (t.fractal_price <> t.ls_price) desc, t.id;

-- 3) Alarm-Zustand der Gruppe: hat IRGENDEINE Zeile alarmiert, gilt die Zone als alarmiert —
--    sonst würde der zusammengelegte Eintrag nachträglich ein zweites Telegram auslösen.
create temporary table setup_alarm on commit drop as
select z.survivor_id, bool_or(t.notified) as notified, min(t.notified_at) as notified_at
from setup_zuordnung z
join trade_setups t on t.id = z.id
group by z.survivor_id;

-- 4) Alter Unique-Schlüssel muss weg, BEVOR das Fraktal auf den Überlebenden umzieht (sonst
--    kollidiert es mit seinem noch existierenden Zwilling).
alter table trade_setups drop constraint trade_setups_instrument_direction_fractal_pivot_time_key;

update trade_setups t
set fractal_price = q.fractal_price,
    fractal_pivot_time = q.fractal_pivot_time,
    ls_price = q.ls_price,
    ls_pivot_time = q.ls_pivot_time,
    ls_touched_time = q.ls_touched_time,
    ls_timeframe = coalesce(q.ls_timeframe, t.ls_timeframe),
    ob_zone_id = coalesce(q.ob_zone_id, t.ob_zone_id),
    notified = a.notified,
    notified_at = a.notified_at
from setup_quelle q
join setup_alarm a on a.survivor_id = q.survivor_id
where t.id = q.survivor_id;

-- 5) Fremdschlüssel auf den Überlebenden umbiegen. pin_context hat einen UNIQUE-Index auf
--    trade_setup_id — ist der Überlebende schon gepinnt, wird der Pin des Zwillings gelöscht
--    statt umgebogen (es ist derselbe Pin auf dasselbe Setup).
update dealing_ranges dr
set trade_setup_id = z.survivor_id
from setup_zuordnung z
where dr.trade_setup_id = z.id and z.id <> z.survivor_id;

delete from pin_context pc
using setup_zuordnung z
where pc.trade_setup_id = z.id
  and z.id <> z.survivor_id
  and exists (select 1 from pin_context p2 where p2.trade_setup_id = z.survivor_id);

update pin_context pc
set trade_setup_id = z.survivor_id
from setup_zuordnung z
where pc.trade_setup_id = z.id and z.id <> z.survivor_id;

delete from trade_setups t
using setup_zuordnung z
where t.id = z.id and z.id <> z.survivor_id;

-- 6) Neuer Schlüssel + die Invalidierung als generierte Spalte.
alter table trade_setups add constraint trade_setups_instrument_direction_ob_start_time_key
  unique (instrument, direction, ob_start_time);

alter table trade_setups add column invalidation numeric
  generated always as (case when direction = 'short' then ob_top else ob_bottom end) stored;

comment on column trade_setups.invalidation is
  'Der Preis, bei dem die Idee invalidiert ist: ferne OB-Kante = das beim Erkennen aufgezogene Sweep-Extrem (widenObForSweep). Generiert, nicht geschrieben.';
comment on column trade_setups.fractal_price is
  'Debug: Preis des bestätigten period-5-Protected-Pivots, falls es einen gab — sonst gleich ls_price. NICHT die Invalidierung, dafür ist invalidation da.';
comment on column trade_setups.fractal_pivot_time is
  'Debug: Pivot-Zeitpunkt zu fractal_price. War bis 20.09.2026 Teil des Unique-Schlüssels, ist es nicht mehr.';
