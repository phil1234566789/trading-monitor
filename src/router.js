import { createRouter, createWebHashHistory } from "vue-router";

// Hash-History (statt History-API), da das geplante GitHub-Pages-Deployment keine
// serverseitigen Rewrites fuer beliebige SPA-Routen unterstuetzt.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "dashboard", component: () => import("./views/Dashboard.vue") },
    { path: "/protokoll", name: "protokoll", component: () => import("./views/Protokoll.vue") },
  ],
});
