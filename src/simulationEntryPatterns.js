import {entryPatternVersion} from './entryPattern.js';
import {isEntryPattern1} from './entryPattern1Conditions.js';
import {isEntryPattern2} from './entryPattern2Conditions.js';

export const SIMULATION_ENTRY_PATTERN_LABELS={pattern1:'Entry Pattern 1',pattern2:'Entry Pattern 2',both:'Beide Patterns am selben Entry',unknown:'Entry Pattern nicht belegt'};
const order=['pattern1','pattern2','unknown'];
const sorted=values=>order.filter(key=>values.includes(key));

// Die Pattern-Version gehört zum Entry-Beleg, nicht zu seiner Full-/Half-Größe oder zur Laufversion.
export function simulationEntryPatterns(snapshot){
 const entry=snapshot?.entry;if(!entry)return [];
 const own=entryPatternVersion(entry),matches=entry.patternMatches ?? [];
 const versions=[...(own?[own]:[]),...matches.map(entryPatternVersion)];
 return sorted((versions.length?versions:[null]).map(version=>isEntryPattern1(version)?'pattern1':isEntryPattern2(version)?'pattern2':'unknown'));
}
export const simulationGroupEntryPatterns=group=>sorted(group.entries.flatMap(simulationEntryPatterns));
export function matchesSimulationEntryPattern(snapshot,pattern){
 const patterns=simulationEntryPatterns(snapshot);
 return pattern==='both'?patterns.includes('pattern1')&&patterns.includes('pattern2'):patterns.includes(pattern);
}
