// Archivobjekte bleiben unverändert; nur ihr alter Feldname wird beim Lesen aufgelöst.
export const entryPatternVersion = source => source?.entryPattern ?? source?.entryModel;
export const entryPatternText = text => text?.replace(/Entry[- ]Modell/g,'Entry Pattern');
