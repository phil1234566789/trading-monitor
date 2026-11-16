import {readFileSync,existsSync,statSync} from 'node:fs';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect,it} from 'vitest';

// Die Edge Function dob-watcher importiert die DOB-Erkennung direkt aus src/. Deno bündelt nur Importe mit Dateiendung;
// ein neuer Import ohne Endung irgendwo in der Kette bricht den nächsten Deploy (passiert durch dobTradeStatistics.js).
it('dob-watcher: jeder relative Laufzeit-Import hat eine Dateiendung',()=>{
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),seen=new Set(),bad=[];
 const walk=file=>{
  if(seen.has(file))return;
  seen.add(file);
  const source=readFileSync(file,'utf8');
  for(const [statement,spec] of source.matchAll(/^\s*(?:import|export)\s+(?!type\b)[^'"]*?from\s*['"](\.[^'"]+)['"]/gm)){
   const target=resolve(dirname(file),spec);
   if(!existsSync(target)||statSync(target).isDirectory()){bad.push(`${relative(root,file)}: ${statement.trim()}`);continue;}
   walk(target);
  }
 };
 walk(resolve(root,'supabase/functions/dob-watcher/index.ts'));
 expect(bad).toEqual([]);
 expect(seen.size).toBeGreaterThan(20);
});
