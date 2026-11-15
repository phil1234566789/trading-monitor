import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {isChartOrderBlockTimeframe} from '../src/chartOrderBlockPin.js';

it('adds only M1 to the existing OB timeframe constraint without rewriting data or access rules',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261115133000_ob_zones_allow_1m.sql',import.meta.url),'utf8');
 expect(sql).toMatch(/check\s*\(timeframe in \('1H', '4H', '5M', '1M'\)\)/i);
 expect(sql).toContain('drop constraint ob_zones_timeframe_check');
 expect(sql).not.toMatch(/\b(?:update|delete|insert|grant|revoke|disable)\b/i);
 expect(sql).not.toContain("'3M'");
 for(const tf of ['1M','5M','1m','5m'])expect(isChartOrderBlockTimeframe(tf)).toBe(true);
 for(const tf of ['3M','1H','4H',undefined,'invalid'])expect(isChartOrderBlockTimeframe(tf)).toBe(false);
});
