import { createChart, CandlestickSeries, TickMarkType, CrosshairMode } from "lightweight-charts";
import { cssColor } from "./chartColors.js";
import { pricePrecisionForInstrument } from "./format.js";
import { berlinDateStrFor, formatBerlinTime } from "./berlinTime.js";

// Geteilt von PriceChart.vue und dem OB-Reaktions-Debugger, damit beide Charts gleich aussehen.
// lightweight-charts formatiert sonst in UTC; die Achse zeigt Europe/Berlin (CLAUDE.md, Zeitzonen).
const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const berlin = (options) => new Intl.DateTimeFormat("de-DE", { ...options, timeZone: "Europe/Berlin" });
const DAY_MONTH = berlin({ day: "2-digit", month: "short" });
const MONTH_YEAR = berlin({ month: "short", year: "numeric" });

function tickMarkFormatter(time, tickMarkType) {
  const d = new Date(time * 1000);
  switch (tickMarkType) {
    case TickMarkType.Year:
      return berlinDateStrFor(time).slice(0, 4);
    case TickMarkType.Month:
      return MONTH_YEAR.format(d);
    case TickMarkType.DayOfMonth:
      return `${WEEKDAYS_DE[new Date(`${berlinDateStrFor(time)}T12:00:00Z`).getUTCDay()]} ${DAY_MONTH.format(d)}`;
    case TickMarkType.TimeWithSeconds:
      return `${formatBerlinTime(time)}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
    default:
      return formatBerlinTime(time);
  }
}

function crosshairTimeFormatter(time) {
  return `${DAY_MONTH.format(new Date(time * 1000))} ${formatBerlinTime(time)}`;
}

export function createPriceChart(container, symbol) {
  const chart = createChart(container, {
    layout: {
      background: { color: "#131722" },
      textColor: "#d1d4dc",
    },
    // Raster bewusst aus: rein optisch und als störend empfunden.
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: false,
      tickMarkFormatter,
      // Ohne Leerraum klebt die neueste Kerze an der Preisskala und man muss jedes Mal schieben.
      rightOffset: 70,
    },
    localization: {
      timeFormatter: crosshairTimeFormatter,
    },
    // Magnet-Crosshair snappt auf die Kerze statt der Cursor-Position zu folgen — nicht gewollt.
    crosshair: {
      mode: CrosshairMode.Normal,
    },
  });
  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: cssColor("candleUp"),
    downColor: cssColor("candleDown"),
    borderVisible: false,
    wickUpColor: cssColor("candleUp"),
    wickDownColor: cssColor("candleDown"),
    // Forex braucht 5 Nachkommastellen (Pipette); der Default 0.01 würde GBPUSD auf 1.34 runden.
    priceFormat: { type: "price", precision: pricePrecisionForInstrument(symbol), minMove: symbol === "XAUUSD" ? 0.01 : 0.00001 },
  });
  return { chart, candleSeries };
}
