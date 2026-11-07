// Öffentliche und private Journalpositionen brauchen dieselben Chart-Objekte.
export const INVALIDATION_OBJECT_EMBED=
 'invalidation_liquidity_level:liquidity_levels!invalidation_liquidity_level_id(price, direction, timeframe, pivot_time, touched, end_time), '+
 'invalidation_ob_zone:ob_zones!invalidation_ob_zone_id(timeframe, direction, top, bottom, start_time)';
export const JOURNAL_POSITION_SELECT=`*, dealing_ranges!inner(id, instrument, direction, invalidation, trade_setup_id, lesson_dealing_range_id, setup_type, strategy_setup, ${INVALIDATION_OBJECT_EMBED}, trade_setups(ob_start_time, ob_top, ob_bottom))`;
