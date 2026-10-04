const SOURCES = new Set(['live', 'backfill', 'rebuild', 'manual']);

function canonical(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) return { number: String(value) };
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}

export function setup1Configuration({ instrument, params, minGap = null, sessions = [], ...pipeline }) {
  // nowTime ist Auswertungszeit, keine Einstellung. Session-IDs/Farben ändern keine Erkennung.
  const { nowTime: _nowTime, ...tuning } = params;
  const ignoredSessions = sessions.filter(s => s.ignoreLiquidity).map(s => ({
    fromMinutes: s.fromMinutes, toMinutes: s.toMinutes, days: s.days ? [...s.days].sort((a, b) => a - b) : null,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { schemaVersion: 1, instrument, params: tuning, minGap, ignoredSessions, ...pipeline };
}

// Reines JS/Web Crypto: derselbe Hash-Vertrag läuft in Browser, Deno und lokalem Node.
export async function tradeSetupProvenance({ source, detectorVersion = null, configuration = null, inputSetId = null }) {
  if (!SOURCES.has(source)) throw new Error('Unknown trade setup source');
  const bytes = configuration == null ? null : await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(canonical(configuration))));
  return { source, detector_version: detectorVersion,
    config_hash: bytes ? Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('') : null,
    input_set_id: inputSetId };
}
