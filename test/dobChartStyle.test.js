import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const remote=vi.hoisted(()=>({rows:[],upsert:vi.fn()}));
vi.mock('../src/supabaseClient.js',()=>({supabase:{from:()=>({select:async()=>({data:remote.rows,error:null}),upsert:remote.upsert})}}));
vi.mock('../src/orderBlocks.js',()=>({obZoneNaturalKey:(tf,dir,time)=>`${tf}|${dir}|${time}`,OrderBlockPrimitive:class{constructor(zone,options){this.options=options;}}}));
let saved;
beforeEach(()=>{vi.resetModules();vi.useFakeTimers();saved={tradeHover:'#123456',tradeLoss:{hex:'#654321',alpha:.4}};remote.rows=[{key:'tradeHover',hex:'#abcdef',alpha:.6}];remote.upsert.mockReset().mockResolvedValue({error:null});vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(saved),setItem:(_,v)=>saved=JSON.parse(v)});vi.stubGlobal('window',{});});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
it('fills legacy local/remote settings with independent DOB defaults and persists new DOB edits through the existing sync',async()=>{
 const m=await import('../src/chartColors.js');const {nextTick}=await import('vue');await nextTick();await nextTick();
 for(const key of ['dobConfirmed','dobLoss','dobHover','dobPin']){expect(m.DEFAULT_CHART_COLORS[key]).toBeDefined();expect(m.chartColors[key]).toEqual(m.DEFAULT_CHART_COLORS[key]);}
 expect(m.chartColors.tradeHover.hex).toBe('#abcdef');expect(m.chartColors.tradeLoss).toEqual({hex:'#654321',alpha:.4});
 expect(remote.upsert).not.toHaveBeenCalled();
 m.chartColors.dobConfirmed.hex='#102030';m.chartColors.dobConfirmed.alpha=.37;await nextTick();
 expect(saved.dobConfirmed).toEqual({hex:'#102030',alpha:.37});expect(saved.tradeHover.hex).toBe('#abcdef');
 await vi.advanceTimersByTimeAsync(500);
 expect(remote.upsert).toHaveBeenCalledWith(expect.arrayContaining([{key:'dobConfirmed',hex:'#102030',alpha:.37}]),{onConflict:'key'});
 expect(m.cssColor('dobConfirmed')).toBe('rgba(16, 32, 48, 0.37)');
 vi.resetModules();const reloaded=await import('../src/chartColors.js');await nextTick();expect(reloaded.chartColors.dobConfirmed).toEqual({hex:'#102030',alpha:.37});
 reloaded.resetChartColors();expect(reloaded.chartColors.dobConfirmed).toEqual(reloaded.DEFAULT_CHART_COLORS.dobConfirmed);
 expect(reloaded.chartColors.dobConfirmed).not.toBe(reloaded.chartColors.tradeHover);
});

it('recolors existing DOB data on redraw without coupling status or pin/hover colors to TS 1.0',async()=>{
 const {chartColors}=await import('../src/chartColors.js');const {renderDoubleOrderBlocks}=await import('../src/doubleOrderBlockRendering.js');
 const pair={id:'dob',direction:'long',recognizedAt:1000,firstOrderBlock:{dir:1,startTime:100},secondOrderBlock:{dir:1,startTime:400},entries:{a:{status:'ready',entryTime:1000,outcome:{status:'open'}}}};
 const series={attachPrimitive:vi.fn()},draw=()=>renderDoubleOrderBlocks(series,[pair],[],1100)[0].primitive.options;
 const before=draw();chartColors.dobConfirmed={hex:'#102030',alpha:.5};chartColors.dobHover={hex:'#405060',alpha:.7};chartColors.dobPin={hex:'#708090',alpha:.8};
 expect(draw()).toMatchObject({fillColor:'rgba(16, 32, 48, 0.06)',borderColor:'rgba(16, 32, 48, 0.5)',textColor:'rgba(16, 32, 48, 0.5)',hoverColor:'rgba(64, 80, 96, 0.7)',pinColor:'rgba(112, 128, 144, 0.8)'});
 expect(before.borderColor).not.toBe(draw().borderColor);expect(pair.entries.a.outcome.status).toBe('open');
 expect(chartColors.tradeLoss.hex).toBe('#654321');
});
