// Kerzenmuster (Philip, DOB-PA): rein und ohne Abhängigkeiten, damit Labor, später Watcher und Chart dieselbe Definition nutzen.
// Abgeleitet aus Philips Beispielen (XAU M5, 28.08.2026, Tests in test/candlePatterns.test.js): Die Farbe zählt beim Hammer nicht,
// 15:15 ist rot und trotzdem „bullischer Hammer“, 15:05 grün und „bärischer Hammer“. Entscheidend ist der lange Docht.
// bull = langer unterer Docht (Hammer), bear = langer oberer Docht (Shooting Star/Inverted Hammer, Philips „bärischer Hammer“).
export const HAMMER_MAX_BODY=1/3,HAMMER_MIN_WICK=0.6,HAMMER_MAX_OTHER_WICK=0.25;
// Star: mittlere Kerze höchstens halb so groß wie die erste, dritte schließt jenseits der Mitte des ersten Körpers.
export const STAR_MAX_MIDDLE_BODY=0.5;

const body=c=>Math.abs(c.close-c.open);
export const candleDirection=c=>c.close>c.open?'bull':c.close<c.open?'bear':null;

export function candleHammer(c){
 const range=c.high-c.low;
 if(!(range>0)||body(c)>HAMMER_MAX_BODY*range)return null;
 const lower=Math.min(c.open,c.close)-c.low,upper=c.high-Math.max(c.open,c.close);
 if(lower>=HAMMER_MIN_WICK*range&&upper<=HAMMER_MAX_OTHER_WICK*range)return 'bull';
 if(upper>=HAMMER_MIN_WICK*range&&lower<=HAMMER_MAX_OTHER_WICK*range)return 'bear';
 return null;
}

// Morning Star (bull): bärische Kerze, kleine Kerze, bullische Kerze mit Schluss über der Mitte des ersten Körpers. Evening Star gespiegelt.
// Gold handelt durchgehend, deshalb keine Gap-Bedingung.
export function candleStar(c1,c2,c3){
 if(!(body(c1)>0)||body(c2)>STAR_MAX_MIDDLE_BODY*body(c1))return null;
 const mid=(c1.open+c1.close)/2;
 if(candleDirection(c1)==='bear'&&candleDirection(c3)==='bull'&&c3.close>mid)return 'bull';
 if(candleDirection(c1)==='bull'&&candleDirection(c3)==='bear'&&c3.close<mid)return 'bear';
 return null;
}

// Muster in einer Kerzenfolge (aufsteigend, geschlossen): Hammer je Kerze, Stars nur vollständig im Fenster.
export function candlePatternsIn(candles){
 const found=[];
 candles.forEach((c,i)=>{const h=candleHammer(c);if(h)found.push({type:'hammer',side:h,time:c.time});
  if(i>=2){const s=candleStar(candles[i-2],candles[i-1],c);if(s)found.push({type:'star',side:s,time:candles[i-2].time});}});
 return found;
}
