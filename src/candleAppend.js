export function isCandleAppend(previous,next) {
  return previous.length<=next.length && previous.every((c,i)=>JSON.stringify(c)===JSON.stringify(next[i]));
}
