// Reine Regeln getrennt vom Browser-Store, damit Checklist und TSC dieselbe Relevanz nutzen.
const INSTRUMENT_CURRENCIES = {
  EURUSD: ["EUR", "USD"],
  GBPUSD: ["GBP", "USD"],
  XAUUSD: ["USD"],
};

// Historische TSC-Daumenregel gegen News-Spikes; die Checklist hat separat bestätigte Grenzen.
export const NEWS_NOGO_WINDOW_MINUTES = 30;

export function supportsNewsInstrument(instrument) {
  return Object.hasOwn(INSTRUMENT_CURRENCIES, instrument);
}

export function newsEventsForInstrument(events, instrument) {
  const currencies = INSTRUMENT_CURRENCIES[instrument];
  if (!currencies) return [];
  return events.filter((event) => currencies.includes(event.currency));
}

// Das TSC behält beide inklusiven ±30-Grenzen; F nutzt ausdrücklich [−30, +15).
export function newsEventsInWindow(events, instrument, evaluatedAt, { beforeMinutes, afterMinutes, includeEnd = false }) {
  return newsEventsForInstrument(events, instrument).filter((event) => {
    const start = event.eventTime - beforeMinutes * 60;
    const end = event.eventTime + afterMinutes * 60;
    return evaluatedAt >= start && (includeEnd ? evaluatedAt <= end : evaluatedAt < end);
  });
}

export function currentNewsNoGo(events, instrument, nowSec, windowMinutes = NEWS_NOGO_WINDOW_MINUTES) {
  const hit = newsEventsInWindow(events, instrument, nowSec, {
    beforeMinutes: windowMinutes, afterMinutes: windowMinutes, includeEnd: true,
  })[0];
  return hit ? { title: hit.title, currency: hit.currency, eventTime: hit.eventTime } : null;
}
