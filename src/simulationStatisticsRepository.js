import {STATISTICS_PROJECTION_VERSION,projectionDataset} from './simulationStatisticsProjection.js';
import {decodeStatisticsIndex} from './simulationStatisticsIndex.js';

export function createStatisticsRepository(db) {
  async function source(runId,withIndex=false) {
    const {data,error}=await db.from('simulation_statistics_sources').select('revision,generation,version,group_count'+(withIndex?',index_data':'')).eq('run_id',runId).maybeSingle();
    if(error)throw error;
    return data;
  }
  return {
    getStatisticsSource:source,
    async listStatisticsCounts(runIds){
      const rows=[];let last;
      for(;;){let q=db.from('simulation_statistics_sources').select('run_id,group_count').in('run_id',runIds).not('generation','is',null).order('run_id').limit(500);
        if(last)q=q.gt('run_id',last);
        const {data,error}=await q;if(error)throw error;if(!data?.length)break;rows.push(...data);last=data.at(-1).run_id;
      }
      return new Map(rows.map(row=>[row.run_id,row.group_count]));
    },
    async listStatistics(runId) {
      const state=await source(runId,true);
      if(!state?.generation||!state.index_data||state.version!==STATISTICS_PROJECTION_VERSION)
        throw new Error('Die Statistikübersicht dieses Laufs muss vorbereitet werden. Die Originaldaten sind unverändert.');
      const rows=await decodeStatisticsIndex(state.index_data);
      if(rows.some(row=>row.summary.snapshot?.runId!==runId))throw new Error('Die Statistikantwort gehört nicht zum gewählten Lauf.');
      if(rows.length!==state.group_count)throw new Error('Die Statistikübersicht wurde während des Ladens geändert. Bitte aktualisieren.');
      const latest=await source(runId);
      if(latest?.generation!==state.generation||latest?.revision!==state.revision)throw new Error('Die Quelldaten wurden während des Ladens geändert. Bitte aktualisieren.');
      return {...projectionDataset(rows),generation:state.generation};
    },
    async getStatisticsPage(runId,generation,keys) {
      if(!keys.length)return [];
      if(keys.length>25)throw new Error('Eine Statistikseite enthält höchstens 25 DRs.');
      // Ein kleiner Schlüsselabruf bewahrt dieselbe Filterreihenfolge wie die Gesamtstatistik.
      const found=[];let remaining=keys;
      while(remaining.length){
        const {data,error}=await db.rpc('read_simulation_statistics_page',{p_run:runId,p_generation:generation,p_keys:remaining}).limit(25);
        if(error)throw error;if(!data?.length)throw new Error('Die DR-Seite ist nicht mehr vollständig verfügbar. Bitte aktualisieren.');
        found.push(...data);const ids=new Set(found.map(row=>row.key));
        // Auch ein niedriger Server-Rowcap darf keine DR still unterschlagen.
        const next=keys.filter(key=>!ids.has(key));
        if(next.length>=remaining.length)throw new Error('Die DR-Seite ist unvollständig.');
        remaining=next;
      }
      const byKey=new Map(found.map(row=>[row.key,row.summary]));
      if(keys.some(key=>!byKey.has(key)))throw new Error('Die DR-Seite ist unvollständig.');
      return keys.map(key=>byKey.get(key));
    },
    async getStatisticsDetail(runId,generation,key) {
      const {data,error}=await db.from('simulation_statistics_ranges').select('detail')
        .eq('run_id',runId).eq('generation',generation).eq('key',key).maybeSingle();
      if(error)throw error;if(!data)throw new Error('Der DR-Beleg ist nicht mehr verfügbar. Bitte aktualisieren.');
      return data.detail;
    },
  };
}
