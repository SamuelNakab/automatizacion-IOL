export const RISK_CONFIG = {
  MAX_CAPITAL_PER_TRADE_PCT:      Number(process.env.RISK_MAX_CAPITAL_PER_TRADE_PCT)      || 10,
  MAX_EXPOSURE_PER_ASSET_PCT:     Number(process.env.RISK_MAX_EXPOSURE_PER_ASSET_PCT)     || 20,
  MAX_TOTAL_EXPOSURE_PCT:         Number(process.env.RISK_MAX_TOTAL_EXPOSURE_PCT)         || 60,
  MAX_DRAWDOWN_PCT:               Number(process.env.RISK_MAX_DRAWDOWN_PCT)               || 15,
  MIN_OPERATION_INTERVAL_MINUTES: Number(process.env.RISK_MIN_OPERATION_INTERVAL_MINUTES) || 60,
}
