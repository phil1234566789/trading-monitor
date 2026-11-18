import { ref, onMounted, onUnmounted } from "vue";
import { HTTP_SILENT } from "./composables/useHttpActivity.js";

const POLL_MS = 5 * 60 * 1000;

export const isNewVersion = (loadedSha, remoteSha) => Boolean(loadedSha && remoteSha && loadedSha !== remoteSha);

// ?v= vor dem Hash: GitHub Pages cacht index.html 10 min, reload() bekäme die alte Fassung.
export const reloadUrl = ({ pathname, hash }, sha) => `${pathname}?v=${sha}${hash}`;

// Liefert den SHA eines neueren Deploys oder null; im Dev-Server gibt es kein version.json.
export function useNewVersion() {
  const newSha = ref(null);
  if (import.meta.env.DEV) return newSha;
  async function check() {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: "no-store", [HTTP_SILENT]: true });
      const { sha } = await res.json();
      if (isNewVersion(__APP_SHA__, sha)) newSha.value = sha;
    } catch {
      // Offline/Deploy läuft: nächster Versuch beim nächsten Takt.
    }
  }
  const onVisible = () => document.visibilityState === "visible" && check();
  let timer;
  onMounted(() => {
    check();
    timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
  });
  onUnmounted(() => {
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  });
  return newSha;
}
