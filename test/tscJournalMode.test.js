import { describe, expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import TradeSetupCockpit from "../src/components/TradeSetupCockpit.vue";

const range = {
  id: 42, direction: "long", invalidation: 1.1,
  confirmations: [
    { id: 1, category: "confirmation", kind: "ob", price: 1.11 },
    { id: 2, category: "confirmation", kind: "ob", price: 1.12 },
  ],
  targets: [{ id: 3, kind: "pivot", price: 1.2 }],
};

describe("TSC journal mode", () => {
  it("blocks transfer even for a complete range and replaces destructive reset with close", async () => {
    const html = await renderToString(createSSRApp(TradeSetupCockpit, { range, instrument: "GBPUSD", fromJournal: true }));
    expect(html).toMatch(/<button[^>]*class="[^"]*tsc-transfer-btn[^>]*disabled/);
    expect(html).toContain("bereits im Journal angelegt");
    expect(html).toContain("Journal-Ansicht schließen");
    expect(html).not.toContain('title="Zurücksetzen"');
  });

  it("keeps transfer available for a complete new idea", async () => {
    const html = await renderToString(createSSRApp(TradeSetupCockpit, { range, instrument: "GBPUSD" }));
    expect(html).not.toMatch(/<button[^>]*class="[^"]*tsc-transfer-btn[^>]*disabled/);
    expect(html).toContain('title="Zurücksetzen"');
  });
});
