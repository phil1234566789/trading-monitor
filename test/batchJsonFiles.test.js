import {afterAll,describe,it,expect,vi} from 'vitest';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {writeJson} from '../scripts/tradeSetup2Archive.mjs';
const directory=await mkdtemp(join(tmpdir(),'setup2-json-'));
afterAll(()=>rm(directory,{recursive:true,force:true}));
describe('large batch JSON files',()=>{
 it('serializes each array record without allocating a whole-array string',async()=>{
  const file=join(directory,'rows.json'),rows=[{id:'one',text:'ä🙂,[{\\"'},{id:'two',nested:[null,{},'\n']}];
  const stringify=JSON.stringify,spy=vi.spyOn(JSON,'stringify').mockImplementation((value,...rest)=>{if(Array.isArray(value))throw new Error('whole array exceeds V8 string limit');return stringify(value,...rest);});
  try{await writeJson(file,rows);}finally{spy.mockRestore();}
  expect(await readFile(file,'utf8')).toBe(stringify(rows));
 });
 it.each([null,{absent:undefined,present:null,value:NaN},[undefined,null,NaN,Infinity],Array(3)])('keeps standard compact JSON semantics %#',async value=>{
  const file=join(directory,'semantics.json');await writeJson(file,value);expect(await readFile(file,'utf8')).toBe(JSON.stringify(value));
 });
 it('preserves the previous final file if serialization aborts between records',async()=>{
  const file=join(directory,'abort.json');await writeFile(file,'{"original":true}');
  await expect(writeJson(file,[{id:'written'},{invalid:1n}])).rejects.toThrow();
  expect(await readFile(file,'utf8')).toBe('{"original":true}');
  const partial=await readFile(file+'.tmp','utf8');expect(partial).toContain('written');expect(()=>JSON.parse(partial)).toThrow();
 });
});
import {readJsonArray} from '../scripts/batchJsonFiles.mjs';
describe('streamed JSON reads',()=>{
 const rows=[null,true,-1.5,'ä🙂,[{\\"',{nested:[null,{},'\n']},[1,2]];
 it.each([1,2,7,65536])('matches JSON.parse across UTF-8/token boundaries (%s bytes)',async highWaterMark=>{
  const file=join(directory,'read-'+highWaterMark+'.json');await writeFile(file,JSON.stringify(rows));const found=[];for await(const row of readJsonArray(file,{highWaterMark}))found.push(row);expect(found).toEqual(rows);
 });
 it.each(['[{"a":1}','[1,]','[1 2]','[] false','{}'])('rejects incomplete or malformed input %s',async raw=>{
  const file=join(directory,'broken.json');await writeFile(file,raw);await expect((async()=>{for await(const row of readJsonArray(file))void row;})()).rejects.toThrow();
 });
 it('reads an empty array',async()=>{const file=join(directory,'empty.json');await writeFile(file,' [ ]\n');const rows=[];for await(const row of readJsonArray(file))rows.push(row);expect(rows).toEqual([]);});
});
