import { computed, ref } from "vue";
import { supabase } from "./supabaseClient.js";
import { useLocalStorageRef } from "./composables/useLocalStorageRef.js";

// Trading-Konten (Chat 2026-07-30: Demo-/Live-Trennung, "Konten"-Seite + Konto-Auswahl im
// Trades-Panel) — direkter Fetch-dann-Anzeigen wie alarmSettings.js/Alarme.vue statt des
// localStorage-first-Musters von sessions.js/chartColors.js: die Kontoliste ändert sich selten,
// braucht kein Offline-Sofortrendern beim Chart-Laden. Reactive `accounts`-Liste wird von der
// Konten-Seite UND vom Trades-Panel-Switcher geteilt (ein fetchAccounts()-Aufruf genügt).
export const accounts = ref([]);
export const accountsLoaded = ref(false);

// Welches Konto gerade für die Trades-Liste/neue Trades ausgewählt ist — reines UI-/Geräte-Setting
// (wie currentSymbol), nicht in trading_accounts selbst gespeichert. null = noch keine Auswahl
// getroffen (z.B. allererster Start) -> fällt in Dashboard.vue auf das erste geladene Konto zurück.
export const selectedTradingAccountId = useLocalStorageRef("selectedTradingAccountId", null);

// Sentinel für "kein Konto-Filter" (Bug-Report Philip 2026-07-31: eine von Laniakea per MCP
// angelegte Idee ohne trading_account_id war im Trades-Panel unsichtbar, WELCHES Konto auch immer
// gewählt war — der Switcher bot nur echte Konten an, nie "zeig mir alles"). Bewusst ein String
// statt null: null bleibt "noch keine Auswahl getroffen" (siehe fetchAccounts-Bootstrap unten),
// "all" ist eine EXPLIZITE, persistente Wahl, die den Bootstrap-Fallback nicht überschreiben soll.
export const ALL_ACCOUNTS_ID = "all";

// Bug-Report Philip 2026-08-27: "Dealing Range anlegen"/eine neue Position schrieb bei Auswahl
// "Alle Konten" den rohen String "all" in trade_positions.trading_account_id (bigint) — Postgres-
// Fehler 22P02. selectedTradingAccountId ist für LESEN (trades.js: fetchTrades) korrekt "all" ==
// kein Filter, für ein INSERT/UPDATE gibt es aber kein Konto namens "all" — dort muss null rein
// (= "kein Konto zugeordnet", genau wie der explizite null-Fall). Ein Computed statt an jeder
// Schreibstelle (TakeTradeModal.vue, Dashboard.vue: onTscTransferToTrades, ...) einzeln denselben
// Vergleich zu wiederholen.
export const writableTradingAccountId = computed(() => (selectedTradingAccountId.value === ALL_ACCOUNTS_ID ? null : selectedTradingAccountId.value));

export async function fetchAccounts() {
  const { data, error } = await supabase.from("trading_accounts").select("id, name, notes").order("id");
  if (error) {
    console.error("Trading-Konten laden fehlgeschlagen:", error);
    return;
  }
  accounts.value = data;
  accountsLoaded.value = true;
  // Noch keine (oder eine inzwischen gelöschte) Auswahl -> erstes Konto als Default, statt die
  // Trades-Liste dauerhaft leer zu lassen. ALL_ACCOUNTS_ID ist eine gültige, bewusste Auswahl,
  // kein "ungültiger Zustand" wie eine gelöschte Konto-Id — bleibt deshalb unangetastet.
  if (data.length > 0 && selectedTradingAccountId.value !== ALL_ACCOUNTS_ID && !data.some((a) => a.id === selectedTradingAccountId.value)) {
    selectedTradingAccountId.value = data[0].id;
  }
}

export async function createAccount(name) {
  const { data, error } = await supabase.from("trading_accounts").insert({ name }).select("id, name, notes").single();
  if (error) {
    console.error("Trading-Konto anlegen fehlgeschlagen:", error);
    return null;
  }
  accounts.value.push(data);
  return data;
}

export async function updateAccount(id, fields) {
  const { error } = await supabase.from("trading_accounts").update(fields).eq("id", id);
  if (error) {
    console.error("Trading-Konto aktualisieren fehlgeschlagen:", error);
    return false;
  }
  const account = accounts.value.find((a) => a.id === id);
  if (account) Object.assign(account, fields);
  return true;
}

// trade_positions.trading_account_id ist "on delete set null" (siehe Migration) — ein gelöschtes
// Konto reißt also keine Trades mit, die zeigen dann einfach wieder "kein Konto".
export async function deleteAccount(id) {
  const { error } = await supabase.from("trading_accounts").delete().eq("id", id);
  if (error) {
    console.error("Trading-Konto löschen fehlgeschlagen:", error);
    return false;
  }
  accounts.value = accounts.value.filter((a) => a.id !== id);
  if (selectedTradingAccountId.value === id) {
    selectedTradingAccountId.value = accounts.value[0]?.id ?? null;
  }
  return true;
}

fetchAccounts();
