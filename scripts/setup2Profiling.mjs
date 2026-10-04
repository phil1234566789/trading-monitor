// Nur Messbundles instrumentieren: Browsercode und Ergebnisobjekte bleiben unverändert.
export function setup2ProfilingPlugin() {
  const names=new Set(['evaluateCountertrendChecklist','evaluateCountertrendLifecycle',
    'evaluateCountertrendEntryModel1','detectOrderBlocks','closedChecklistCandles',
    'withCandleCloseWindow','buildLevel','detectLiquidityLevels','evaluateAt','evaluateChecklistM5']);
  return {name:'setup2-profiling',renderChunk(code){
    const tree=this.parse(code),edits=[];
    function visit(node,parent){
      const name=node.type==='FunctionDeclaration'?node.id?.name:
        node.type==='ArrowFunctionExpression'&&parent?.type==='VariableDeclarator'?parent.id.name:null;
      if(names.has(name)&&node.body?.type==='BlockStatement'
        && !node.body.body.some(s=>s.type==='VariableDeclaration'&&s.declarations.some(d=>d.id.name==='__h'))){
        const args=node.type==='FunctionDeclaration'?'arguments': '[at]';
        edits.push([node.body.start+1,`const __h=globalThis.__setup2Profile;const __t=__h?.start(${JSON.stringify(name)},${args});try{`]);
        edits.push([node.body.end-1,'}finally{if(__h)__h.end(__t);}']);
      }
      if(name==='createSetup2Memo'){
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
      'get: (key) => (globalThis.__setup2Profile?.memoGet(entries.has(key)), entries.get(key))');
    return {code,map:null};
  }};
}

export function createSetup2Profile(){
  const functions={},stack=[],memo={hits:0,misses:0};
  return {functions,memo,memoGet(hit){memo[hit?'hits':'misses']++;},start(name,args){
    const rows=Array.isArray(args[0])?args[0]:args[0]?.m5Candles;
    const stats=functions[name]??={calls:0,totalMs:0,selfMs:0,prefixTotal:0,prefixMax:0};
    stats.calls++;stats.prefixTotal+=rows?.length??0;stats.prefixMax=Math.max(stats.prefixMax,rows?.length??0);
    const token={stats,at:performance.now(),children:0};stack.push(token);return token;
  },end(token){
    const elapsed=performance.now()-token.at;token.stats.totalMs+=elapsed;token.stats.selfMs+=elapsed-token.children;
    stack.pop();if(stack.length)stack.at(-1).children+=elapsed;
  }};
}
