import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

// Vue meckert nicht, wenn ein PascalCase-Tag im Template zu keinem Import passt — es rendert
// stillschweigend ein unbekanntes HTML-Element. Kein Build-Fehler, kein Test-Fehler, nur eine
// Seite ohne jedes Styling (23.09.: <ToggleButton> in Dashboard.vue ohne Import = komplette
// Toolbar unformatiert, erst im Browser aufgefallen).
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function vueFiles(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) vueFiles(p, out);
    else if (e.name.endsWith('.vue')) out.push(p);
  }
  return out;
}

// Von Vue selbst bereitgestellt bzw. global registriert — brauchen keinen Import.
const BUILTIN = new Set([
  'Transition', 'TransitionGroup', 'KeepAlive', 'Teleport', 'Suspense',
  'RouterView', 'RouterLink',
]);

it('jedes PascalCase-Tag im Template hat einen Import', () => {
  const missing = [];
  for (const file of vueFiles('src')) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    const template = src.slice(src.indexOf('<template>'));
    const imported = new Set(
      [...src.matchAll(/^import\s+(\w+)\s+from/gm)].map((m) => m[1]),
    );
    // <script setup> darf sich selbst per Dateiname referenzieren (JsonTree rendert sich rekursiv).
    const self = file.slice(file.lastIndexOf('/') + 1, -'.vue'.length);
    for (const [, tag] of template.matchAll(/<([A-Z]\w*)[\s/>]/g)) {
      if (BUILTIN.has(tag) || imported.has(tag) || tag === self) continue;
      if (missing.includes(`${file}: <${tag}>`)) continue;
      missing.push(`${file}: <${tag}>`);
    }
  }
  expect(missing, `Tag ohne passenden Import:\n${missing.join('\n')}`).toEqual([]);
});
