import { describe, it, expect } from "vitest";
import { isNewVersion, reloadUrl } from "../src/appVersion.js";

describe("appVersion", () => {
  it("meldet nur einen echten, abweichenden SHA", () => {
    expect(isNewVersion("abc", "abc")).toBe(false);
    expect(isNewVersion("abc", "def")).toBe(true);
    expect(isNewVersion("abc", undefined)).toBe(false);
    expect(isNewVersion(undefined, "def")).toBe(false);
  });

  it("setzt den Cache-Brecher vor den Hash", () => {
    expect(reloadUrl({ pathname: "/trading-monitor/", hash: "#/protokoll?x=1" }, "def")).toBe("/trading-monitor/?v=def#/protokoll?x=1");
    expect(reloadUrl({ pathname: "/trading-monitor/", hash: "" }, "def")).toBe("/trading-monitor/?v=def");
  });
});
