<script setup>
import { ref } from "vue";
import { accounts, accountsLoaded, createAccount, updateAccount, deleteAccount } from "../tradingAccounts.js";

const newName = ref("");
const adding = ref(false);

async function onAdd() {
  const name = newName.value.trim();
  if (!name) return;
  adding.value = true;
  const ok = await createAccount(name);
  adding.value = false;
  if (ok) newName.value = "";
}

async function onDelete(account) {
  if (!confirm(`Konto "${account.name}" wirklich löschen? Verknüpfte Trades verlieren nur die Konto-Zuordnung, bleiben aber erhalten.`)) return;
  await deleteAccount(account.id);
}

// Direktes Speichern bei Blur statt Live-per-Keystroke (anders als sessions.js' Auto-Save) — hier
// reicht ein Request pro Editiervorgang, kein Grund für Debounce bei so wenigen, seltenen Zeilen.
function onNameBlur(account, event) {
  const name = event.target.value.trim();
  if (name && name !== account.name) updateAccount(account.id, { name });
}
function onNotesBlur(account, event) {
  const notes = event.target.value.trim() || null;
  if (notes !== account.notes) updateAccount(account.id, { notes });
}
</script>

<template>
  <div class="konten-wrapper">
    <h2 class="konten-title">Konten</h2>
    <p class="konten-hint">
      Trennung zwischen Demo-/Test- und echten Trading-Konten (Chat 2026-07-30) — jeder Trade kann optional
      einem Konto zugeordnet werden (Bearbeiten-Modal), die Trades-Liste zeigt immer nur das aktuell im
      Dashboard ausgewählte Konto.
    </p>

    <div class="konten-add-row">
      <input
        v-model="newName"
        type="text"
        placeholder="Name des neuen Kontos"
        class="konten-add-input"
        @keyup.enter="onAdd"
      />
      <button class="konten-add-btn" :disabled="adding || !newName.trim()" @click="onAdd">+ Konto anlegen</button>
    </div>

    <p v-if="accountsLoaded && accounts.length === 0" class="konten-empty">Noch keine Konten angelegt.</p>

    <div v-for="account in accounts" :key="account.id" class="konten-item">
      <input
        :value="account.name"
        type="text"
        class="konten-name-input"
        @change="onNameBlur(account, $event)"
      />
      <textarea
        :value="account.notes ?? ''"
        rows="2"
        placeholder="Notizen (optional)"
        class="konten-notes-input"
        @change="onNotesBlur(account, $event)"
      ></textarea>
      <button class="konten-delete-btn" title="Konto löschen" @click="onDelete(account)">🗑</button>
    </div>
  </div>
</template>

<style scoped>
.konten-wrapper {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px;
}

.konten-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #d1d4dc;
}

.konten-hint {
  font-size: 12px;
  color: #787b86;
  margin: 0 0 20px;
  max-width: 720px;
}

.konten-add-row {
  display: flex;
  gap: 8px;
  max-width: 480px;
  margin-bottom: 18px;
}

.konten-add-input {
  flex: 1;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 6px 8px;
}

.konten-add-btn {
  background: transparent;
  border: 1px solid #2962ff;
  color: #7ea6ff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.konten-add-btn:hover {
  background: rgba(41, 98, 255, 0.12);
}

.konten-add-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.konten-empty {
  font-size: 12px;
  color: #565a64;
  font-style: italic;
}

.konten-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
  max-width: 720px;
}

.konten-name-input {
  flex: 0 0 200px;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 8px;
}

.konten-notes-input {
  flex: 1;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  font-family: inherit;
  padding: 6px 8px;
  resize: vertical;
}

.konten-delete-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid rgba(239, 83, 80, 0.4);
  color: #ef5350;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.konten-delete-btn:hover {
  background: rgba(239, 83, 80, 0.12);
}
</style>
