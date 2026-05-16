import 'dotenv/config'
import fs from 'fs'
import { runBacktestV2, buildConsolidatedTable, declareWinner, ALGORITHMS, MIN_TRADES } from '../src/backtest/backtestV2Runner.js'
import prisma from '../src/persistence/prismaClient.js'

function pad(str, len)  { return String(str).padEnd(len) }
function padL(str, len) { return String(str).padStart(len) }

function fmtReturn(n) {
  return n >= 0 ? `+${n}%` : `${n}%`
}

function printV2Table(rows) {
  const line = '─'.repeat(122)
  console.log(`┌${line}┐`)
  console.log(
    `│ ${pad('Activo', 7)} │ ${pad('Algoritmo', 22)} │ ${padL('Return', 8)} │` +
    ` ${padL('vs Dólar', 9)} │ ${padL('WinRate', 8)} │ ${padL('Drawdown', 9)} │` +
    ` ${padL('Sharpe', 8)} │ ${padL('Trades', 7)} │ ${pad('Válido', 16)} │`
  )
  console.log(`├${line}┤`)

  for (const r of rows) {
    const validCol = r.valid
      ? '✓'
      : `✗ ${r.invalidReason ?? ''}`

    console.log(
      `│ ${pad(r.symbol ?? '', 7)} │ ${pad(r.algorithm, 22)} │ ${padL(fmtReturn(r.totalReturn), 8)} │` +
      ` ${padL(fmtReturn(r.alpha ?? 0), 9)} │ ${padL(`${r.winRate}%`, 8)} │ ${padL(`-${r.maxDrawdown}%`, 9)} │` +
      ` ${padL(String(r.sharpe), 8)} │ ${padL(String(r.totalTrades), 7)} │ ${pad(validCol, 16)} │`
    )
  }
  console.log(`└${line}┘`)
}

async function main() {
  console.log('\n=== BACKTESTING V2 — Trading Bot IOL ===')
  console.log(`Período: 01/01/2022 → hoy`)
  console.log(`Filtros: mínimo ${MIN_TRADES} trades | superar dólar\n`)

  const { results, dollarData } = await runBacktestV2()

  console.log(
    `📊 Benchmark: Dólar ${dollarData.source} +${dollarData.appreciation}% en el período` +
    ` (${dollarData.fromRate} ARS/USD → ${dollarData.toRate} ARS/USD)\n`
  )

  // Tabla por activo
  const symbols = [...new Set(results.map(r => r.symbol))]
  for (const symbol of symbols) {
    const rows = results.filter(r => r.symbol === symbol)
    console.log(`\n--- ${symbol} (${rows[0]?.totalTrades !== undefined ? '' : ''}${rows.length} algoritmos) ---`)
    printV2Table(rows)
  }

  // Tabla consolidada
  const consolidated = buildConsolidatedTable(results)
  const valid        = consolidated.filter(r => !r.descalificado)
  const disqualified = consolidated.filter(r => r.descalificado)

  if (valid.length > 0) {
    console.log('\n=== TABLA CONSOLIDADA (promedio sobre activos válidos) ===\n')
    printV2Table(valid.map(r => ({
      symbol:        'PROMEDIO',
      algorithm:     r.algorithm,
      totalReturn:   r.totalReturn,
      alpha:         r.alpha,
      winRate:       r.winRate,
      maxDrawdown:   r.maxDrawdown,
      sharpe:        r.sharpe,
      totalTrades:   r.totalTrades,
      valid:         true,
      invalidReason: null,
    })))
  }

  if (disqualified.length > 0) {
    console.log('\nAlgoritmos descalificados:')
    for (const d of disqualified) {
      console.log(`  ✗ ${d.algorithm} — ${d.descalificadoReason}`)
    }
  }

  // Ganador
  const winner = declareWinner(consolidated)
  const sep    = '='.repeat(78)
  console.log(`\n${sep}`)
  if (winner) {
    console.log(
      `=== GANADOR: ${winner.algorithm} — ` +
      `Sharpe: ${winner.sharpe} | Return: ${fmtReturn(winner.totalReturn)} | ` +
      `vs Dólar: ${fmtReturn(winner.alpha)} | WinRate: ${winner.winRate}% ===`
    )
  } else {
    console.log('=== Ningún algoritmo superó todos los filtros. Revisar parámetros. ===')
  }
  console.log(`${sep}\n`)

  // Generar markdown
  const lines = [
    '# Backtest V2 Results\n',
    `**Fecha:** ${new Date().toISOString().substring(0, 10)}`,
    `**Período:** 01/01/2022 → hoy`,
    `**Filtros:** mínimo ${MIN_TRADES} trades | superar dólar\n`,
    `## Benchmark dólar`,
    `- Fuente: ${dollarData.source}`,
    `- Apreciación: +${dollarData.appreciation}%`,
    `- Tipo de cambio: ${dollarData.fromRate} → ${dollarData.toRate} ARS/USD\n`,
    '## Resultados por activo\n',
    '| Activo | Algoritmo | Return | vs Dólar | WinRate | Drawdown | Sharpe | Trades | Válido |',
    '|--------|-----------|--------|----------|---------|----------|--------|--------|--------|',
    ...results.map(r =>
      `| ${r.symbol} | ${r.algorithm} | ${fmtReturn(r.totalReturn)} | ${fmtReturn(r.alpha)} | ` +
      `${r.winRate}% | -${r.maxDrawdown}% | ${r.sharpe} | ${r.totalTrades} | ` +
      `${r.valid ? '✓' : `✗ ${r.invalidReason}`} |`
    ),
    '\n## Tabla consolidada\n',
    '| Algoritmo | Return | vs Dólar | WinRate | Drawdown | Sharpe | Trades | Activos válidos |',
    '|-----------|--------|----------|---------|----------|--------|--------|-----------------|',
    ...consolidated.map(r =>
      r.descalificado
        ? `| ${r.algorithm} | — | — | — | — | — | — | DESCALIFICADO |`
        : `| ${r.algorithm} | ${fmtReturn(r.totalReturn)} | ${fmtReturn(r.alpha)} | ${r.winRate}% | -${r.maxDrawdown}% | ${r.sharpe} | ${r.totalTrades} | ${r.validCount}/${r.totalAssets} |`
    ),
    `\n## Ganador\n`,
    winner
      ? [
          `**${winner.algorithm}**`,
          `- Sharpe: ${winner.sharpe}`,
          `- Return promedio: ${fmtReturn(winner.totalReturn)}`,
          `- Exceso sobre dólar: ${fmtReturn(winner.alpha)}`,
          `- WinRate promedio: ${winner.winRate}%`,
          `- Drawdown promedio: -${winner.maxDrawdown}%`,
          `- Trades promedio: ${winner.totalTrades}`,
          `\n_Implementar en myStrategy.js en Fase Nueva B._`,
        ].join('\n')
      : '_Ningún algoritmo superó todos los filtros. Revisar parámetros._',
  ]

  fs.writeFileSync('docs/backtest_v2_results.md', lines.join('\n'))
  console.log('docs/backtest_v2_results.md generado.')

  await prisma.$disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Error en backtest V2:', err.message)
  process.exit(1)
})
