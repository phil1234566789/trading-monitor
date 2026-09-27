import { watch } from "vue";

export function useReplayStructureDefaults(replayActive, { startMode, lookbackHours, innerLookbackHours }) {
  watch(replayActive, (active, previous) => {
    // Der heutige Tagespivot kann im Replay hinter dessen Endzeit liegen und dadurch
    // beide Struktur-Ebenen leeren. Replay braucht einen relativ zum Replay laufenden Vorlauf.
    if (active) {
      startMode.value = "days";
      lookbackHours.value = 21 * 24;
      innerLookbackHours.value = lookbackHours.value;
    } else if (previous === true) {
      startMode.value = "pivot";
    }
  }, { immediate: true, flush: "sync" });
}
