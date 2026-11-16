// Minimaler Deno-Ersatz, damit *.test.ts gegen Edge-Function-Code unter Vitest real laufen
// (Deno.test/env/readTextFile). Nur was die Tests und der importierte Code tatsächlich anfassen;
// fehlt etwas, soll es laut mit "is not a function" scheitern statt still zu stubben.
import { readFile } from "node:fs/promises";
import { test } from "vitest";

globalThis.Deno ??= {
  test: (name, fn) => test(name, fn),
  env: {
    get: (key) => process.env[key],
    set: (key, value) => { process.env[key] = value; },
  },
  readTextFile: (path) => readFile(path, "utf-8"),
};
