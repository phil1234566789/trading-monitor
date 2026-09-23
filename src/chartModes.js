// Klick-Modus des Charts — genau EINER gleichzeitig. Ein Ref mit drei Werten statt zweier
// Booleans (vorher tradeModeActive/measureModeActive), damit sich zwei Modi strukturell nicht
// gegenseitig anschalten können; die Umschalt-Watches dafür sind damit weg. Die Knöpfe sitzen
// seit dem 23.09.2026 in der Kopfleiste (App.vue) statt in der Chart-Leiste, deshalb geteilter
// Modul-Ref statt lokalem State in Dashboard.vue. Bewusst nicht persistiert: ein Reload startet
// immer im harmlosen Navigieren-Modus.
import { ref } from "vue";

// Die umschaltbaren Modi, in der Reihenfolge der Knöpfe. "trade" fehlt hier bewusst: der Modus
// existiert weiter, hat aber seit dem 23.09.2026 keinen eigenen Knopf mehr (Philip: "über TSC kann
// man bereits echt gut steuern") — man landet nur noch darin, indem man in der TSC oder im
// Trade-Edit-Modal einen Klick scharf macht, und kommt über denselben Knopf oder "Navigieren"
// wieder raus. hint = was der nächste Chart-Klick tut, neben den Knöpfen sichtbar (title erscheint
// nur beim Hovern und reicht dafür nicht); im Trade-Modus liefert Dashboard.vue ihn über chartHint,
// weil er dort die Trade-Nummer nennt.
export const CHART_MODES = [
  { id: "navigate", label: "🖐 Navigieren", title: "Chart normal bedienen (Pan/Zoom)", hint: null },
  {
    id: "measure",
    label: "📏 Messen",
    title: "Zwei Punkte im Chart anklicken — die Strecke bleibt mit ihrer Pip-Zahl stehen, während des Ziehens wird live mitgerechnet",
    hint: "📏 Zwei Punkte im Chart anklicken",
  },
];

export const chartMode = ref("navigate");

// Überschreibt den hint des Modus, solange Dashboard.vue einen Klick "scharf" gemacht hat (Target/
// Bestätigung/Invalidierung an einem bestimmten Trade) — der Text kennt die Trade-Nummer, hängt
// also an Dashboard-Zustand, angezeigt wird er aber oben in der Kopfleiste.
export const chartHint = ref(null);
