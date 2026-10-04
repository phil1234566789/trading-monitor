// Nur Messbundles instrumentieren: Browsercode und Ergebnisobjekte bleiben unverändert.
export function setup2ProfilingPlugin() {
  const names=new Set(['evaluateCountertrendChecklist','evaluateCountertrendLifecycle',
    'evaluateCountertrendEntryModel1','detectOrderBlocks','closedChecklistCandles',
    'withCandleCloseWindow','buildLevel','detectLiquidityLevels','evaluateAt','evaluateChecklistM5',
    'advanceOrderBlocks','orderBlockSnapshot','detectIncrementalOrderBlocks','isCandleAppend',
    'detectIncrementalLiquidityLevels']);
  return {name:'setup2-profiling',renderChunk(code){
    const tree=this.parse(code),edits=[];
    function visit(node,parent){
      const name=['FunctionDeclaration','FunctionExpression'].includes(node.type)?node.id?.name:
        node.type==='ArrowFunctionExpression'&&parent?.type==='VariableDeclarator'?parent.id.name:null;
      if(names.has(name)&&node.body?.type==='BlockStatement'
        && !node.body.body.some(s=>s.type==='VariableDeclaration'&&s.declarations.some(d=>d.id.name==='__h'))){
        const args=node.type==='ArrowFunctionExpression'?'[at,m5]':'arguments';
        edits.push([node.body.start+1,`const __h=globalThis.__setup2Profile;const __t=__h?.start(${JSON.stringify(name)},${args});try{`]);
        edits.push([node.body.end-1,'}finally{if(__h)__h.end(__t);}']);
      }
      if(name==='createSetup2Memo' && !code.slice(node.body.start,node.body.end).includes('__profileMemo')){
        edits.push([node.body.start+1,'const __profileMemo=globalThis.__setup2Profile?.createMemo();']);
        const body=code.slice(node.body.start,node.body.end);
        const getter=/get:\s*\(key\)\s*=>\s*entries\.get\(key\)/.exec(body);
        if(!getter)throw new Error('Memo instrumentation no longer matches');
        const at=node.body.start+getter.index;
        edits.push([at,`__MEMO_MARKER__`]);
      }
      for(const value of Object.values(node)){
        if(Array.isArray(value)){for(const child of value)if(child?.type)visit(child,node);}
        else if(value?.type)visit(value,node);
      }
    }
    visit(tree);
    for(const [at,text] of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,at)+text+code.slice(at);
    code=code.replace(/__MEMO_MARKER__get:\s*\(key\)\s*=>\s*entries\.get\(key\)/,
      'get: (key) => (globalThis.__setup2Profile?.memoGet(__profileMemo,entries.has(key)), entries.get(key))');
    return {code,map:null};
  }};
}

// Gefrorene Messbundles enthalten Zähler. Kontrollläufe entfernen sie vollständig,
// damit Millionen kurzer Aufrufe nicht nur den Aufwand des Profilers einsparen.
export function setup2WithoutProfilingPlugin() {
  return {name:'setup2-without-profiling',renderChunk(code){
    const tree=this.parse(code),edits=[];
    function visit(node){
      if(node.type==='BlockStatement' && node.body[0]?.type==='VariableDeclaration'
        && node.body[0].declarations[0]?.id.name==='__h'
        && node.body[1]?.declarations?.[0]?.id.name==='__t'
        && node.body[2]?.type==='TryStatement'){
        const run=node.body[2];
        edits.push([node.body[0].start,run.block.start+1],[run.block.end-1,run.end]);
      }
      for(const value of Object.values(node)){
        if(Array.isArray(value)){for(const child of value)if(child?.type)visit(child);}
        else if(value?.type)visit(value);
      }
    }
    visit(tree);
    for(const [from,to] of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,from)+code.slice(to);
    return {code,map:null};
  }};
}

export function createSetup2Profile(){
  const functions={},stack=[],memo={hits:0,misses:0},memos=[];
  return {functions,memo,memos,createMemo(){const stats={id:memos.length,hits:0,misses:0};memos.push(stats);return stats;},
    memoGet(stats,hit){const key=hit?'hits':'misses';memo[key]++;if(stats)stats[key]++;},start(name,args){
    const rows=Array.isArray(args[0])?args[0]:args[0]?.m5Candles??args[0]?.context?.m5Candles
      ??args[0]?.candles??(Array.isArray(args[1])?args[1]:null);
    let length=rows?.length??0;
    if(name==='evaluateAt'){
      let lower=0,upper=length;
      while(lower<upper){const mid=(lower+upper)>>>1;if(rows[mid].time+300<=args[0])lower=mid+1;else upper=mid;}
      length=lower;
    }
    const stats=functions[name]??={calls:0,totalMs:0,selfMs:0,prefixTotal:0,prefixMax:0};
    if(name==='evaluateChecklistM5'){
      const key=JSON.stringify([length,rows?.[0]?.time,rows?.at(-1)?.time,args[2],
        args[1]?.m5StructurePeriod??5,args[1]?.m5Structure2Period??2]);
      stats.prefixKeys??={};stats.prefixKeys[key]=(stats.prefixKeys[key]??0)+1;
    }
    stats.calls++;stats.prefixTotal+=length;stats.prefixMax=Math.max(stats.prefixMax,length);
    const token={stats,at:performance.now(),children:0};stack.push(token);return token;
  },end(token){
    const elapsed=performance.now()-token.at;token.stats.totalMs+=elapsed;token.stats.selfMs+=elapsed-token.children;
    stack.pop();if(stack.length)stack.at(-1).children+=elapsed;
  }};
}
