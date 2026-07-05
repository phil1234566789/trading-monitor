export const TIMEFRAMES = [
  { label: "1m", bar: "1m" },
  { label: "5m", bar: "5m" },
  { label: "15m", bar: "15m" },
  { label: "1h", bar: "1H" },
  { label: "4h", bar: "4H" },
  { label: "1D", bar: "1D" },
];

export function okxBarFor(label) {
  return TIMEFRAMES.find((tf) => tf.label === label).bar;
}
