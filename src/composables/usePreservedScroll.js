import { ref, onBeforeUpdate, onUpdated } from 'vue';

export function usePreservedScroll() {
  const element = ref(null);
  let desiredTop = 0;
  let appliedTop = 0;
  let updating = false;
  function rememberScroll() {
    if (!updating && element.value && element.value.scrollTop !== appliedTop) {
      desiredTop = element.value.scrollTop;
      appliedTop = desiredTop;
    }
  }
  onBeforeUpdate(() => { rememberScroll(); updating = true; });
  onUpdated(() => {
    if (element.value) {
      // Lade-Platzhalter können scrollTop begrenzen; das ist kein neuer Scrollwunsch.
      element.value.scrollTop = desiredTop;
      appliedTop = element.value.scrollTop;
    }
    updating = false;
  });
  return { element, rememberScroll };
}
