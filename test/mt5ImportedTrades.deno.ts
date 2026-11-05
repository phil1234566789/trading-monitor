import assert from 'node:assert/strict';
import {readImportedTrades} from '../supabase/functions/trading-monitor-mcp/mt5ImportedTrades.ts';
Deno.test('CSV history reads every short page and only fields needed by the private statistics UI',async()=>{
 const cursors:number[]=[];
 const db={from(table:string){assert.equal(table,'mt5_imported_trades');return {
  select(fields:string){assert.ok(!fields.includes('source_row'));return this;},
  gt(_field:string,after:number){cursors.push(after);return this;},order(){return this;},
  limit(){const after=cursors.at(-1);return Promise.resolve({data:after===0?[{id:4}]:after===4?[{id:9}]:[],error:null});}
 };}};
 const rows=await readImportedTrades(db as any);
 assert.deepEqual(rows.map(row=>row.id),[4,9]);
 assert.deepEqual(cursors,[0,4,9]);
});
