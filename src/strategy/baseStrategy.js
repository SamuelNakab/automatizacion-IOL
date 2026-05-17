import { sma, ema, rsi, bollingerBands, macd } from './indicators.js'
import { SIGNALS } from '../shared/constants.js'

export default class BaseStrategy {
  constructor(asset) {
    this.asset = asset  // { id, symbol, market, type }
    this.name = 'base'
  }

  // Calcula todos los indicadores sobre el array de precios.
  // prices: array de objetos { price, open, high, low, volume, timestamp } (más viejo primero)
  computeIndicators(prices) {
    const closes = prices.map(p => Number(p.price))
    return {
      sma20: sma(closes, 20),
      sma50: sma(closes, 50),
      ema20: ema(closes, 20),
      rsi14: rsi(closes, 14),
      bb20:  bollingerBands(closes, 20),
      macd:  macd(closes),
    }
  }

  // MÉTODO ABSTRACTO — cada estrategia lo implementa.
  // prices: array de objetos precio (más viejo primero)
  // indicators: resultado de computeIndicators()
  // Retorna: 'BUY', 'SELL', o 'HOLD'
  evaluate(prices, indicators) {
    throw new Error('evaluate() debe ser implementado por la subclase')
  }

  // Orquesta el análisis completo para un activo.
  // Llamado por strategyEngine. No modificar en subclases.
  async run(prices) {
    if (prices.length < 2) return SIGNALS.HOLD
    const indicators = this.computeIndicators(prices)
    const signal = await this.evaluate(prices, indicators)
    if (!Object.values(SIGNALS).includes(signal)) {
      throw new Error('evaluate() retornó señal inválida: ' + signal)
    }
    return signal
  }
}
