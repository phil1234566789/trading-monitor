const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'../../src'),modules=new Map(),sources=[];
function add(name){if(modules.has(name))return;const file=path.join(repo,name),raw=fs.readFileSync(file,'utf8');modules.set(name,'');sources.push({path:path.relative(path.resolve(repo,'..'),file).replaceAll('\\','/'),sha256:crypto.createHash('sha256').update(raw.replaceAll('\r\n','\n')).digest('hex')});const names=[];
 let code=raw.replace(/import\s*\{([\s\S]*?)\}\s*from\s*['"](.+?)['"];?/g,(_,keys,dep)=>{const id=path.posix.normalize(path.posix.join(path.posix.dirname(name),dep));add(id);return 'const {'+keys.replace(/\bas\b/g,':')+'}=require('+JSON.stringify(id)+');';});
 code=code.replace(/export\s*\{([^}]+)\}\s*from\s*['"](.+?)['"];?/g,(_,keys,dep)=>{const id=path.posix.normalize(path.posix.join(path.posix.dirname(name),dep));add(id);return keys.split(',').map(k=>'exports.'+k.trim()+'=require('+JSON.stringify(id)+').'+k.trim()+';').join('');});
 code=code.replace(/export\s+(function|const|class|let)\s+(\w+)/g,(_,type,id)=>{names.push(id);return type+' '+id;});
 code=code.replace(/export\s*\{([^}]+)\};?/g,(_,keys)=>{names.push(...keys.split(',').map(k=>k.trim()));return '';});
 if(/\b(import|export)\s/.test(code.replace(/\/\/[^\n]*/g,'')))throw Error('Unsupported module syntax '+name);
 modules.set(name,code+'\nObject.assign(exports,{'+[...new Set(names)].join(',')+'});');}
for(const name of['m1FvgEntryProjection.js','fvgCandleTint.js'])add(name);
const body=[...modules].map(([id,code])=>JSON.stringify(id)+':function(require,exports){\n'+code+'\n}').join(',\n');
fs.writeFileSync(path.join(__dirname,'ob-reaction-entry-source.js'),'// Unveränderte Dashboard-Module, nur Import/Export für file:// gekapselt. Sourcepfade/SHA: ob-reaction-entry-source-manifest.json.\n(function(root){const modules={'+body+'},cache={};function require(id){if(!cache[id]){cache[id]={};modules[id](require,cache[id]);}return cache[id];}root.OBReactionEntrySource={...require("m1FvgEntryProjection.js"),...require("fvgCandleTint.js")};})(globalThis);\n');
fs.writeFileSync(path.join(__dirname,'ob-reaction-entry-source-manifest.json'),JSON.stringify({sha256Format:'UTF-8 with LF line endings',sources,colors:{fvgCandle:'#ffd54f',tradeConnector:'#fd80ff'},colorSource:'PROD chart_colors read-only 2026-11-15; no preferences writes'},null,2));console.log('Unveränderte Dashboard-Module:',sources.length);
