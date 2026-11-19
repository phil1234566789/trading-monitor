import {deriveM5CloseReaction} from './m5CloseReaction.js';

// Struktur-Overlay der TS1.1-Sektion = genau der TS1.1-Kontext zu evaluatedAt (Anker, Pivots, Zustand),
// nichts selbst gerechnet. Die Close-Reaktion entsteht wie in currentTradeSetup11Range aus denselben Teilen.
export function ts11StructureOverlay(context,closeReactionCache){
 if(context?.status!=='ready')return null;
 const {state,pivotsOuter,pivotsInner,periods,candles,anchor}=context;
 return {state,pivotsOuter,pivotsInner,anchorTime:anchor.structureStartTime,
  closeReaction:deriveM5CloseReaction(state,pivotsOuter,pivotsInner,periods.outer,periods.inner,candles,300,closeReactionCache)};
}
