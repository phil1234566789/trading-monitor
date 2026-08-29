// Zeichnet ein Canvas-Label mit einem optional größer skalierten, führenden Icon-Zeichen (Chat
// 2026-08-28: Philip wollte erst das GANZE Anti-Confluence-Label 1,5-2x größer, dann korrigiert
// auf "nur den Totenkopf größer, der Rest der Schrift normal") — fillText() kann pro Aufruf nur
// EINE Schriftgröße zeichnen, Icon und restlicher Text brauchen darum zwei getrennte Aufrufe,
// nebeneinander positioniert. Deckt nur die beiden Ausrichtungen ab, die die Bestätigungs-/
// Zusatzargument-/Anti-Confluence-Labels tatsächlich nutzen (siehe PriceChart.vue:
// refreshTradeConfirmationLinksInternal): "left" (DivergenceLinePrimitive, rsiRendering.js) und
// "right" (OrderBlockPrimitive orderBlocks.js, LiquidityLinePrimitive liquidity.js) — kein
// "center"/mehrzeilig, das brauchen Evidenz-Labels nicht.
//
// icon = null/undefined lässt diese Funktion exakt wie ein normaler ctx.fillText()-Aufruf
// verhalten (ein Draw, eine Schriftgröße) — bestehende Aufrufer (News-Marker, Targets, Trade-Setups,
// live erkannte Divergenzen etc.), die kein Icon getrennt übergeben, sind davon unberührt.
export function drawIconLabel(ctx, { icon, text, x, y, align, baseline, fontSizePx, fontFamily, iconScale = 1, gapPx = 3 }) {
  ctx.textBaseline = baseline;
  if (!icon) {
    ctx.textAlign = align;
    ctx.font = `${fontSizePx}px ${fontFamily}`;
    ctx.fillText(text, x, y);
    return;
  }
  const iconFontPx = fontSizePx * iconScale;
  ctx.font = `${iconFontPx}px ${fontFamily}`;
  const iconWidth = ctx.measureText(icon).width;
  ctx.font = `${fontSizePx}px ${fontFamily}`;
  const textWidth = ctx.measureText(text).width;

  ctx.textAlign = align === "right" ? "right" : "left";
  if (align === "right") {
    // Text endet bei x (rechtsbündig wie zuvor), das größere Icon davor mit kleinem Abstand.
    ctx.font = `${fontSizePx}px ${fontFamily}`;
    ctx.fillText(text, x, y);
    ctx.font = `${iconFontPx}px ${fontFamily}`;
    ctx.fillText(icon, x - textWidth - gapPx, y);
  } else {
    ctx.font = `${iconFontPx}px ${fontFamily}`;
    ctx.fillText(icon, x, y);
    ctx.font = `${fontSizePx}px ${fontFamily}`;
    ctx.fillText(text, x + iconWidth + gapPx, y);
  }
}
