<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { accounts, selectedTradingAccountId, ALL_ACCOUNTS_ID } from "../tradingAccounts.js";

// Konto-Umschalter im Trades-Panel (Chat 2026-07-30) — eigener, in sich geschlossener Klick-außen-
// Handler statt Dashboard.vue's gemeinsamem closeMenusOutside/.toggle-group (das gehört zur Toolbar,
// dieses Bauteil sitzt im Trades-Panel daneben und soll unabhängig davon öffnen/schließen).
const open = ref(false);
const wrapperRef = ref(null);

const selectedAccount = computed(() => accounts.value.find((a) => a.id === selectedTradingAccountId.value) ?? null);
// "Alle Konten" (Bug-Report Philip 2026-07-31: eine kontolose Lana-Idee war unsichtbar, weil der
// Switcher vorher nur echte Konten anbot) — eigenes Label statt des "Kein Konto"-Fallbacks unten,
// der eigentlich "Auswahl passt zu keinem geladenen Konto" bedeutet, nicht "zeig mir alles".
const currentLabel = computed(() => {
  if (selectedTradingAccountId.value === ALL_ACCOUNTS_ID) return "Alle Konten";
  return selectedAccount.value ? selectedAccount.value.name : "Kein Konto";
});

function select(id) {
  selectedTradingAccountId.value = id;
  open.value = false;
}
function onClickOutside(e) {
  if (open.value && wrapperRef.value && !wrapperRef.value.contains(e.target)) open.value = false;
}
onMounted(() => window.addEventListener("click", onClickOutside));
onUnmounted(() => window.removeEventListener("click", onClickOutside));
</script>

<template>
  <div ref="wrapperRef" class="tas-wrapper">
    <button class="tas-current" title="Trading-Konto wechseln" @click="open = !open">
      🏦 {{ currentLabel }}
    </button>
    <div v-if="open" class="tas-menu">
      <button class="tas-option" :class="{ active: selectedTradingAccountId === ALL_ACCOUNTS_ID }" @click="select(ALL_ACCOUNTS_ID)">
        Alle Konten
      </button>
      <button
        v-for="account in accounts"
        :key="account.id"
        class="tas-option"
        :class="{ active: account.id === selectedTradingAccountId }"
        @click="select(account.id)"
      >
        {{ account.name }}
      </button>
      <p v-if="accounts.length === 0" class="tas-empty">Noch keine Konten — siehe "Konten" in der Navigation.</p>
    </div>
  </div>
</template>

<style scoped>
.tas-wrapper {
  position: relative;
}

.tas-current {
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.tas-current:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.tas-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 6px;
  padding: 4px;
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tas-option {
  background: transparent;
  border: none;
  color: #9aa0ac;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

.tas-option:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

.tas-option.active {
  background: #2962ff;
  color: #fff;
}

.tas-empty {
  font-size: 11px;
  color: #565a64;
  padding: 4px 8px;
  margin: 0;
  max-width: 180px;
}
</style>
