export function sma(closes, period) {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  return slice.reduce((sum, p) => sum + p, 0) / period
}

export function ema(closes, period) {
  if (closes.length < period) return null
  const k = 2 / (period + 1)
  let val = closes.slice(0, period).reduce((sum, p) => sum + p, 0) / period
  for (let i = period; i < closes.length; i++) {
    val = closes[i] * k + val * (1 - k)
  }
  return val
}

export function rsi(closes, period) {
  if (closes.length < period + 1) return null
  const changes = []
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1])
  let avgGain = 0, avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export function bollingerBands(closes, period, stdDev = 2) {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const middle = slice.reduce((sum, p) => sum + p, 0) / period
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period
  const sd = Math.sqrt(variance)
  return { upper: middle + stdDev * sd, middle, lower: middle - stdDev * sd }
}

export function atr(highs, lows, closes, period) {
  if (closes.length < period + 1) return null
  const trs = []
  for (let i = 1; i < closes.length; i++) {
    const hl   = highs[i]  - lows[i]
    const hpc  = Math.abs(highs[i]  - closes[i - 1])
    const lpc  = Math.abs(lows[i]   - closes[i - 1])
    trs.push(Math.max(hl, hpc, lpc))
  }
  if (trs.length < period) return null
  return trs.slice(-period).reduce((sum, v) => sum + v, 0) / period
}
