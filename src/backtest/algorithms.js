import { sma, rsi, bollingerBands, atr } from './indicators.js'

export function rsiMeanReversion(bars, params = {}) {
  const { rsiPeriod = 14, oversold = 30, overbought = 70 } = params
  const signals = []
  let inPosition = false

  for (let i = rsiPeriod; i < bars.length; i++) {
    const closes  = bars.slice(0, i + 1).map(b => Number(b.close))
    const rsiVal  = rsi(closes, rsiPeriod)
    if (rsiVal === null) continue

    if (!inPosition && rsiVal < oversold) {
      signals.push({ date: bars[i].date, action: 'BUY', price: Number(bars[i].close), index: i })
      inPosition = true
    } else if (inPosition && rsiVal > overbought) {
      signals.push({ date: bars[i].date, action: 'SELL', price: Number(bars[i].close), index: i })
      inPosition = false
    }
  }
  return signals
}

export function momentum(bars, params = {}) {
  const { window: w = 20, threshold = 0.05 } = params
  const signals = []
  let inPosition = false

  for (let i = w; i < bars.length; i++) {
    const closeCur  = Number(bars[i].close)
    const closeBase = Number(bars[i - w].close)
    const retorno   = (closeCur - closeBase) / closeBase

    if (!inPosition && retorno > threshold) {
      signals.push({ date: bars[i].date, action: 'BUY', price: closeCur, index: i })
      inPosition = true
    } else if (inPosition && retorno < -threshold) {
      signals.push({ date: bars[i].date, action: 'SELL', price: closeCur, index: i })
      inPosition = false
    }
  }
  return signals
}

export function bollingerReversion(bars, params = {}) {
  const { period = 20, stdDev = 2 } = params
  const signals = []
  let inPosition = false

  for (let i = period; i < bars.length; i++) {
    const closes = bars.slice(0, i + 1).map(b => Number(b.close))
    const bb     = bollingerBands(closes, period, stdDev)
    if (bb === null) continue
    const close = Number(bars[i].close)

    if (!inPosition && close < bb.lower) {
      signals.push({ date: bars[i].date, action: 'BUY', price: close, index: i })
      inPosition = true
    } else if (inPosition && close > bb.upper) {
      signals.push({ date: bars[i].date, action: 'SELL', price: close, index: i })
      inPosition = false
    }
  }
  return signals
}

export function maCrossover(bars, params = {}) {
  const { fastPeriod = 20, slowPeriod = 50 } = params
  const signals = []
  let inPosition = false

  for (let i = slowPeriod; i < bars.length; i++) {
    const closes     = bars.slice(0, i + 1).map(b => Number(b.close))
    const closesPrev = bars.slice(0, i).map(b => Number(b.close))

    const maFast     = sma(closes,     fastPeriod)
    const maSlow     = sma(closes,     slowPeriod)
    const maFastPrev = sma(closesPrev, fastPeriod)
    const maSlowPrev = sma(closesPrev, slowPeriod)
    if (maFast === null || maSlow === null || maFastPrev === null || maSlowPrev === null) continue

    const crossUp   = maFastPrev <= maSlowPrev && maFast > maSlow
    const crossDown = maFastPrev >= maSlowPrev && maFast < maSlow

    if (!inPosition && crossUp) {
      signals.push({ date: bars[i].date, action: 'BUY', price: Number(bars[i].close), index: i })
      inPosition = true
    } else if (inPosition && crossDown) {
      signals.push({ date: bars[i].date, action: 'SELL', price: Number(bars[i].close), index: i })
      inPosition = false
    }
  }
  return signals
}

export function atrBreakout(bars, params = {}) {
  const { atrPeriod = 14, multiplier = 1.5 } = params
  const signals = []
  let inPosition = false

  for (let i = atrPeriod + 1; i < bars.length; i++) {
    const highs  = bars.slice(0, i + 1).map(b => Number(b.high))
    const lows   = bars.slice(0, i + 1).map(b => Number(b.low))
    const closes = bars.slice(0, i + 1).map(b => Number(b.close))

    const atrVal = atr(highs, lows, closes, atrPeriod)
    if (atrVal === null) continue

    const prevClose      = Number(bars[i - 1].close)
    const close          = Number(bars[i].close)
    const rangeSuperior  = prevClose + multiplier * atrVal
    const rangeInferior  = prevClose - multiplier * atrVal

    if (!inPosition && close > rangeSuperior) {
      signals.push({ date: bars[i].date, action: 'BUY', price: close, index: i })
      inPosition = true
    } else if (inPosition && close < rangeInferior) {
      signals.push({ date: bars[i].date, action: 'SELL', price: close, index: i })
      inPosition = false
    }
  }
  return signals
}
