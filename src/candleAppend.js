export function isCandleAppend(previous,next) {
  return previous.length<=next.length && previous.every((c,i)=>c===next[i] || next[i]
    && c.time===next[i].time && c.open===next[i].open && c.high===next[i].high
    && c.low===next[i].low && c.close===next[i].close && c.ignored===next[i].ignored);
}
