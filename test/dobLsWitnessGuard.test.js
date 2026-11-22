import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {dobTs11FromRow} from '../src/dobLqSweepPoi.js';
import {dobPoiFeatures} from '../src/dobTradeFeatures.js';

// Chart = Alarm für das LS des LQ-Sweep-POI: Lauf (Statistik; der Chart liest dessen features) und dob-watcher (Alarm) bauen den POI
// aus derselben Zeile UND demselben Urteil. Ein `.map(dobTs11FromRow)` ohne Urteil fiele still auf die Primär-LS zurück.
const source=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
it.each(['scripts/dobTradeSetupsFill.mjs','supabase/functions/dob-watcher/index.ts'])('%s übergibt das TS1.1-Urteil an dobTs11FromRow',p=>{
 const s=source(p);
 expect(s).not.toMatch(/map\(\s*dobTs11FromRow\s*\)/);
 expect(s).toMatch(/dobTs11FromRow\(\s*\w+\s*,\s*[\w.]+/);
});

it('Chart-Feature und Alarm-POI tragen dasselbe LS',()=>{
 const row={id:7,direction:'short',ob_top:10,ob_bottom:9,ob_start_time:'2026-10-08T08:35:00Z',ls_price:9.5,ls_pivot_time:'2026-10-08T07:20:00Z',
  ls_touched_time:'2026-10-08T08:15:00Z'};
 const ts=dobTs11FromRow(row,{status:'passed',witness:{price:9.8,pivotTime:100,touchedTime:200,timeframe:'5M',sourceKind:'orderBlock'}});
 const poi={kind:'ts11',tradeSetupId:ts.id,lsPrice:ts.lsPrice,lsPivotTime:ts.lsPivotTime,lsTouchedTime:ts.lsTouchedTime};
 expect(dobPoiFeatures(poi)).toMatchObject({poi_ls_price:9.8,poi_ls_pivot_time:100,poi_ls_touched_time:200});
});
