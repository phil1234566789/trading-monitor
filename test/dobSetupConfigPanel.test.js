import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';

// Ein frisch angelegtes Zeitfenster ändert nichts, bis Philip es bewusst anhakt (enabled:false wirkt laut dobRuleActive nirgends).
it('„+ Zeitfenster“ legt das Fenster abgeschaltet an',()=>{
 const source=readFileSync(new URL('../src/components/DobSetupConfigPanel.vue',import.meta.url),'utf8');
 const push=source.match(/function addWindow\(\)\{draft\.value\.entryWindows\.push\((\{[^}]*\})\)/);
 expect(push?.[1]).toContain('enabled:false');
});
