import BaseStrategy       from '../baseStrategy.js'
import * as positionRepository from '../../persistence/positionRepository.js'
import { SIGNALS }        from '../../shared/constants.js'
import logger             from '../../shared/logger.js'

export default class SellTakeProfitStrategy extends BaseStrategy {
  constructor(asset) {
    super(asset)
    this.name             = 'sellTakeProfit'
    this.takeProfitPct    = Number(process.env.TAKE_PROFIT_PCT || 8)
    this.lastDecisionData = null
  }

  async evaluate(prices, indicators) {
    const position = await positionRepository.findByAsset(this.asset.id)

    if (!position || Number(position.quantity) <= 0) {
      this.lastDecisionData = null
      return SIGNALS.HOLD
    }

    if (prices.length === 0) return SIGNALS.HOLD

    const precioActual = Number(prices[prices.length - 1].price)
    const avgCost      = Number(position.avgCost)
    const objetivo     = avgCost * (1 + this.takeProfitPct / 100)

    this.lastDecisionData = { takeProfitPct: this.takeProfitPct, avgCost, targetPrice: objetivo }

    logger.debug('Verificando take profit', {
      symbol:         this.asset.symbol,
      precioActual,
      avgCost,
      objetivo,
      takeProfitPct:  this.takeProfitPct,
      alcanzado:      precioActual >= objetivo,
    })

    if (precioActual >= objetivo) {
      logger.info('Take profit alcanzado', {
        symbol:    this.asset.symbol,
        precioActual,
        avgCost,
        objetivo,
        ganancia:  ((precioActual - avgCost) / avgCost * 100).toFixed(2) + '%',
      })
      return SIGNALS.SELL
    }

    return SIGNALS.HOLD
  }
}
