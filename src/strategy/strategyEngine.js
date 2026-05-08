import * as assetRepository    from '../persistence/assetRepository.js'
import * as priceTickRepository from '../persistence/priceTickRepository.js'
import * as decisionRepository  from '../persistence/decisionRepository.js'
import logger                   from '../shared/logger.js'
import { SIGNALS, HISTORY_LIMIT, STRATEGY_MAP_KEY } from '../shared/constants.js'
import SmaCrossover from './strategies/smaCrossover.js'
// import MyStrategy from './strategies/myStrategy.js'

// Para usar tu estrategia personalizada: reemplazar SmaCrossover por MyStrategy en este mapa.
// Solo se cambia acá — ningún otro módulo se modifica.
const STRATEGY_MAP = {
  [STRATEGY_MAP_KEY('GGAL', 'bCBA')]: SmaCrossover,
  [STRATEGY_MAP_KEY('YPFD', 'bCBA')]: SmaCrossover,
  [STRATEGY_MAP_KEY('GD35', 'bCBA')]: SmaCrossover,
}

// Cache de instancias: una por activo para mantener estado entre ciclos
const strategyInstances = new Map()

function getStrategy(asset) {
  const key = STRATEGY_MAP_KEY(asset.symbol, asset.market)
  if (!strategyInstances.has(key)) {
    const StrategyClass = STRATEGY_MAP[key] ?? SmaCrossover
    strategyInstances.set(key, new StrategyClass(asset))
  }
  return strategyInstances.get(key)
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

      const strategy = getStrategy(asset)
      const signal   = await strategy.run(prices)

      const lastPrice = prices.length > 0 ? Number(prices[prices.length - 1].price) : null

      logger.info('Señal generada', {
        symbol:   asset.symbol,
        signal,
        price:    lastPrice,
        strategy: strategy.name,
      })

      if (signal === SIGNALS.BUY || signal === SIGNALS.SELL) {
        const dbDecision = await decisionRepository.insert(asset.id, signal, strategy.name, lastPrice, null)
        decisions.push({
          ...dbDecision,
          priceAtDecision: Number(dbDecision.priceAtDecision),
          asset: { symbol: asset.symbol },
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

  // Retorna conteos (backward-compatible) + array de decisiones para Risk Manager
  return { ...results, decisions }
}
