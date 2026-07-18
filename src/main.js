import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router.js";
import { installHttpActivityTracking } from "./composables/useHttpActivity.js";
import "./style.css";

// Muss vor jedem ersten fetch() der App laufen (auch vor supabaseClient.js/chartColors.js
// syncFromRemote, die schon beim Modul-Import feuern) — siehe useHttpActivity.js.
installHttpActivityTracking();

createApp(App).use(router).mount("#app");
