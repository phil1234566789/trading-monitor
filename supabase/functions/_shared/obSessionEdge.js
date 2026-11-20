// HTF-Kante über die Kerze vor der Impulskerze (c1): ein Morning/Evening Star oder ein c1-Docht,
// der zugleich Session-Extrem ist, macht diesen Docht zur echten OB-Kante, nicht erst c2 (Philip,
// XAU H1 03.11.2026). Gemeinsam für alle drei detectOrderBlocks-Kopien (Frontend, _shared, MCP).
const STAR_MAX_BODY_RATIO = 0.3;
const body = (c) => Math.abs(c.close - c.open);

function isStar(a, s, b, dir) {
  const mid = (a.open + a.close) / 2;
  const opposite = dir === 1 ? a.close < a.open : a.close > a.open;
  const impulse = dir === 1 ? b.close > b.open && b.close > mid : b.close < b.open && b.close < mid;
  return opposite && impulse && body(s) <= STAR_MAX_BODY_RATIO * body(a);
}

// a = Kerze vor c1, s = c1, b = c2. Liefert die c1-Kante samt Gültigkeitsbeginn oder null.
// Ein Star gilt sofort; ein Session-Extrem steht erst mit Session-Ende fest (knownAt) und wird
// dann nachgetragen (Philip, Pin 603: Asia-Low lag in c1, die OB entstand aber vor Asia-Ende).
export function c1EdgeCandidate(a, s, b, dir) {
  const beyond = dir === 1 ? s.low < b.low : s.high > b.high;
  if (!beyond) return null;
  const price = dir === 1 ? s.low : s.high;
  if (isStar(a, s, b, dir)) return { price, knownAt: -Infinity, drawStartTime: s.time };
  const knownAt = dir === 1 ? s.sessionLowKnownAt : s.sessionHighKnownAt;
  return knownAt == null ? null : { price, knownAt, drawStartTime: s.time };
}

// Je Kerze vor den Touch-/Invalidierungs-Prüfungen aufrufen: Kerzenweise statt am Serienende,
// damit eine vor Session-Ende schon invalidierte Zone invalidiert bleibt (kein Rückschreiben der
// Historie) und Replay/inkrementelle Erkennung denselben Stand sehen wie der Volllauf.
export function applyPendingEdge(zone, time) {
  const edge = zone.pendingEdge;
  if (!edge || time < edge.knownAt) return;
  if (zone.dir === 1) zone.bottom = edge.price; else zone.top = edge.price;
  zone.drawStartTime = edge.drawStartTime;
  delete zone.pendingEdge;
}
