-- S1/S2 im Trading-Flow-Graphen sichtbar machen (docs/state-machine.md#s1-s2-sichtbar,
-- Philip 06.09.2026: "wenn wir uns in S1 oder S2 befinden, will ich das im Graphen sehen") —
-- check_pretrade_gates legt jetzt bei einem Block (außerhalb Handelszeit / News-Pause) selbst eine
-- trading_loop_state-Zeile an, BEVOR ein Bias (direction) überhaupt bekannt ist. direction muss
-- dafür nullable werden; current_step muss 1 (Handelszeit) und 2 (News) mit abdecken.
alter table trading_loop_state alter column direction drop not null;

alter table trading_loop_state drop constraint trading_loop_state_current_step_check;
alter table trading_loop_state add constraint trading_loop_state_current_step_check check (current_step between 1 and 8);
