export function simulate(signals, bars, initialCapital = 100000) {
  let capital  = initialCapital
  let position = null
  const trades = []

  for (const signal of signals) {
    if (signal.action === 'BUY' && position === null) {
      const quantity = Math.floor(capital * 0.95 / signal.price)
      if (quantity < 1) continue
      capital  -= quantity * signal.price
      position  = { buyPrice: signal.price, quantity, buyDate: signal.date }
    } else if (signal.action === 'SELL' && position !== null) {
      const proceeds = position.quantity * signal.price
      const pnl      = proceeds - position.quantity * position.buyPrice
      const pnlPct   = pnl / (position.quantity * position.buyPrice) * 100
      capital += proceeds
      trades.push({
        buyDate:   position.buyDate,
        sellDate:  signal.date,
        buyPrice:  position.buyPrice,
        sellPrice: signal.price,
        quantity:  position.quantity,
        pnl,
        pnlPct,
        won: pnl > 0,
      })
      position = null
    }
  }

  if (position !== null) {
    const lastPrice = Number(bars[bars.length - 1].close)
    const proceeds  = position.quantity * lastPrice
    const pnl       = proceeds - position.quantity * position.buyPrice
    const pnlPct    = pnl / (position.quantity * position.buyPrice) * 100
    capital += proceeds
    trades.push({
      buyDate:   position.buyDate,
      sellDate:  'open',
      buyPrice:  position.buyPrice,
      sellPrice: lastPrice,
      quantity:  position.quantity,
      pnl,
      pnlPct,
      won: pnl > 0,
    })
  }

  return { trades, finalCapital: capital }
}

function stdDev(values) {
  if (values.length === 0) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

export function calcMetrics(trades, initialCapital, finalCapital) {
  if (trades.length === 0) {
    return { totalReturn: 0, winRate: 0, avgPnlPct: 0, maxDrawdown: 0, sharpe: 0, totalTrades: 0 }
  }

  const totalReturn = (finalCapital - initialCapital) / initialCapital * 100
  const winRate     = trades.filter(t => t.won).length / trades.length * 100
  const avgPnlPct   = trades.reduce((sum, t) => sum + t.pnlPct, 0) / trades.length

  const sd = stdDev(trades.map(t => t.pnlPct))
  const sharpe = sd === 0 ? 0 : avgPnlPct / sd

  // Máximo drawdown sobre curva de capital acumulada
  let peak = initialCapital
  let runningCapital = initialCapital
  let maxDrawdown = 0
  for (const trade of trades) {
    runningCapital += trade.pnl
    if (runningCapital > peak) peak = runningCapital
    const dd = (peak - runningCapital) / peak * 100
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  return {
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    winRate:     parseFloat(winRate.toFixed(2)),
    avgPnlPct:   parseFloat(avgPnlPct.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    sharpe:      parseFloat(sharpe.toFixed(3)),
    totalTrades: trades.length,
  }
}
