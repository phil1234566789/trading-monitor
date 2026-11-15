const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../../src/orderBlocks.js');
const code=fs.readFileSync(source,'utf8').match(/export function orderBlockEndTime\(zone, openEnd = Infinity\) \{[\s\S]*?\n\}/)[0].replace('export ','');
const penetration=fs.readFileSync(path.join(path.dirname(source),'orderBlockPenetration.js'),'utf8').replaceAll('export ','');
const detection=fs.readFileSync(path.join(path.dirname(source),'orderBlockDetection.js'),'utf8');
const predicates=['candleTouchesOrderBlock','candleInvalidatesOrderBlock'].map(name=>detection.match(new RegExp('export function '+name+'[\\s\\S]*?\\n\\}'))[0].replace('export ','')).join('\n');
fs.writeFileSync(path.join(__dirname,'ob-reaction-rendering.js'),`// Unveränderte Helper-Snapshots aus src/orderBlocks.js:21, orderBlockPenetration.js und orderBlockDetection.js.\n(function(root){\n${code}\n${penetration}\n${predicates}\n// Alle nativen OB-/FVG-Datensätze liefern firstOverlap; finale Lifecycleflags bleiben unbenutzt.\nfunction zoneEndAt(zone,asOf){const touch=zone.firstOverlap;return Math.min(asOf,orderBlockEndTime(touch&&touch.knownAt<=asOf?{touchedTime:touch.candleTime}:{},asOf));}\nconst api={orderBlockEndTime,zoneEndAt,measureOrderBlockPenetration,candleTouchesOrderBlock,candleInvalidatesOrderBlock};if(typeof module!=='undefined')module.exports=api;root.OBReactionRendering=api;\n})(globalThis);\n`);
console.log('Original orderBlockEndTime unverändert übernommen.');
