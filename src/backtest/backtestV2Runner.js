import * as assetRepository        from '../persistence/assetRepository.js'
import * as priceHistoryRepository from '../persistence/priceHistoryRepository.js'
import { getDollarAppreciation }    from './dollarBenchmark.js'
import { rsiMeanReversion, momentum, bollingerReversion, maCrossover, atrBreakout } from './algorithms.js'
import { simulate, calcMetrics }    from './simulator.js'
import logger                       from '../shared/logger.js'

export const BACKTEST_FROM_DATE = new Date('2022-01-01')
export const MIN_TRADES         = 8
const INITIAL_CAPITAL           = 100000
const MIN_BARS                  = 60

export const ALGORITHMS = [
  { name: 'RSI Mean Reversion',  fn: rsiMeanReversion   },
  { name: 'Momentum',            fn: momentum           },
  { name: 'Bollinger Reversion', fn: bollingerReversion },
  { name: 'MA Crossover',        fn: maCrossover        },
  { name: 'ATR Breakout',        fn: atrBreakout        },
]

export function evaluateValidity(totalTrades, totalReturn, dollarAppreciation) {
  const alpha         = parseFloat((totalReturn - dollarAppreciation).toFixed(2))
  const valid         = totalTrades >= MIN_TRADES && alpha > 0
  const invalidReason = !valid
    ? (totalTrades < MIN_TRADES ? 'pocos_trades' : 'no_gana_dolar')
    : null
  return { alpha, vsDolorPct: alpha, valid, invalidReason }
}

export async function runBacktestV2() {
  const assets = await assetRepository.findAll()

  const dollarData = await getDollarAppreciation(BACKTEST_FROM_DATE, new Date())
  logger.info(
    `Benchmark dólar (${dollarData.source}): +${dollarData.appreciation}% ` +
    `(${dollarData.fromRate} → ${dollarData.toRate} ARS/USD)`
  )

  const results = []

  for (const asset of assets) {
    const rawBars = await priceHistoryRepository.getRange(asset.id, BACKTEST_FROM_DATE, new Date())
    const bars    = [...rawBars].sort((a, b) => new Date(a.date) - new Date(b.date))

    if (bars.length < MIN_BARS) {
      logger.info(`${asset.symbol}: insuficiente (${bars.length} barras desde 2022)`)
      continue
    }

    for (const algo of ALGORITHMS) {
      const signals              = algo.fn(bars)
      const { trades, finalCapital } = simulate(signals, bars, INITIAL_CAPITAL)
      const metrics              = calcMetrics(trades, INITIAL_CAPITAL, finalCapital)
      const validity             = evaluateValidity(metrics.totalTrades, metrics.totalReturn, dollarData.appreciation)

      results.push({
        symbol:    asset.symbol,
        algorithm: algo.name,
        ...metrics,
        ...validity,
      })
    }
  }

  return { results, dollarData, fromDate: BACKTEST_FROM_DATE }
}

export function buildConsolidatedTable(results) {
  const totalAssets = new Set(results.map(r => r.symbol)).size

  return ALGORITHMS.map(algo => {
    const validRows = results.filter(r => r.algorithm === algo.name && r.valid)

    if (validRows.length === 0) {
      return {
        algorithm:           algo.name,
        descalificado:       true,
        descalificadoReason: 'no valid assets',
        validCount:          0,
        totalAssets,
      }
    }

    const avg = key => parseFloat(
      (validRows.reduce((s, r) => s + r[key], 0) / validRows.length).toFixed(2)
    )

    return {
      algorithm:     algo.name,
      descalificado: false,
      totalReturn:   avg('totalReturn'),
      winRate:       avg('winRate'),
      maxDrawdown:   avg('maxDrawdown'),
      sharpe:        parseFloat(
        (validRows.reduce((s, r) => s + r.sharpe, 0) / validRows.length).toFixed(3)
      ),
      alpha:         avg('alpha'),
      totalTrades:   Math.round(validRows.reduce((s, r) => s + r.totalTrades, 0) / validRows.length),
      validCount:    validRows.length,
      totalAssets,
    }
  })
}

export function declareWinner(consolidatedResults) {
  const totalAssets = consolidatedResults[0]?.totalAssets ?? 0
  const threshold   = Math.ceil(totalAssets / 2)

  const eligible = consolidatedResults.filter(
    r => !r.descalificado && r.validCount >= threshold
  )
  if (eligible.length === 0) return null

  return eligible.sort((a, b) =>
    b.sharpe !== a.sharpe ? b.sharpe - a.sharpe : b.totalReturn - a.totalReturn
  )[0]
}
