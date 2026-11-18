export const SIGNALS = {
  BUY:  'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
}

export const HISTORY_LIMIT = 100

export const STRATEGY_MAP_KEY = (symbol, market) => symbol + ':' + market

// MODO SOLO ANÁLISIS — el bot NUNCA opera.
// Hardcodeado a propósito (no depende de ninguna variable de entorno):
// ningún cambio en Railway puede habilitar el envío de órdenes.
// El bot solo lee cotizaciones, guarda históricos, genera señales y avisa.
export const ANALYSIS_ONLY = true
