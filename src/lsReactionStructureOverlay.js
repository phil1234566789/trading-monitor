import {deriveM5CloseReaction} from './m5CloseReaction.js';

// Struktur-Overlay der LS-Reaktion-Sektion = genau der LS-Reaktion-Kontext zu evaluatedAt (Anker, Pivots, Zustand),
// nichts selbst gerechnet. Die Close-Reaktion entsteht wie in currentM5StructureRange aus denselben Teilen.
export function lsReactionStructureOverlay(context,closeReactionCache){
 if(context?.status!=='ready')return null;
 const {state,pivotsOuter,pivotsInner,periods,candles,anchor}=context;
 return {state,pivotsOuter,pivotsInner,anchorTime:anchor.structureStartTime,manual:!!anchor.manual,
  closeReaction:deriveM5CloseReaction(state,pivotsOuter,pivotsInner,periods.outer,periods.inner,candles,300,closeReactionCache)};
}
