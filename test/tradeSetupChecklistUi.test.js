import { describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import TradeSetupChecklist from "../src/components/TradeSetupChecklist.vue";

const render = (checklistState = null) => renderToString(createSSRApp(TradeSetupChecklist, {
  instrument: "GBPUSD", checklistState,
}));

describe("Trade Setup Checklist presentation", () => {
  it.each(['ready', 'stale'])('shows not tradeable independently of %s candle data', async status => {
    const html = await render({ instrument: 'GBPUSD', status, tradeability: 'blocked', checks: {} });
    expect(html).toContain('Nicht tradebar');
    expect(html).toContain(status === 'ready' ? 'Daten ausgewertet' : 'Daten veraltet');
    expect(html).not.toContain('noch keine endgültige Setup-Freigabe');
  });
  it.each([
    [-1, 1.35675, 1.35641, 'bärische M5 OB', '1,35675', '1,35641'],
    [1, 1.12345, 1.12222, 'bullische M5 OB', '1,12345', '1,12222'],
  ])("shows the actual OB bounds for direction %s without confirming its association", async (dir, top, bottom, label, upper, lower) => {
    const html = await render({ instrument: 'GBPUSD', status: 'ready', checks: {
      reaction: { status: 'unknown', details: ['Zuordnung noch ungeklärt.'] },
    }, setup: { primary: { reactionPreview: { linked: false, candidateCount: 3,
      ob: { dir, top, bottom, startTime: Date.parse('2026-09-09T09:20:00+02:00') / 1000 },
    } } } });
    expect(html).toContain(label);
    expect(html).toContain(upper);
    expect(html).toContain(lower);
    expect(html).toContain('Kandidat');
    expect(html).toContain('2026-09-09 09:20');
    expect(html).toContain('aria-label="Unbekannt — Zuordnung noch ungeklärt."');
    expect(html).not.toContain('data-status="passed"');
  });

  it("uses focusable status icons with accessible explanations", async () => {
    const html = await render({ instrument: "GBPUSD", status: "ready", checks: {
      h1Trend: { status: "passed", details: [] },
    } });
    expect(html).toContain('aria-label="Erfüllt"');
    expect(html).toContain('title="Erfüllt"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(10);
    expect(html).toContain('class="status-tooltip"');
  });

  it.each([null, undefined, NaN])("does not invent an evaluation time for %s", async (evaluatedAt) => {
    const html = await render({ instrument: "GBPUSD", status: "missing", evaluatedAt });
    expect(html).toContain("Bewertungsstand unbekannt");
    expect(html).not.toContain("<time");
  });

  it("shows all nine checks without editable checkboxes or a fabricated result", async () => {
    const html = await render();
    expect(html.match(/data-status=/g)).toHaveLength(9);
    expect(html).toContain("Auswertung ausstehend");
    expect(html).toContain("Optionale Zusatzargumente");
    expect(html).toContain("Zurückgestellt · kein aktuelles Freigabekriterium");
    expect(html).not.toMatch(/<input|data-status="passed"|data-status="blocked"/);
  });

  it.each([
    ["loading", "Auswertung lädt"], ["ready", "Daten ausgewertet"],
    ["missing", "Daten fehlen"], ["stale", "Daten veraltet"], ["error", "Auswertung fehlgeschlagen"],
  ])("distinguishes %s data from final setup approval", async (status, label) => {
    const html = await render({ instrument: "GBPUSD", status, checks: {} });
    expect(html).toContain(label);
    expect(html).toContain("noch keine endgültige Setup-Freigabe");
    expect(html).not.toContain('data-status="passed"');
  });

  it("renders independent outcomes and escapes evaluator text", async () => {
    const html = await render({
      instrument: "GBPUSD", status: "ready", checks: {
        h1Trend: { status: "passed", details: ["Bärisch"] },
        liquiditySweep: { status: "pending", details: [] },
        reaction: { status: "unknown", details: [] },
        time: { status: "blocked", details: ["<b>News-Sperre</b>"] },
        m1: { status: "deferred", details: [] },
      },
    });
    for (const status of ["passed", "pending", "unknown", "blocked", "deferred"]) {
      expect(html).toContain(`data-status="${status}"`);
    }
    expect(html).toContain("Bärisch");
    expect(html).toContain("&lt;b&gt;News-Sperre&lt;/b&gt;");
  });

  it("rejects a late result from another instrument", async () => {
    const html = await render({ instrument: "EURUSD", status: "ready",
      checks: { h1Trend: { status: "passed", details: ["Fremdes Ergebnis"] } },
    });
    expect(html).toContain("Auswertung ausstehend");
    expect(html).not.toContain("Fremdes Ergebnis");
    expect(html).not.toContain('data-status="passed"');
  });

  it.each([
    ["2026-09-09T07:20:00Z", "2026-09-09 09:20"],
    ["2026-01-09T08:20:00Z", "2026-01-09 09:20"],
  ])("shows the evaluation timestamp in Berlin for %s", async (iso, expected) => {
    const html = await render({ instrument: "GBPUSD", status: "ready", evaluatedAt: Date.parse(iso) / 1000 });
    expect(html).toContain(`${expected} Uhr (Europe/Berlin)`);
  });
});
