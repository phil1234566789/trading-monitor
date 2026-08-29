import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { toPips } from "../pipConfig.js";

const INSTRUMENT = z.enum(["GBPUSD", "EURUSD"]);

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Reine Arithmetik statt Kopfrechnen (Chat 2026-08-20, milk-city-Task calc_rr) — Pip-Distanz/RR
// entscheidet in 00-trading-steps Schritt 7 direkt über Trade/Kein-Trade (Ausschlusskriterium
// RR < 1:3), ein Next-Token-Rechenfehler dort ist kein kosmetischer Bug (siehe
// docs/steerabilty-vs-wrong-ai-outputs.md). Direktionslos (nur Beträge zwischen den Preisen) —
// funktioniert unverändert für Long UND Short, ein separater direction-Parameter wäre hier nur
// zusätzliche Fehlerfläche ohne Nutzen für die reine Distanz-/Ratio-Rechnung.
export function calcRr({ entryPrice, stopLossPrice, targetPrices }: { entryPrice: number; stopLossPrice: number; targetPrices: number[] }) {
  const riskPrice = Math.abs(entryPrice - stopLossPrice);
  const riskPips = toPips(riskPrice);
  const targets = targetPrices.map((targetPrice) => {
    const rewardPips = toPips(Math.abs(targetPrice - entryPrice));
    return {
      targetPrice,
      rewardPips: round(rewardPips, 1),
      // riskPips===0 (Entry===SL, ungültiges Setup) -> RR nicht berechenbar statt Division durch 0.
      rr: riskPips === 0 ? null : round(rewardPips / riskPips, 2),
    };
  });
  return { entryPrice, stopLossPrice, riskPips: round(riskPips, 1), targets };
}

export function registerCalcRrTool(server: McpServer) {
  server.registerTool(
    "calc_rr",
    {
      title: "Pip-Distanz & Risk-Reward berechnen",
      description:
        "Deterministische Berechnung statt Kopfrechnen: Pip-Distanz von Entry zu Stop-Loss (Risiko) und zu " +
        "einem oder mehreren Target-Preisen (Reward je Target), plus das jeweilige RR-Verhältnis " +
        "(reward/risk). Direktionslos — funktioniert unverändert für Long und Short, da nur " +
        "Preisdifferenzen als Beträge verglichen werden. Nutze dieses Tool statt selbst zu rechnen, " +
        "besonders für die RR<1:3-Ausschlussprüfung in 00-trading-steps Schritt 7.",
      inputSchema: {
        instrument: INSTRUMENT,
        entryPrice: z.number().describe("Geplanter/tatsächlicher Entry-Preis"),
        stopLossPrice: z.number().describe("Stop-Loss-Preis"),
        targetPrices: z
          .array(z.number())
          .min(1)
          .describe("Ein oder mehrere Target-Preise (z.B. TP1/TP2/TP3) — je einer bekommt eine eigene Reward-Pip-/RR-Berechnung"),
      },
    },
    async ({ instrument, entryPrice, stopLossPrice, targetPrices }) => json({ instrument, ...calcRr({ entryPrice, stopLossPrice, targetPrices }) }),
  );
}
