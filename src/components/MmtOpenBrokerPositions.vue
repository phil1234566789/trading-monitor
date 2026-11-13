<script setup>
import MilkyMetaTraderLivePosition from './MilkyMetaTraderLivePosition.vue';
defineProps({positions:{type:Array,default:()=>[]},issues:{type:Array,default:()=>[]}});
</script>

<template>
 <section v-if="positions.length||issues.length" class="mmt-panel mmt-broker-positions" aria-label="Offene Brokerpositionen aller Konten">
  <h2>Offene Brokerpositionen · {{positions.length}}</h2>
  <p v-for="issue in issues" :key="issue.account.id" class="mmt-error mmt-position-issue" role="alert">{{issue.account.name}} · {{issue.message}} Letzter bekannter Stand; offene Positionen können abweichen.</p>
  <article v-for="row in positions" :key="row.key" :aria-label="`${row.account.name} · Position ${row.position.ticket}`">
   <h3>{{row.account.name}} <small class="mmt-muted">· {{row.account.login}}</small></h3>
   <p class="mmt-position-symbol"><strong>{{row.position.symbol}}</strong> · <span class="trade-direction" :class="row.position.type===0?'long':'short'">{{row.position.type===0?'Long':'Short'}}</span><span v-if="!row.online" class="mmt-error"> · {{row.account.archived?'Konto inaktiv · letzter bekannter Stand':'Stand nicht bestätigt'}}</span></p>
   <MilkyMetaTraderLivePosition :position="row.position" :commission="row.commission" :commission-at="row.commissionAt" :currency="row.currency" :age="row.online?row.age:null" :digits="row.snapshot.quotes?.find(q=>q.symbol===row.position.symbol)?.digits" />
  </article>
 </section>
</template>

<style scoped>
.mmt-position-issue{grid-column:1/-1;margin:0}.mmt-position-symbol{margin:0 0 .5rem}.mmt-broker-positions h3 small{font-size:.75rem;font-weight:normal}
</style>
