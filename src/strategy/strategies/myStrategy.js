import BaseStrategy from '../baseStrategy.js'
import { SIGNALS } from '../../shared/constants.js'

export default class MyStrategy extends BaseStrategy {
  constructor(asset) {
    super(asset)
    this.name = 'myStrategy'
    // Configurá tus parámetros acá
    // Ejemplo: this.period = 14
  }

  // ESTE ES EL ÚNICO MÉTODO QUE DEBÉS COMPLETAR
  // prices: array de objetos { price, open, high, low, volume, timestamp }
  //         ordenados de más viejo a más nuevo
  // indicators: { sma20, sma50, ema20, rsi14, bb20, macd }
  //         (todos pueden ser null si no hay suficientes datos)
  // Retornar: 'BUY', 'SELL', o 'HOLD'
  evaluate(prices, indicators) {
    // Tu lógica va acá.
    // Indicadores disponibles:
    //   indicators.sma20  → SMA de 20 períodos
    //   indicators.sma50  → SMA de 50 períodos
    //   indicators.ema20  → EMA de 20 períodos
    //   indicators.rsi14  → RSI de 14 períodos (0-100)
    //   indicators.bb20   → { upper, middle, lower }
    //   indicators.macd   → { macd, signal, histogram }
    //
    // Ejemplo:
    //   if (indicators.rsi14 !== null && indicators.rsi14 < 30) return SIGNALS.BUY
    //   if (indicators.rsi14 !== null && indicators.rsi14 > 70) return SIGNALS.SELL
    return SIGNALS.HOLD
  }
}
