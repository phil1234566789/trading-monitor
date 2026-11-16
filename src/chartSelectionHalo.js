// Ein Zeilen-Hover (TSC/TradeEditModal/PinPanel) ändert nur den Auswahl-Halo. Die Bestätigungs-/
// Target-Primitives komplett neu zu bauen (obBoxTouchState/firstCandleTouch über alle Trades)
// kostete ~160 ms pro mouseenter UND mouseleave — deshalb bleiben sie stehen, nur die Option kippt.
// Die Renderer lesen _options per Referenz, requestUpdate stammt aus attached().
export function applySelectionHalo(primitives, isSelected) {
  for (const primitive of primitives) {
    const next = isSelected(primitive);
    if (primitive._options.isSelectedPin === next) continue;
    primitive._options.isSelectedPin = next;
    primitive._requestUpdate?.();
  }
}
