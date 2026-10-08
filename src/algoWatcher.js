import { supabase } from "./supabaseClient.js";
import { fmtDateTime } from "./format.js";

export const WATCHER_LABELS = { live: "Live", waiting: "Wartet", error: "Störung", off: "Aus" };
export function watcherHealth(report, now = Date.now()) {
  if (!report) return { state: "waiting", label: "Wartet", pulse: false, reason: "Serverprüfung wird geladen" };
  // Ein erfolgreicher Browserabruf verlängert niemals den serverseitigen Gesundheitsnachweis.
  const fresh = Number.isFinite(Date.parse(report.validUntil)) && now < Date.parse(report.validUntil);
  const state = fresh && WATCHER_LABELS[report.state] ? report.state : "error";
  return { state, label: WATCHER_LABELS[state], pulse: fresh && state === "live" && report.pulse === true,
    reason: fresh ? report.reason : "Serverprüfung fehlt oder ist abgelaufen" };
}
export function watcherTime(value) {
  return fmtDateTime(value, { timeZone: "Europe/Berlin", second: "2-digit" });
}
export function watcherTooltip(report, health) {
  const ranges = (report?.instruments ?? []).flatMap(item => item.activeRanges ?? []);
  const ready = ranges.filter(range => range.structureReady).length;
  const phases = (report?.instruments ?? []).map(item => `${item.instrument}: ${item.phase ?? "–"}`).join(" · ");
  return `${health.label}: ${health.reason ?? ""} · ${ranges.length} aktive DR, ${ready} mit BOS + M1-Pivot${phases ? ` · ${phases}` : ""}`;
}
export async function fetchAlgoWatcher() {
  const { data, error } = await supabase.functions.invoke("setup2-notification-watch", { method: "GET" });
  if (error) throw new Error("Serverprüfung konnte nicht geladen werden");
  if (!data || !Array.isArray(data.instruments)) throw new Error("Ungültige Serverprüfung");
  return data;
}
export async function testPushover(password) {
  const { data, error } = await supabase.functions.invoke("pushover-test", { body: { password } });
  if (error || data?.accepted !== true) {
    const status = error?.context?.status;
    throw new Error((status === 401 || status === 403) ? "Passwort nicht akzeptiert" : status === 429 ? "Zu viele Versuche. Bitte später erneut versuchen." : "Testversand fehlgeschlagen. Serverstatus prüfen.");
  }
  return true;
}
export function setup2AlarmRow(event) {
  const labels = { 1: "BOS + M1-Pivot", 2: "Neuer OB-Retest", 3: "Entry ausführbar" };
  const payload = event.payload ?? {};
  const rangeWarning=payload.category==='range-warning';
  const recovery=event.kind==='recovery';
  return { id: `setup2-${event.id}`, time: event.signal_at, detectedAt: event.detected_at,
    typeLabel: recovery ? "Algo-Entwarnung" : rangeWarning ? 'DR-Warnung' : event.kind === "problem" ? "Algo-Störung" : `Setup 2 · ${labels[event.stage] ?? event.stage}`,
    direction: event.direction, directionLabel: event.direction === "long" ? "Long" : event.direction === "short" ? "Short" : "–",
    detail: [recovery ? `Incident ${payload.incidentId ?? "–"}` : `DR ${event.setup_key ?? "–"}`, event.missed_reason || payload.reason || payload.message].filter(Boolean).join(" · "),
    price: payload.entryPrice ?? payload.entry?.price ?? "–", notifiedAt: recovery ? payload.delivery?.acceptedAt ?? null : null,
    deliveryLabel: recovery ? `Telegram · ${payload.delivery?.status ?? "pending"}${payload.delivery?.error ? ` · ${payload.delivery.error}` : ""}` : rangeWarning ? 'Nur Protokoll · kein Eingreifen erforderlich' : event.missed_reason ? "Verpasst · Protokollhinweis" : "Siehe Watcher-Versandstatus" };
}
