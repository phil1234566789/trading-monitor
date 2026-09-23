// Klick-Modus des Charts — genau EINER gleichzeitig. Ein Ref mit drei Werten statt zweier
// Booleans (vorher tradeModeActive/measureModeActive), damit sich zwei Modi strukturell nicht
// gegenseitig anschalten können; die Umschalt-Watches dafür sind damit weg. Die Knöpfe sitzen
// seit dem 23.09.2026 in der Kopfleiste (App.vue) statt in der Chart-Leiste, deshalb geteilter
// Modul-Ref statt lokalem State in Dashboard.vue. Bewusst nicht persistiert: ein Reload startet
// immer im harmlosen Navigieren-Modus.
import { ref } from "vue";

export const CHART_MODES = [
  { id: "navigate", label: "🖐 Navigieren", title: "Chart normal bedienen (Pan/Zoom)" },
  { id: "trade", label: "🎯 Trade-Modus", title: "Auf ein Trade-Setup klicken, um es als Trade zu übernehmen" },
  {
    id: "measure",
    label: "📏 Messen",
    title: "Zwei Punkte im Chart anklicken — die Strecke bleibt mit ihrer Pip-Zahl stehen, während des Ziehens wird live mitgerechnet",
  },
];

export const chartMode = ref("navigate");
