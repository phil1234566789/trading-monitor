export const M1_STRUCTURE_PERIOD = 5;
// Q48 erlaubt diese Kerzen nur zur Fraktalbestätigung, nie als Strukturwurzeln.
export const M1_FRACTAL_SUPPORT = 9;
// Rohdaten-Vorlauf überbrückt Spread Hour; der Builder lässt nur neun brauchbare Stützkerzen zu.
export const M1_LOAD_LEAD_IN = M1_STRUCTURE_PERIOD * 2 + 1 + 120;
