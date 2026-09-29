import { describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import TradeSetupChecklist from "../src/components/TradeSetupChecklist.vue";

const render = (checklistState = null, m1Check = null) => renderToString(createSSRApp(TradeSetupChecklist, {
  instrument: "GBPUSD", checklistState, m1Check,
}));

describe("Trade Setup Checklist presentation", () => {
  it('exposes M1 work as busy without advertising the current data as complete', async () => {
    const html = await render({ instrument: 'GBPUSD', status: 'ready', checks: {} }, { instrument: 'GBPUSD', reason: 'loading' });
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Wird aktualisiert…');
    expect(html).not.toContain('Daten ausgewertet');
  });
  it('shows a green news check independently of an unknown MMM time gate', async () => {
    const html = await render({ instrument: 'GBPUSD', status: 'ready', checks: {
      time: {status: 'unknown', details: ['MMM — Vorsicht', 'Keine News'], detailStatuses: [null, 'passed']},
    }});
    expect(html).toContain('Keine News');
    expect(html).toMatch(/class="[^"]*checklist-detail-status[^"]*"[^>]*data-status="passed"/);
    expect(html).toContain('aria-label="Unbekannt"');
  });
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
    }, setup: { primary: { reactionRecognizedAt: Date.parse('2026-09-09T09:30:00+02:00') / 1000, reactionPreview: { linked: false, candidateCount: 3,
      ob: { dir, top, bottom, startTime: Date.parse('2026-09-09T09:20:00+02:00') / 1000 },
    } } } });
    expect(html).toContain(label);
    expect(html).toContain(upper);
    expect(html).toContain(lower);
    expect(html).toContain('Kandidat');
    expect(html).toContain('2026-09-09 09:20');
    expect(html).toContain(`${label} (09:30 erkannt)`);
    expect(html).not.toContain('09:20 erkannt');
    expect(html).toContain('aria-label="Unbekannt — Zuordnung noch ungeklärt."');
    expect(html).not.toContain('data-status="passed"');
  });

  it("uses focusable status icons with accessible explanations", async () => {
    const html = await render({ instrument: "GBPUSD", status: "ready", checks: {
      h1Trend: { status: "passed", details: [] },
    } });
    expect(html).toContain('aria-label="Erfüllt"');
    expect(html).toContain('title="Erfüllt"');
    expect(html.match(/role="img" tabindex="0"/g)).toHaveLength(14);
    expect(html).toContain('tabindex="0" aria-label="Checklist-Prüfungen"');
    expect(html).toContain('class="status-tooltip"');
  });

  it.each([null, undefined, NaN])("does not invent an evaluation time for %s", async (evaluatedAt) => {
    const html = await render({ instrument: "GBPUSD", status: "missing", evaluatedAt });
    expect(html).toContain("Bewertungsstand unbekannt");
    expect(html).not.toContain("<time");
  });

  it("shows all ten checks without editable checkboxes or a fabricated result", async () => {
    const html = await render();
    expect(html.match(/data-status=/g)).toHaveLength(13);
    expect(html).toContain("Wird aktualisiert…");
    expect(html).not.toContain("Optionale Zusatzargumente");
    expect(html).toContain("M1 wartet auf vollständige H1-/M5-Prüfdaten.");
    expect(html).not.toMatch(/<input|data-status="passed"|data-status="blocked"/);
  });
  it('shows J Entry 1 only for the current instrument and a confirmed entry', async () => {
    const entry = { label: 'Entry 1', recognizedAt: Date.parse('2026-09-09T09:50:00+02:00') / 1000 };
    const html = await render(null, { instrument: 'GBPUSD', entry });
    expect(html).toMatch(/class="checklist-letter"[^>]*>J<\/span>Entry/);
    expect(html).toContain('Entry 1 um 09:50 Uhr');
    expect(await render(null, { instrument: 'EURUSD', entry })).not.toContain('Entry 1');
    expect(await render(null, { instrument: 'GBPUSD' })).not.toContain('Entry 1');
  });

  it.each([
    ["loading", "Wird aktualisiert…"], ["ready", "Daten ausgewertet"],
    ["missing", "Daten fehlen"], ["stale", "Daten veraltet"], ["error", "Auswertung fehlgeschlagen"],
  ])("distinguishes %s data from final setup approval", async (status, label) => {
    const html = await render({ instrument: "GBPUSD", status, checks: {} });
    expect(html).toContain(label);
    expect(html).not.toContain("noch keine endgültige Setup-Freigabe");
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
    for (const status of ["passed", "pending", "unknown", "blocked"]) {
      expect(html).toContain(`data-status="${status}"`);
    }
    expect(html).toContain("Bärisch");
    expect(html).toContain("&lt;b&gt;News-Sperre&lt;/b&gt;");
  });

  it('shows independent M1 details and its own timestamp, ignoring a late foreign instrument', async () => {
    const m1 = { instrument: 'GBPUSD', status: 'pending', evaluatedAt: Date.parse('2026-09-09T09:47:00+02:00') / 1000,
      details: ['M1 Uptrend', 'Nested Downtrend', 'Bärischer M5-OB-Retest'], detailStatuses: ['unmet', 'passed', 'passed'] };
    const html = await render({ instrument: 'GBPUSD', status: 'ready', checks: {} }, m1);
    expect(html).toContain('M1-Stand 2026-09-09 09:47 Uhr (Europe/Berlin)');
    expect(html).toMatch(/data-detail-status="unmet"[^>]*>M1 Uptrend/);
    expect(html).toMatch(/data-detail-status="passed"[^>]*>Nested Downtrend/);
    expect(html).not.toContain('Zurückgestellt');
    expect(await render(null, { ...m1, instrument: 'EURUSD' })).not.toContain('Nested Downtrend');
  });

  it("rejects a late result from another instrument", async () => {
    const html = await render({ instrument: "EURUSD", status: "ready",
      checks: { h1Trend: { status: "passed", details: ["Fremdes Ergebnis"] } },
    });
    expect(html).toContain("Wird aktualisiert…");
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
