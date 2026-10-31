import { createRouter, createWebHashHistory } from "vue-router";

// Hash-History (statt History-API), da das geplante GitHub-Pages-Deployment keine
// serverseitigen Rewrites fuer beliebige SPA-Routen unterstuetzt.
export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior(to) {
    if (to.name === 'setup-regeln') return to.hash ? { el: to.hash } : { top: 0, left: 0 };
    if (to.name === 'statistik' && to.query.run) return { top: 0, left: 0 };
    if (to.path === '/' && to.query.setup2) return { top: 0, left: 0 };
  },
  routes: [
    { path: "/", name: "dashboard", component: () => import("./views/Dashboard.vue") },
    { path: "/protokoll", name: "protokoll", component: () => import("./views/Protokoll.vue") },
    { path: "/statistik", name: "statistik", component: () => import("./views/Statistik.vue") },
    { path: "/setup-regeln", name: "setup-regeln", component: () => import("./views/TradeSetup2Rules.vue") },
    { path: "/alarme", name: "alarme", component: () => import("./views/Alarme.vue") },
    { path: "/handelszeiten", name: "handelszeiten", component: () => import("./views/Handelszeiten.vue") },
    { path: "/konten", name: "konten", component: () => import("./views/Konten.vue") },
    { path: "/milky-meta-trader", name: "milky-meta-trader", component: () => import("./views/MilkyMetaTrader.vue") },
    { path: "/live-watcher-entry", name: "live-watcher-entry", component: () => import("./views/Dashboard.vue"), beforeEnter: async to => {
      const [{supabase},{createLiveWatcherRepository,liveEntryLink}]=await Promise.all([import('./supabaseClient.js'),import('./liveWatcherMonth.js')]);
      try{const event=await createLiveWatcherRepository(supabase).event(to.query.event);return event?.payload?.entry?liveEntryLink(event):'/statistik';}catch{return '/statistik';}
    } },
    { path: "/algo-watcher", name: "algo-watcher", component: () => import("./views/AlgoWatcher.vue") },
  ],
});
