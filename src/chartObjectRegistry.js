// Generisch pinnbare Chartobjekte (pin_context.kind='chart_object'): eine neue Objektart braucht nur
// registerChartObjectType() + eine Quelle in PriceChart.vue, keine Migration, Spalten oder eigenen Klick-Zweig.
// Die FK-Arten (ob_zone, trade_setup, liquidity_level, DOB) bleiben bewusst auf ihrem eigenen Weg.
//
// Performance (DB-Timeouts in der Vergangenheit): Quellen sind Referenzen auf die ohnehin gezeichneten
// Primitive-Arrays, nichts wird pro Render kopiert. Kandidaten, Schlüssel und Snapshots entstehen erst beim Klick.

const types = new Map();

// def: { name (Typname für Filter), algoVersion, key(obj) → String, eindeutig je Instrument+Zeitebene; snapshot(obj) → JSON-Objekt;
//        time(snapshot) → Unix-Sekunden fürs Hinspringen; label(snapshot, instrument) → Text für Menü und Pin-Liste }
export function registerChartObjectType(type, def) {
  if (!/^[a-z0-9_]+$/.test(type)) throw new Error(`Ungültiger Chartobjekt-Typ: ${type}`);
  types.set(type, def);
}

export function chartObjectType(type) {
  return types.get(type) ?? null;
}

// Instrument und Zeitebene stehen im DB-Schlüssel, damit (type, key) global eindeutig ist, ohne dass jeder Typ
// daran denken muss.
export function chartObjectPinKey(type, instrument, timeframe, obj) {
  return `${instrument}|${timeframe}|${types.get(type).key(obj)}`;
}

// sources: [{ type, primitives (Live-Referenz), objectOf(primitive) }] — Kandidaten im selben Shape wie die
// übrigen Pin-Kandidaten (kind + distance), damit Menü und Dedupe in priceChartHitTest.js sie mitsortieren.
export function chartObjectPinCandidates(x, y, sources, { symbol, currentBar }, radius) {
  const result = [];
  const add = (type, def, obj, distance) => result.push({
    kind: "chart_object", type, instrument: symbol, timeframe: currentBar,
    key: chartObjectPinKey(type, symbol, currentBar, obj), snapshot: { ...def.snapshot(obj), algoVersion: def.algoVersion }, distance,
  });
  for (const { type, primitives, objectOf, candidates } of sources) {
    const def = types.get(type);
    // Quellen mit eigener Trefferlogik (z.B. DOB: geteilte Boxen, Paare) liefern { obj, distance } selbst.
    if (candidates) { for (const c of candidates(x, y, radius)) add(type, def, c.obj, c.distance); continue; }
    for (const p of primitives) {
      const distance = p.distanceTo(x, y);
      if (distance <= radius) add(type, def, objectOf(p), distance);
    }
  }
  return result;
}

export function hasChartObjectPinCandidate(x, y, sources, radius) {
  // has: billiger Treffer-Check für Quellen mit eigener Trefferlogik (Cursor läuft bei jeder Mausbewegung, ohne Snapshot-Bau).
  return sources.some(({ primitives, has }) => (has ? has(x, y, radius) : primitives.some((p) => p.distanceTo(x, y) <= radius)));
}

export function chartObjectLabel(type, snapshot, instrument) {
  return types.get(type)?.label(snapshot, instrument) ?? type;
}

// Eine Zeile für Pin-Menü, Pin-Liste und TSC-Rollen: Zeitebene + Typ-Label (enthält schon den Preis).
export const chartObjectDisplayLabel = ({ type, snapshot, instrument, timeframe }) => `${timeframe} ${chartObjectLabel(type, snapshot, instrument)}`;
// Kopf eines TSC-Rollen-Eintrags (Target/Evidenz), in Liste und Chart gleich: Registry-Label oder "Art Preis".
export const roleItemHead = (item, kindText, priceText) => (item.chartObject ? chartObjectDisplayLabel(item.chartObject) : `${kindText} ${priceText}`);

// Hervorhebung: Quell-Primitives folgen derselben Halo-Konvention wie LiquidityLinePrimitive/OrderBlockPrimitive
// (_options.inPinContext/isSelectedPin/pinColor/hoverColor, _requestUpdate aus attached()). Kippen statt neu bauen,
// wie applySelectionHalo — Hover kostet so weder DB noch Erkennung. Die Id hängt am Primitive, das je Refresh neu entsteht.
export const chartObjectId = (type, key) => `${type}:${key}`;
const primitiveIds = new WeakMap();

export function setChartObjectHalo(primitive, pinned, hovered) {
  const o = primitive._options;
  if (o.inPinContext === pinned && o.isSelectedPin === hovered) return;
  o.inPinContext = pinned;
  o.isSelectedPin = hovered;
  primitive._requestUpdate?.();
}

// Liefert die Ids der gerade gezeichneten Objekte, damit fehlende Pins aus ihrem Snapshot gezeichnet werden können.
export function applyChartObjectHighlights(sources, { symbol, currentBar }, pinnedIds, hoveredId) {
  const drawn = new Set();
  for (const { type, primitives, objectOf } of sources) {
    // Quellen ohne Primitive-Liste (eigene Trefferlogik) heben sich selbst hervor, siehe chartObjectRoleTarget.
    for (const p of primitives ?? []) {
      let id = primitiveIds.get(p);
      if (id === undefined) primitiveIds.set(p, (id = chartObjectId(type, chartObjectPinKey(type, symbol, currentBar, objectOf(p)))));
      drawn.add(id);
      setChartObjectHalo(p, pinnedIds.has(id), id === hoveredId);
    }
  }
  return drawn;
}

// Geometrie eines Pins aus seinem Snapshot (def.line → { price, dir, from, to|null, styleKey }), für Objekte, die gerade
// nicht gezeichnet sind (Toggle aus, außerhalb des Fensters). null = Typ ohne Snapshot-Zeichnung.
export function chartObjectLine(type, snapshot) {
  return types.get(type)?.line?.(snapshot) ?? null;
}

// TSC-Rollen (Bestätigung, Zusatzargument, Anti-Confluence, Target, Invalidierung) nehmen jedes Registry-Objekt in derselben
// Item-Form wie die alten Arten auf: price/sourceTime aus der Typ-Definition, damit Label, RR und Alter ohne Typ-Zweig laufen.
// Unbekannter Typ (Registrierung nicht geladen, z.B. im MCP-Test) → Preis aus snapshot.price, kein Absturz.
export function chartObjectItem(chartObject) {
  const def = types.get(chartObject.type);
  const line = def?.line?.(chartObject.snapshot) ?? null;
  return {
    kind: "chart_object", chartObject,
    price: line?.price ?? chartObject.snapshot?.price ?? null,
    sourceTime: def?.time?.(chartObject.snapshot) ?? null,
    touchedTime: line?.to ?? null,
    rangeLow: null, rangeHigh: null, timeframe: chartObject.timeframe,
  };
}

// Rollen-Klick: nächster Registry-Treffer im engen Klickradius. Läuft nur beim Klick, wie die Pin-Kandidatensuche.
export function chartObjectRoleTarget(x, y, sources, ctx, radius) {
  const hit = chartObjectPinCandidates(x, y, sources, ctx, radius).sort((a, b) => a.distance - b.distance)[0];
  if (!hit) return null;
  const { type, key, instrument, timeframe, snapshot } = hit;
  return chartObjectItem({ type, key, instrument, timeframe, snapshot });
}

export const chartObjectItemId = (item) => (item?.chartObject ? chartObjectId(item.chartObject.type, item.chartObject.key) : null);
