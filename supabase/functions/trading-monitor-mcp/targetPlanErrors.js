// Nur bekannte Ablehnungen vor dem Enqueue belegen, dass dieser Entwurf nicht angenommen wurde.
export const TARGET_PLAN_REJECTIONS=Object.freeze([
 'target_fill_required','target_worker_not_ready','target_without_sl_worker_required','target_position_unavailable','target_position_changed',
 'target_daily_stop','target_command_unresolved','target_revision_reused','target_revision_changed','target_outcome_unresolved','account_changed',
 'bridge_offline','bridge_not_ready','quote_stale','risk_limits_unconfirmed','risk_guard_unavailable','risk_floor_reconfirmation_required',
 'risk_exposure_unavailable','risk_budget_exhausted','risk_sizing_unavailable','daily_stop_not_ready','daily_stop_latched',
 'stop_worker_required','stop_risk_budget_exceeded','stop_risk_basis_changed','stop_plan_refresh_required',
 'invalid_target_precision','invalid_target_count','invalid_target_volume','invalid_remaining_volume','target_volume_exceeds_position',
 'invalid_position_volume','invalid_target_price','target_specs_unavailable','invalid_target_basis','invalid_position_stop',
 'invalid_stop_count','invalid_stop_volume','invalid_stop_price','invalid_stop_precision','invalid_stop_basis','stop_volume_must_cover_position',
]);
export const isTargetPlanRejection=code=>TARGET_PLAN_REJECTIONS.includes(code);
