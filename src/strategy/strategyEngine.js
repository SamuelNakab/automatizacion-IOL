import * as assetRepository      from '../persistence/assetRepository.js'
import * as priceTickRepository  from '../persistence/priceTickRepository.js'
import * as decisionRepository   from '../persistence/decisionRepository.js'
import logger                    from '../shared/logger.js'
import { SIGNALS, HISTORY_LIMIT, STRATEGY_MAP_KEY } from '../shared/constants.js'
import SellTakeProfitStrategy    from './strategies/sellTakeProfitStrategy.js'
import BuyScoreStrategy          from './strategies/buyScoreStrategy.js'
// import MyStrategy from './strategies/myStrategy.js'

// Cache de instancias: una por activo por estrategia
const sellInstances = new Map()
const buyInstances  = new Map()

function getSellStrategy(asset) {
  const key = STRATEGY_MAP_KEY(asset.symbol, asset.market)
  if (!sellInstances.has(key)) sellInstances.set(key, new SellTakeProfitStrategy(asset))
  return sellInstances.get(key)
}

function getBuyStrategy(asset) {
  const key = STRATEGY_MAP_KEY(asset.symbol, asset.market)
  if (!buyInstances.has(key)) buyInstances.set(key, new BuyScoreStrategy(asset))
  return buyInstances.get(key)
}

export async function runCycle() {
  const assets    = await assetRepository.findAll()
  const results   = { BUY: 0, SELL: 0, HOLD: 0 }
  const decisions = []

  for (const asset of assets) {
    try {
      // getLatest devuelve más nuevo primero → invertir para la estrategia (más viejo primero)
      const pricesDesc = await priceTickRepository.getLatest(asset.id, HISTORY_LIMIT)
      const prices     = pricesDesc.slice().reverse()

      const lastPrice = prices.length > 0 ? Number(prices[prices.length - 1].price) : null

      // Prioridad: SELL primero, luego BUY
      const sellStrategy = getSellStrategy(asset)
      let signal         = await sellStrategy.run(prices)
      let strategyUsed   = sellStrategy

      if (signal !== SIGNALS.SELL) {
        const buyStrategy = getBuyStrategy(asset)
        signal      = await buyStrategy.run(prices)
        strategyUsed = buyStrategy
      }

      logger.info('Señal generada', {
        symbol:   asset.symbol,
        signal,
        price:    lastPrice,
        strategy: strategyUsed.name,
      })

      if (signal === SIGNALS.BUY || signal === SIGNALS.SELL) {
        const dbDecision = await decisionRepository.insert(
          asset.id, signal, strategyUsed.name, lastPrice, null
        )
        decisions.push({
          ...dbDecision,
          priceAtDecision:  Number(dbDecision.priceAtDecision),
          asset:            { symbol: asset.symbol, market: asset.market },
          strategyInstance: strategyUsed,
        })
      }

      results[signal] = (results[signal] ?? 0) + 1
    } catch (err) {
      logger.error('Error procesando activo en strategy cycle', {
        symbol: asset.symbol,
        error:  err.message,
      })
    }
  }

  return { ...results, decisions }
}
