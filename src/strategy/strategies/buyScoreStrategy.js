import BaseStrategy              from '../baseStrategy.js'
import * as priceHistoryRepository from '../../persistence/priceHistoryRepository.js'
import { calculateBuyScore }    from '../buyScoreCalculator.js'
import { SIGNALS }              from '../../shared/constants.js'
import logger                   from '../../shared/logger.js'

export default class BuyScoreStrategy extends BaseStrategy {
  constructor(asset) {
    super(asset)
    this.name                = 'buyScore'
    this.threshold           = Number(process.env.BUY_SIGNAL_THRESHOLD || 6)
    this.intradayWindowHours = Number(process.env.BUY_INTRADAY_WINDOW_HOURS || 2)
    this.lastAlertDate       = null
    this.lastSignalData      = null
  }

  async evaluate(prices, indicators) {
    if (prices.length === 0) return SIGNALS.HOLD

    const precioActual = Number(prices[prices.length - 1].price)

    // Histórico diario para el score
    const rawBars = await priceHistoryRepository.getLatest(this.asset.id, 100)
    if (rawBars.length === 0) return SIGNALS.HOLD

    const bars   = [...rawBars].sort((a, b) => new Date(a.date) - new Date(b.date))
    const result = calculateBuyScore(bars, precioActual)

    if (result.blocked || result.insufficientData) {
      logger.debug('Score bloqueado', {
        symbol: this.asset.symbol,
        reason: result.blockedReason || 'datos insuficientes',
      })
      return SIGNALS.HOLD
    }

    if (result.score < this.threshold) {
      logger.debug('Score insuficiente', {
        symbol:    this.asset.symbol,
        score:     result.score,
        threshold: this.threshold,
      })
      return SIGNALS.HOLD
    }

    // Confirmación intradiaria
    const windowMs       = this.intradayWindowHours * 60 * 60 * 1000
    const cutoff         = new Date(Date.now() - windowMs)
    const ticksOrdenados = [...prices].sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt))
    const tickAnterior   = ticksOrdenados.slice().reverse().find(t => new Date(t.capturedAt) <= cutoff)

    if (tickAnterior && precioActual < Number(tickAnterior.price)) {
      logger.debug('Precio cayendo intradiario, postergando alerta', {
        symbol:            this.asset.symbol,
        precioActual,
        precioHaceNHoras:  Number(tickAnterior.price),
      })
      return SIGNALS.HOLD
    }

    // Evitar alerta duplicada el mismo día
    const hoy = new Date().toDateString()
    if (this.lastAlertDate === hoy) return SIGNALS.HOLD
    this.lastAlertDate = hoy

    this.lastSignalData = {
      score:      result.score,
      confidence: result.confidence,
      signals:    result.details,
      price:      precioActual,
    }

    logger.info('Señal de compra generada', {
      symbol:     this.asset.symbol,
      score:      result.score,
      confidence: result.confidence,
      precio:     precioActual,
      signals:    result.details,
    })

    return SIGNALS.BUY
  }
}
