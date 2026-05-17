import { sma, rsi, bollingerBands } from './indicators.js'

export function stdDev(arr) {
  if (arr.length === 0) return 0
  const media   = arr.reduce((a, b) => a + b, 0) / arr.length
  const varianza = arr.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / arr.length
  return Math.sqrt(varianza)
}

export function calculateBuyScore(bars, currentPrice) {
  if (bars.length < 50) {
    return { score: 0, confidence: 0, details: [], blocked: false, insufficientData: true }
  }

  const closes    = bars.map(b => Number(b.close))
  const volumes   = bars.map(b => Number(b.volume || 0))
  const closes20  = closes.slice(-20)
  const volumes10 = volumes.slice(-10)

  // Filtro duro SMA50
  const sma50val = sma(closes, 50)
  if (sma50val === null) {
    return { score: 0, confidence: 0, details: [], blocked: true, blockedReason: 'SMA50 no calculable' }
  }
  if (currentPrice > sma50val) {
    return {
      score: 0, confidence: 0, details: [], blocked: true,
      blockedReason: `Precio por encima de SMA50 (${sma50val.toFixed(2)}) — no es oportunidad de compra`,
    }
  }

  const media20    = closes20.reduce((a, b) => a + b, 0) / closes20.length
  const desvio20   = stdDev(closes20)
  const zScore     = desvio20 > 0 ? (currentPrice - media20) / desvio20 : 0
  const rsiVal     = rsi(closes, 14)
  const bbVal      = bollingerBands(closes, 20, 2)
  const mediaVol10 = volumes10.reduce((a, b) => a + b, 0) / volumes10.length
  const volHoy     = volumes[volumes.length - 1]

  let score   = 0
  const details = []

  // Z-Score
  if (zScore < -1.5) {
    score += 3
    details.push(`Precio muy bajo históricamente (z-score: ${zScore.toFixed(2)})`)
  } else if (zScore < -1.0) {
    score += 1
    details.push(`Precio algo bajo históricamente (z-score: ${zScore.toFixed(2)})`)
  }

  // RSI
  if (rsiVal !== null) {
    if (rsiVal < 25) {
      score += 3
      details.push(`Sobreventa extrema (RSI: ${rsiVal.toFixed(1)})`)
    } else if (rsiVal < 35) {
      score += 2
      details.push(`Sobrevendido (RSI: ${rsiVal.toFixed(1)})`)
    }
  }

  // Bollinger
  if (bbVal !== null) {
    if (currentPrice <= Number(bbVal.lower)) {
      score += 2
      details.push(`Toca banda inferior de Bollinger ($${Number(bbVal.lower).toFixed(2)})`)
    } else if (currentPrice < Number(bbVal.middle)) {
      score += 1
      details.push('En zona baja de Bollinger')
    }
  }

  // Volumen
  if (mediaVol10 > 0 && volHoy > mediaVol10) {
    score += 1
    details.push(`Volumen elevado (${(volHoy / mediaVol10).toFixed(1)}x promedio)`)
  }

  const confidence = Math.round((score / 9) * 100)

  return { score, confidence, details, blocked: false, insufficientData: false, zScore, rsiVal, bbVal }
}
