<script setup>
import ActionButton from './ui/ActionButton.vue';
import IconButton from './ui/IconButton.vue';
import {MMT_ACCOUNT_SELECTIONS,accountsForRole} from '../mmtAccountRoles.js';
import {useMmtBatchEntrySearch} from '../composables/useMmtBatchEntrySearch.js';
const props=defineProps({api:Function,accounts:Array,statuses:Object,activeId:String,symbol:String,idea:Object,disabled:Boolean,disabledReason:String,now:Number});
const emit=defineEmits(['submitted']);
const {role,riskMode,duration,rows,busy,error,unresolved,selectedAccounts,accountDetails,blockedReason,canSubmit,feedbackRows,submit,reconcile,dismiss,stateLabel,rowIntent}=useMmtBatchEntrySearch(props,emit);
</script>
<template>
 <section class="mmt-panel mmt-ticket" aria-label="Entry auf ausgewählten Konten suchen">
  <label class="role-picker">Handelskonto<select v-model="role" :disabled="busy||unresolved" aria-label="Trade-Art und Konto">
   <option v-for="r in MMT_ACCOUNT_SELECTIONS" :key="r.value" :value="r.value">{{r.label}} · {{accountsForRole(accounts??[],r.value).map(a=>a.name).join(' + ')||'Kontozuordnung fehlt'}}</option>
  </select></label>
  <p v-if="idea"><strong>{{idea.direction==='long'?'Long':'Short'}} · SL {{idea.sl}} · {{symbol}}</strong></p>
  <p v-for="row in accountDetails" :key="row.account.id"><strong>{{row.account.name}}</strong> · <template v-if="row.metrics">{{row.metrics.volume}} Lot · RR {{row.metrics.rr?.toFixed(2)??'—'}} · {{row.metrics.risk.toFixed(2)}} {{row.metrics.currency}}</template><span v-else role="status">{{row.reason}}</span></p>
  <p v-if="selectedAccounts.length>1" class="mmt-muted">{{selectedAccounts.length}} getrennte Suchen · Risiko je Konto · Ausführung kann je Konto abweichen.</p>
  <form class="compact-controls" @submit.prevent="submit">
   <label>Risiko<select v-model="riskMode" :disabled="busy||unresolved"><option value="risky">Risky · 0,5 %</option><option value="full">Full · 0,9 %</option></select></label>
   <label>Gültig · Minuten<input v-model="duration" type="number" min="1" max="60" required :disabled="busy||unresolved"></label>
   <span class="entry-submit mmt-wide" :title="blockedReason||undefined" :tabindex="blockedReason?0:undefined" :aria-label="blockedReason?`Entry suchen gesperrt: ${blockedReason}`:undefined">
    <ActionButton type="submit" class="mmt-primary mmt-wide" :disabled="!canSubmit" :title="blockedReason||undefined">{{busy?'Wird verarbeitet …':'Entry suchen'}}</ActionButton>
   </span>
  </form>
  <p v-if="error" class="mmt-error" role="alert">{{error}}</p>
  <ul v-if="feedbackRows.length" class="mmt-order-list" aria-label="Suchaufträge und Rückmeldungen" aria-live="polite">
   <li v-for="row in feedbackRows" :key="row.preview?.intent.id||row.attempt+row.accountId" class="mmt-order-card" :data-state="row.state">
    <div class="mmt-order-heading"><strong>{{row.name}} · {{rowIntent(row).symbol}} · {{rowIntent(row).direction==='long'?'Long':'Short'}}</strong><span class="mmt-order-state">{{stateLabel(row.state)}}</span>
     <IconButton v-if="['rejected','expired','cancelled','executed'].includes(row.state)" aria-label="Rückmeldung schließen" title="Rückmeldung schließen" @click="dismiss(row)">×</IconButton>
    </div>
    <p v-if="row.message" :role="['rejected','unknown'].includes(row.state)?'alert':undefined" :class="{'mmt-error':['rejected','unknown'].includes(row.state)}">{{row.message}}</p>
   </li>
  </ul>
  <ActionButton v-if="unresolved" :disabled="busy" @click="reconcile">Unklaren Status prüfen · kein erneuter Versand</ActionButton>
 </section>
</template>
<style scoped>
.mmt-ticket{margin:4px 0;padding:0;border:0;background:none}.role-picker{display:grid;gap:3px}
.compact-controls{display:grid;grid-template-columns:1fr 1fr;gap:5px}.compact-controls label{display:grid;gap:3px;min-width:0}.entry-submit{display:grid;grid-column:1/-1}
select,input{width:100%;min-width:0;box-sizing:border-box;padding:5px;background:#111621;color:inherit;border:1px solid #475569;border-radius:4px}
p{margin:5px 0}.mmt-preview{padding:5px}
</style>
