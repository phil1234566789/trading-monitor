import { describe, it, expect, vi } from "vitest";
vi.mock("../src/supabaseClient.js", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
import { supabase } from "../src/supabaseClient.js";
import { watcherHealth, watcherTime, testPushover, setup2AlarmRow } from "../src/algoWatcher.js";

describe("server-verified Algo Watcher", () => {
  const report = { state: "live", pulse: true, reason: "ok", validUntil: "2026-10-07T12:00:00Z" };
  it("expires server health even if browser traffic is successful", () => {
    expect(watcherHealth(report, Date.parse("2026-10-07T11:59:59Z"))).toMatchObject({ state: "live", pulse: true });
    expect(watcherHealth(report, Date.parse(report.validUntil))).toMatchObject({ state: "error", pulse: false });
    expect(watcherHealth({ ...report, validUntil: null })).toMatchObject({ state: "error", pulse: false });
  });
  it("never pulses for waiting, error or off", () => {
    for (const state of ["waiting", "error", "off"]) expect(watcherHealth({ ...report, state }, 0).pulse).toBe(false);
  });
  it("formats candle seconds and server ISO timestamps in Berlin", () => {
    expect(watcherTime("2026-10-07T12:00:00Z")).toContain("14:00:00");
    expect(watcherTime(Date.parse("2026-10-07T12:00:00Z") / 1000)).toContain("14:00:00");
  });
  it("sends only password to the fixed server endpoint", async () => {
    supabase.functions.invoke.mockResolvedValueOnce({ data: { accepted: true }, error: null });
    expect(await testPushover("example")).toBe(true);
    expect(supabase.functions.invoke).toHaveBeenLastCalledWith("pushover-test", { body: { password: "example" } });
    supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 401 }, message: "unsafe body" } });
    await expect(testPushover("wrong")).rejects.toThrow("Passwort nicht akzeptiert");
  });
  it("labels safe DR warnings as history with no required user intervention", () => {
    expect(setup2AlarmRow({id:'warning',stage:0,kind:'problem',setup_key:'DR13590',payload:{category:'range-warning',message:'History unknown; no entry'}}))
      .toMatchObject({typeLabel:'DR-Warnung',detail:'DR DR13590 · History unknown; no entry',deliveryLabel:'Nur Protokoll · kein Eingreifen erforderlich'});
  });
  it("keeps missed signal and detection time distinct with DR and reason", () => {
    expect(setup2AlarmRow({ id: "a", stage: 2, setup_key: "3070", signal_at: "s", detected_at: "d", missed_reason: "Runner war offline", kind: "trading", direction: "long" }))
      .toMatchObject({ time: "s", detectedAt: "d", detail: "DR 3070 · Runner war offline", deliveryLabel: "Verpasst · Protokollhinweis" });
  });
});
