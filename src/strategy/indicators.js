// Funciones puras de cálculo de indicadores técnicos.
// Todas reciben arrays de números (precios cierre), devuelven número u objeto.
// Sin efectos secundarios, sin imports externos.

export function sma(prices, period) {
  if (prices.length < period) return null
  const slice = prices.slice(-period)
  return slice.reduce((sum, p) => sum + p, 0) / period
}

export function ema(prices, period) {
  if (prices.length < period) return null
  const k = 2 / (period + 1)
  let emaVal = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period
  for (let i = period; i < prices.length; i++) {
    emaVal = prices[i] * k + emaVal * (1 - k)
  }
  return emaVal
}

export function rsi(prices, period) {
  // Necesita al menos period+1 precios para calcular period variaciones
  if (prices.length < period + 1) return null

  const changes = []
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1])
  }

  // Promedio inicial (simple) de las primeras `period` variaciones
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period

  // Suavizado de Wilder para el resto
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

export function bollingerBands(prices, period, stdDevMult = 2) {
  if (prices.length < period) return null
  const slice = prices.slice(-period)
  const middle = slice.reduce((sum, p) => sum + p, 0) / period
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period
  const sd = Math.sqrt(variance)
  return {
    upper:  middle + stdDevMult * sd,
    middle,
    lower:  middle - stdDevMult * sd,
  }
}

export function macd(prices, fast = 12, slow = 26, signalPeriod = 9) {
  // Necesita slow+signalPeriod-1 precios para calcular la línea de señal
  if (prices.length < slow + signalPeriod - 1) return null

  const fastK   = 2 / (fast + 1)
  const slowK   = 2 / (slow + 1)
  const signalK = 2 / (signalPeriod + 1)

  // Fast EMA inicializado hasta el índice slow-1 (para alinear con slow EMA)
  let fastEma = prices.slice(0, fast).reduce((s, p) => s + p, 0) / fast
  for (let i = fast; i < slow; i++) {
    fastEma = prices[i] * fastK + fastEma * (1 - fastK)
  }

  let slowEma = prices.slice(0, slow).reduce((s, p) => s + p, 0) / slow

  // Línea MACD: un valor por cada precio desde el índice slow-1
  const macdLine = [fastEma - slowEma]
  for (let i = slow; i < prices.length; i++) {
    fastEma = prices[i] * fastK + fastEma * (1 - fastK)
    slowEma = prices[i] * slowK + slowEma * (1 - slowK)
    macdLine.push(fastEma - slowEma)
  }

  // Línea de señal: EMA de la línea MACD
  let signalEma = macdLine.slice(0, signalPeriod).reduce((s, v) => s + v, 0) / signalPeriod
  for (let i = signalPeriod; i < macdLine.length; i++) {
    signalEma = macdLine[i] * signalK + signalEma * (1 - signalK)
  }

  const lastMacd = macdLine[macdLine.length - 1]
  return { macd: lastMacd, signal: signalEma, histogram: lastMacd - signalEma }
}
