import { effectScope, ref } from "vue";
import { describe, expect, it } from "vitest";
import { useReplayStructureDefaults } from "../src/composables/useReplayStructureDefaults.js";

describe("replay structure defaults", () => {
  it.each([false, true])("selects 21 days on entry, including a reload with replay=%s", (initial) => {
    const scope = effectScope();
    const replayActive = ref(initial);
    const startMode = ref("pivot");
    const lookbackHours = ref(168);
    const innerLookbackHours = ref(48);
    scope.run(() => useReplayStructureDefaults(replayActive, { startMode, lookbackHours, innerLookbackHours }));
    if (!initial) {
      expect(startMode.value).toBe("pivot");
      expect(lookbackHours.value).toBe(168);
      replayActive.value = true;
    }
    expect(startMode.value).toBe("days");
    expect(lookbackHours.value).toBe(504);
    expect(innerLookbackHours.value).toBe(504);
    lookbackHours.value = 240;
    expect(lookbackHours.value).toBe(240);
    replayActive.value = false;
    expect(startMode.value).toBe("pivot");
    expect(lookbackHours.value).toBe(240);
    replayActive.value = true;
    expect(lookbackHours.value).toBe(504);
    scope.stop();
  });
});
