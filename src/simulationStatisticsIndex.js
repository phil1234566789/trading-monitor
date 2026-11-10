export async function encodeStatisticsIndex(rows) {
 const json=JSON.stringify(rows.map(({key,summary,results,orders})=>({key,summary,results,orders})));
 const bytes=new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
 const chunks=[];
 for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
 return btoa(chunks.join(''));
}

export async function decodeStatisticsIndex(encoded) {
 const bytes=Uint8Array.from(atob(encoded),character=>character.charCodeAt(0));
 const json=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 const rows=JSON.parse(json);
 if(!Array.isArray(rows)||new Set(rows.map(row=>row.key)).size!==rows.length||rows.some(row=>!row.key||row.summary?.key!==row.key||!Array.isArray(row.results)||!Array.isArray(row.orders)||row.results.length!==row.orders.length))
  throw new Error('Die vorbereitete Statistikantwort ist unvollständig.');
 return rows;
}
