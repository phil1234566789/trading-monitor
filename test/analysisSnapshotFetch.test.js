import { expect, it, vi } from "vitest";
import { createAnalysisSnapshotFetch } from "../analysis/dr-reichweite/analysisSnapshotFetch.js";

it("teilt identische parallele Archiv-Lesezugriffe, mit separat lesbaren Antworten", async () => {
  const network = vi.fn(async () => new Response('[{"id":1}]'));
  const fetch = createAnalysisSnapshotFetch(network);
  const url = "https://example.test/rest/v1/ob_zones?select=*";
  const [a, b] = await Promise.all([fetch(url), fetch(url)]);
  expect(await a.json()).toEqual([{ id: 1 }]);
  expect(await b.json()).toEqual([{ id: 1 }]);
  expect(network).toHaveBeenCalledTimes(1);
  await fetch(url, { headers: { Range: "1000-1999" } });
  expect(network).toHaveBeenCalledTimes(2);
});

it("speichert Fehler, Schreibzugriffe und variable Kerzenabfragen nicht", async () => {
  const network = vi.fn(async () => new Response("failed", { status: 500 }));
  const fetch = createAnalysisSnapshotFetch(network);
  const url = "https://example.test/rest/v1/liquidity_levels";
  await fetch(url);
  await fetch(url);
  expect(network).toHaveBeenCalledTimes(2);
  for (let i = 0; i < 2; i++) {
    await fetch(url, { method: "POST", body: "{}" });
    await fetch("https://example.test/rest/v1/forex_candles");
  }
  expect(network).toHaveBeenCalledTimes(6);
});
