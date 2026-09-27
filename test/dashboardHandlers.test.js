import { readFileSync } from "node:fs";
import { compileScript, parse } from "@vue/compiler-sfc";
import { expect, it } from "vitest";

it("defines every direct Dashboard event handler", () => {
  const source = readFileSync(new URL("../src/views/Dashboard.vue", import.meta.url), "utf8");
  const { descriptor } = parse(source);
  const { bindings } = compileScript(descriptor, { id: "dashboard" });
  const handlers = [...descriptor.template.content.matchAll(/@[\w:-]+="([\w$]+)"/g)].map((match) => match[1]);
  expect([...new Set(handlers)].filter((handler) => !(handler in bindings))).toEqual([]);
});
