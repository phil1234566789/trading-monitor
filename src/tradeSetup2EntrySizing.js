export const ENTRY_SIZING_VERSION = 'dr-against-m5-trend-choch-v1';
export const ENTRY_RISK_BUDGET = 500;

export function entrySizingAt(checklist, entry) {
  const reaction = checklist.checks?.m5Trend?.structureReaction;
  const choch = reaction?.choch;
  const confirmed = checklist.evaluatedAt === entry.recognizedAt && reaction?.direction === entry.direction
    && choch?.direction === entry.direction && choch.type === 'CHoCH'
    && Number.isFinite(choch.recognizedAt) && choch.recognizedAt <= entry.recognizedAt;
  return { version: ENTRY_SIZING_VERSION, model: 'dr-against-m5-trend', evaluatedAt: entry.recognizedAt,
    factor: confirmed ? 1 : 0.5, reason: confirmed ? 'm5ChochConfirmed' : 'm5ChochMissing',
    choch: confirmed ? { ...choch } : null };
}

export function entrySizingLabel(sizing) {
  if (!sizing) return 'Historischer Stand · bisherige Größe unverändert';
  return sizing.factor === 0.5
    ? '½ Größe · Faktor 0,5 · kein bestätigter M5-CHoCH in Traderichtung'
    : 'Volle Größe · Faktor 1 · M5-CHoCH in Traderichtung bestätigt';
}
