import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

// Ein frisch angelegtes Zeitfenster ändert nichts, bis Philip es bewusst anhakt (enabled:false wirkt laut dobRuleActive nirgends).
it('„+ Zeitfenster“ legt das Fenster abgeschaltet an',()=>{
 const source=readFileSync(new URL('../src/components/DobGuardrailsPanel.vue',import.meta.url),'utf8');
 const push=source.match(/entryWindows\.push\((\{[^}]*\})\)">\+ Zeitfenster/);
 expect(push?.[1]).toContain('enabled:false');
});
