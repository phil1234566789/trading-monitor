// Ein Microtask/nextTick zeichnet noch nicht: erst nach dem Frame darf die
// synchrone Auswertung den Hauptthread belegen, damit der Ladehinweis sichtbar wird.
export function afterBrowserPaint(callback) {
  if (typeof requestAnimationFrame !== 'function') { callback(); return () => {}; }
  let timer;
  const frame = requestAnimationFrame(() => { timer = setTimeout(callback, 0); });
  return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
}
