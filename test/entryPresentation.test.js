import {describe,it,expect} from 'vitest';
import {createSSRApp} from 'vue';
import {renderToString} from '@vue/server-renderer';
import {createRouter,createMemoryHistory} from 'vue-router';
import {entryCategorySizeLabel,entryLotsLabel,entryBudgetLabel,entryOptionalConditionLabel} from '../src/entryPresentation.js';
import SimulationEntryTable from '../src/components/SimulationEntryTable.vue';
import SimulationEntryResult from '../src/components/SimulationEntryResult.vue';
import SimulationResultsTable from '../src/components/SimulationResultsTable.vue';
const entry=category=>({id:'entry',recognizedAt:3000,price:1.3,entryCategory:category,optionalConditionsMissing:category==='risky'?['m5Bos']:[],
  sizing:{positionSizeFactor:category==='risky'?0.5:1}});
const snapshot=category=>({id:'snapshot',runId:'run',instrument:'GBPUSD',entry:entry(category)});
const result=category=>({snapshotId:'snapshot',runId:'run',variant:'wide',entryId:'entry',entryTime:3000,instrument:'GBPUSD',
  entryCategory:category,optionalConditionsMissing:category==='risky'?['m5Bos']:[],positionSizeFactor:category==='risky'?0.5:1,
  lots:category==='risky'?3:7,fullLots:7,riskBudget:category==='risky'?250:500,fullRiskBudget:500,actualRisk:210,status:'open'});
async function render(component,props){
  const app=createSSRApp(component,props);app.use(createRouter({history:createMemoryHistory(),routes:[{path:'/',component:{render:()=>null}}]}));
  return renderToString(app);
}
describe('explicit entry category presentation',()=>{
  it('shows relative sizing separately from saved whole lots, without changing the source',()=>{
    const row=result('risky'),before=JSON.stringify(row);
    expect(entryCategorySizeLabel(row)).toBe('Risky Entry · 50 % der Full-Größe');
    expect(entryLotsLabel(row)).toBe('3 Lots · Full: 7 Lots');
    expect(entryBudgetLabel(row)).toContain('250');expect(entryBudgetLabel(row)).toContain('500');
    expect(entryOptionalConditionLabel(row)).toBe('Optionaler M5-BOS fehlt');expect(JSON.stringify(row)).toBe(before);
    expect(entryCategorySizeLabel(result('full'))).toBe('Full Entry · 100 % der Full-Größe');
    expect(entryCategorySizeLabel({entryCategory:'risky'})).toContain('Relative Größe nicht gespeichert');
  });
  it('does not classify historical half-size metadata or invent a Full reference',()=>{
    const historic={entrySizing:{factor:0.5,reason:'m5ChochMissing'},lots:3,riskBudget:250};
    expect(entryCategorySizeLabel(historic)).toContain('Historischer Stand');
    expect(entryCategorySizeLabel(historic)).not.toMatch(/Risky Entry|Full Entry/);
    expect(entryLotsLabel(historic)).toBe('3 Lots');expect(entryBudgetLabel(historic)).not.toContain('Full:');
    expect(entryOptionalConditionLabel(historic)).toBe('');
  });
  it.each(['full','risky'])('renders category, relative size and actual/full lots in all statistics views (%s)',async category=>{
    const saved=snapshot(category),row=result(category);
    for(const [component,props] of [[SimulationEntryTable,{entries:[saved],results:[row]}],
      [SimulationEntryResult,{snapshot:saved,results:[row],variant:'wide'}],[SimulationResultsTable,{rows:[row],runId:'run'}]]) {
      const html=await render(component,props);
      expect(html).toContain(category==='risky'?'Risky Entry':'Full Entry');
      expect(html).toContain(category==='risky'?'50 % der Full-Größe':'100 % der Full-Größe');
      expect(html).toContain(category==='risky'?'3 Lots · Full: 7 Lots':'7 Lots · Full: 7 Lots');
      expect(html.includes('Optionaler M5-BOS fehlt')).toBe(category==='risky');
    }
  });
});
