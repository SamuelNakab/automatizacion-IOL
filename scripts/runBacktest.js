import 'dotenv/config'
import fs                         from 'fs'
import * as assetRepository        from '../src/persistence/assetRepository.js'
import * as priceHistoryRepository from '../src/persistence/priceHistoryRepository.js'
import prisma                      from '../src/persistence/prismaClient.js'
import { rsiMeanReversion, momentum, bollingerReversion, maCrossover, atrBreakout } from '../src/backtest/algorithms.js'
import { simulate, calcMetrics }   from '../src/backtest/simulator.js'

const ALGORITHMS = [
  { name: 'RSI Mean Reversion',   fn: rsiMeanReversion  },
  { name: 'Momentum',             fn: momentum          },
  { name: 'Bollinger Reversion',  fn: bollingerReversion },
  { name: 'MA Crossover',         fn: maCrossover       },
  { name: 'ATR Breakout',         fn: atrBreakout       },
]

const INITIAL_CAPITAL = 100000
const MIN_BARS        = 60

function pad(str, len) {
  return String(str).padEnd(len)
}
function padL(str, len) {
  return String(str).padStart(len)
}

function printTable(rows) {
  const line = '─'.repeat(106)
  console.log(`┌${line}┐`)
  console.log(`│ ${pad('Activo', 7)} │ ${pad('Algoritmo', 22)} │ ${padL('Return', 8)} │ ${padL('WinRate', 8)} │ ${padL('Drawdown', 9)} │ ${padL('Sharpe', 8)} │ ${padL('Trades', 7)} │`)
  console.log(`├${line}┤`)
  for (const r of rows) {
    const ret  = r.totalReturn >= 0 ? `+${r.totalReturn}%` : `${r.totalReturn}%`
    const win  = `${r.winRate}%`
    const dd   = `-${r.maxDrawdown}%`
    const sh   = `${r.sharpe}`
    console.log(`│ ${pad(r.symbol, 7)} │ ${pad(r.algorithm, 22)} │ ${padL(ret, 8)} │ ${padL(win, 8)} │ ${padL(dd, 9)} │ ${padL(sh, 8)} │ ${padL(r.totalTrades, 7)} │`)
  }
  console.log(`└${line}┘`)
}

async function main() {
  console.log('\n=== BACKTESTING — Trading Bot IOL ===\n')

  const assets = await assetRepository.findAll()
  const allRows = []

  for (const asset of assets) {
    const rawBars = await priceHistoryRepository.getLatest(asset.id, 2000)
    const bars    = [...rawBars].sort((a, b) => new Date(a.date) - new Date(b.date))

    if (bars.length < MIN_BARS) {
      console.log(`⚠ ${asset.symbol}: solo ${bars.length} barras (mínimo ${MIN_BARS}) — saltando`)
      continue
    }

    console.log(`\n--- ${asset.symbol} (${bars.length} barras) ---`)

    const assetRows = []
    for (const algo of ALGORITHMS) {
      const signals = algo.fn(bars)
      const { trades, finalCapital } = simulate(signals, bars, INITIAL_CAPITAL)
      const metrics = calcMetrics(trades, INITIAL_CAPITAL, finalCapital)
      assetRows.push({ symbol: asset.symbol, algorithm: algo.name, ...metrics })
    }
    printTable(assetRows)
    allRows.push(...assetRows)
  }

  // Tabla consolidada — promedio por algoritmo
  console.log('\n=== TABLA CONSOLIDADA (promedio entre activos) ===\n')
  const consolidated = ALGORITHMS.map(algo => {
    const rows = allRows.filter(r => r.algorithm === algo.name)
    if (rows.length === 0) return { algorithm: algo.name, totalReturn: 0, winRate: 0, maxDrawdown: 0, sharpe: 0, totalTrades: 0 }
    const avg = key => parseFloat((rows.reduce((s, r) => s + r[key], 0) / rows.length).toFixed(2))
    return {
      symbol:      'PROMEDIO',
      algorithm:   algo.name,
      totalReturn: avg('totalReturn'),
      winRate:     avg('winRate'),
      maxDrawdown: avg('maxDrawdown'),
      sharpe:      parseFloat((rows.reduce((s, r) => s + r.sharpe, 0) / rows.length).toFixed(3)),
      totalTrades: Math.round(rows.reduce((s, r) => s + r.totalTrades, 0) / rows.length),
    }
  })
  printTable(consolidated)

  // Ganador: mayor sharpe; desempate por totalReturn
  const winner = [...consolidated].sort((a, b) =>
    b.sharpe !== a.sharpe ? b.sharpe - a.sharpe : b.totalReturn - a.totalReturn
  )[0]

  console.log(`\n${'='.repeat(72)}`)
  console.log(`=== GANADOR: ${winner.algorithm} — Sharpe: ${winner.sharpe} | Return: ${winner.totalReturn >= 0 ? '+' : ''}${winner.totalReturn}% | WinRate: ${winner.winRate}% ===`)
  console.log(`${'='.repeat(72)}\n`)

  // Generar docs/backtest_results.md
  const mdLines = [
    '# Backtest Results\n',
    `**Fecha:** ${new Date().toISOString().substring(0, 10)}`,
    `**Capital inicial:** $${INITIAL_CAPITAL.toLocaleString()}`,
    `**Barras mínimas para incluir activo:** ${MIN_BARS}\n`,
    '## Resultados por activo\n',
    '| Activo | Algoritmo | Return | WinRate | Drawdown | Sharpe | Trades |',
    '|--------|-----------|--------|---------|----------|--------|--------|',
    ...allRows.map(r =>
      `| ${r.symbol} | ${r.algorithm} | ${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn}% | ${r.winRate}% | -${r.maxDrawdown}% | ${r.sharpe} | ${r.totalTrades} |`
    ),
    '\n## Tabla consolidada (promedio entre activos)\n',
    '| Algoritmo | Return | WinRate | Drawdown | Sharpe | Trades |',
    '|-----------|--------|---------|----------|--------|--------|',
    ...consolidated.map(r =>
      `| ${r.algorithm} | ${r.totalReturn >= 0 ? '+' : ''}${r.totalReturn}% | ${r.winRate}% | -${r.maxDrawdown}% | ${r.sharpe} | ${r.totalTrades} |`
    ),
    `\n## Ganador\n`,
    `**${winner.algorithm}**`,
    `- Sharpe: ${winner.sharpe}`,
    `- Return promedio: ${winner.totalReturn >= 0 ? '+' : ''}${winner.totalReturn}%`,
    `- WinRate promedio: ${winner.winRate}%`,
    `- Drawdown promedio: -${winner.maxDrawdown}%`,
    `- Trades promedio: ${winner.totalTrades}`,
    `\n_Este resultado determina qué algoritmo implementar en myStrategy.js (Fase Nueva B)._`,
  ]
  fs.writeFileSync('docs/backtest_results.md', mdLines.join('\n'))
  console.log('docs/backtest_results.md generado.')

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Error en backtest:', err.message)
  process.exit(1)
})
