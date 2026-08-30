// cTrader-Access-/Refresh-Token laden + bei automatischem Refresh zurückschreiben — reine
// Verschiebung (Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots") der bis dahin zweimal
// inline duplizierten Logik aus forex-candles/index.ts und poi-watcher/index.ts (CLAUDE.md "DRY
// within a single runtime" — eine dritte Kopie für die neue daily-structure-pivots-Funktion hätte
// diese Regel verletzt). `ctrader_oauth_tokens` ist die eigentliche Quelle (Migration
// 20260722120000), die *_FALLBACK-Env-Vars nur ein Fallback fürs allererste Deployment vor der
// ersten Zeile.
import type { createClient } from "npm:@supabase/supabase-js@2";
import type { RefreshedTokens } from "./ctrader/client.ts";

export interface CtraderCreds {
  accessToken: string;
  refreshToken: string;
  onTokenRefresh: (tokens: RefreshedTokens) => Promise<void>;
}

export async function loadCtraderCreds(
  supabase: ReturnType<typeof createClient>,
  fallback: { accessToken: string; refreshToken: string },
  logPrefix: string,
): Promise<CtraderCreds> {
  const { data: tokenRow, error: tokenSelectError } = await supabase
    .from("ctrader_oauth_tokens")
    .select("access_token, refresh_token")
    .eq("id", 1)
    .maybeSingle();
  if (tokenSelectError) throw tokenSelectError;

  return {
    accessToken: tokenRow?.access_token ?? fallback.accessToken,
    refreshToken: tokenRow?.refresh_token ?? fallback.refreshToken,
    onTokenRefresh: async (fresh: RefreshedTokens) => {
      const { error } = await supabase
        .from("ctrader_oauth_tokens")
        .upsert({ id: 1, access_token: fresh.accessToken, refresh_token: fresh.refreshToken });
      if (error) console.error(`${logPrefix}: failed to persist refreshed cTrader token:`, error);
    },
  };
}
