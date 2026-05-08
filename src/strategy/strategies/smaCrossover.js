import BaseStrategy from '../baseStrategy.js'
import { SIGNALS } from '../../shared/constants.js'

export default class SmaCrossover extends BaseStrategy {
  constructor(asset) {
    super(asset)
    this.name = 'smaCrossover'
  }

  evaluate(prices, indicators) {
    const { sma20, sma50 } = indicators
    if (sma20 === null || sma50 === null) return SIGNALS.HOLD
    if (sma20 > sma50) return SIGNALS.BUY
    if (sma20 < sma50) return SIGNALS.SELL
    return SIGNALS.HOLD
  }
}
