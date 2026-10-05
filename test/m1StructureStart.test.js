import { describe,it,expect } from 'vitest';
import { resolveM1SweepStart, m1StructureRows } from '../src/m1StructureStart.js';
const c=(time,high=9)=>({time,open:8,close:8,high,low:7});
const primary={direction:'short',sweep:{timeframe:'1H',level:{touchedTime:3600,price:10}}};
describe('actual M1 sweep start and P5-only support',()=>{
  it('resolves H1 within its source bar instead of its open or first five minutes',()=>{
    const rows=Array.from({length:60},(_,i)=>c(3600+i*60,i===33?10:9));
    expect(resolveM1SweepStart(primary,rows,7200)).toMatchObject({structureFrom:5580,recognizedAt:5640,sourceTime:3600});
    expect(resolveM1SweepStart(primary,rows.filter(r=>r.time!==3660),7200)).toBeNull();
    expect(resolveM1SweepStart(primary,rows,5639)).toBeNull();
  });
  it('never borrows a touch outside the source timeframe',()=>{
    const p={...primary,sweep:{...primary.sweep,timeframe:'5M'}};
    const rows=Array.from({length:7},(_,i)=>c(3600+i*60,i===5?11:9));
    expect(resolveM1SweepStart(p,rows,4020)).toBeNull();
    expect(resolveM1SweepStart({...p,direction:'long',sweep:{...p.sweep,level:{touchedTime:3600,price:7}}},rows,4020))
      .toMatchObject({structureFrom:3600});
  });
  it('retains at most nine usable left candles, including gaps/ignored rows without treating them as support',()=>{
    const rows=Array.from({length:20},(_,i)=>({...c(i*60),ignored:i===9}));
    const result=m1StructureRows(rows,900,1200);
    expect(result.filter(r=>r.time<900&&!r.ignored)).toHaveLength(9);
    expect(result[0].time).toBe(300);
    expect(result.at(-1).time).toBe(1140);
  });
});
