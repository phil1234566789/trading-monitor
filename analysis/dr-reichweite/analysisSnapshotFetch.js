// Nur im einmaligen Analyseprozess: dieselben historischen Tabellen nicht tausendfach laden.
// Kerzenabfragen bleiben zeitpunktgenau; ein neuer Prozess beginnt mit einem leeren Snapshot.
export function createAnalysisSnapshotFetch(networkFetch) {
  const pages = new Map();
  return async (input, init) => {
    const request = new Request(input, init);
    const table = new URL(request.url).pathname;
    if (request.method !== "GET" || !/^\/rest\/v1\/(ob_zones|liquidity_levels|sessions)$/.test(table)) {
      return networkFetch(input, init);
    }
    // Range und Auth gehören zum Schlüssel: verschiedene Seiten/Leserechte nie vermischen.
    const key = JSON.stringify([request.url, [...request.headers.entries()].sort()]);
    if (!pages.has(key)) {
      const pending = Promise.resolve().then(() => networkFetch(input, init)).then((response) => {
        if (!response.ok) pages.delete(key);
        return response;
      }, (error) => { pages.delete(key); throw error; });
      pages.set(key, pending);
    }
    return (await pages.get(key)).clone();
  };
}
