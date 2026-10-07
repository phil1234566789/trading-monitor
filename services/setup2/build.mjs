import {mkdir} from 'node:fs/promises';
import {rolldown} from 'rolldown';
await mkdir('.debug/t68/release',{recursive:true});
const bundle=await rolldown({input:'services/setup2/runner.mjs',platform:'node'});
await bundle.write({format:'esm',file:'.debug/t68/release/runner.mjs'});
await bundle.close();
