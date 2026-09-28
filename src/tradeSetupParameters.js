import { strategyDistance } from './instrumentConfig.js';
import { TRADE_SETUP_GRACE_SEC, TRADE_SETUP_LS_MAX_LEAD_SEC_H1, TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
  TRADE_SETUP_LS_MAX_DISTANCE_M5, TRADE_SETUP_MAX_SWEEP_DISTANCE, TRADE_SETUP_LOOKBACK_SEC,
  TRADE_SETUP_OB_MAX_DELAY_SEC, TRADE_SETUP_CLOSE_CHECK_MAX_AGE_SEC } from './priceChartConstants.js';

export function tradeSetupParameters(symbol, nowTime) {
  return {
    graceSec: TRADE_SETUP_GRACE_SEC,
    lsMaxLeadSecH1: TRADE_SETUP_LS_MAX_LEAD_SEC_H1,
    lsMaxLeadSecM5: TRADE_SETUP_LS_MAX_LEAD_SEC_M5,
    maxDistanceM5: strategyDistance(TRADE_SETUP_LS_MAX_DISTANCE_M5, symbol),
    maxSweepDistance: strategyDistance(TRADE_SETUP_MAX_SWEEP_DISTANCE, symbol),
    maxLookbackSec: TRADE_SETUP_LOOKBACK_SEC,
    obMaxDelaySec: TRADE_SETUP_OB_MAX_DELAY_SEC,
    closeCheckMaxAgeSec: TRADE_SETUP_CLOSE_CHECK_MAX_AGE_SEC,
    nowTime,
  };
}
