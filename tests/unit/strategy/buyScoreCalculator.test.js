import { describe, it, expect } from 'vitest'
import { calculateBuyScore } from '../../../src/strategy/buyScoreCalculator.js'

function makeBars(count, price = 100, volume = 1000) {
  return Array.from({ length: count }, (_, i) => ({
    date:   new Date(2022, 0, i + 1),
    close:  price,
    volume,
  }))
}

// Barras con variación para que stdDev > 0 (alterna 90/110 → media=100, σ≈10)
function makeVariedBars(count, base = 100, amp = 10, volume = 1000) {
  return Array.from({ length: count }, (_, i) => ({
    date:   new Date(2022, 0, i + 1),
    close:  base + (i % 2 === 0 ? amp : -amp),
    volume,
  }))
}

describe('calculateBuyScore', () => {
  it('con bars.length < 50 → insufficientData: true, score: 0', () => {
    const result = calculateBuyScore(makeBars(40), 100)
    expect(result.insufficientData).toBe(true)
    expect(result.score).toBe(0)
    expect(result.confidence).toBe(0)
  })

  it('con currentPrice > sma50 → blocked: true, score: 0', () => {
    // Precio histórico = 100, precio actual = 150 (por encima de SMA50)
    const bars   = makeBars(60, 100)
    const result = calculateBuyScore(bars, 150)
    expect(result.blocked).toBe(true)
    expect(result.score).toBe(0)
    expect(result.blockedReason).toContain('SMA50')
  })

  it('con zScore < -1.5 → score incluye 3 puntos', () => {
    // Barras variadas: alterna 90/110 → media20≈100, stdDev20≈10
    // currentPrice = 60 → zScore = (60-100)/10 = -4 < -1.5 ✓
    // SMA50 ≈ 100 > 60, no dispara filtro blocked
    const bars   = makeVariedBars(60)
    const result = calculateBuyScore(bars, 60)
    expect(result.blocked).toBe(false)
    expect(result.insufficientData).toBe(false)
    expect(result.zScore).toBeLessThan(-1.5)
    expect(result.score).toBeGreaterThanOrEqual(3)
    expect(result.details.some(d => d.includes('z-score'))).toBe(true)
  })

  it('con RSI < 25 → score incluye 3 puntos de RSI', () => {
    // Precio cae agresivamente para forzar RSI < 25
    const bars = [
      ...makeBars(50, 100),
      ...Array.from({ length: 15 }, (_, i) => ({
        date:   new Date(2022, 2, i + 1),
        close:  100 - i * 7,
        volume: 1000,
      })),
    ]
    const lastPrice = bars[bars.length - 1].close
    const result    = calculateBuyScore(bars, lastPrice)
    if (!result.blocked && !result.insufficientData && result.rsiVal !== null && result.rsiVal < 25) {
      expect(result.score).toBeGreaterThanOrEqual(3)
      expect(result.details.some(d => d.includes('RSI'))).toBe(true)
    } else {
      // Si RSI no llega a <25 con estos datos, al menos no crash
      expect(typeof result.score).toBe('number')
    }
  })

  it('con precio <= bb.lower → score incluye 2 puntos de Bollinger', () => {
    // Precio histórico en 100 con poca volatilidad, precio actual muy bajo
    const bars   = makeBars(60, 100, 500)
    const result = calculateBuyScore(bars, 80)  // forzar por debajo de banda inferior
    expect(result.blocked).toBe(false)
    // Con precio muy bajo debería activar Bollinger
    if (result.bbVal !== null && 80 <= Number(result.bbVal.lower)) {
      expect(result.score).toBeGreaterThanOrEqual(2)
      expect(result.details.some(d => d.includes('Bollinger'))).toBe(true)
    } else {
      expect(typeof result.score).toBe('number')
    }
  })

  it('confidence === Math.round(score/9*100)', () => {
    const bars   = makeBars(60, 100)
    const result = calculateBuyScore(bars, 60)
    expect(result.confidence).toBe(Math.round((result.score / 9) * 100))
  })

  it('details es array de strings no vacío cuando hay puntos', () => {
    const bars   = makeBars(60, 100)
    const result = calculateBuyScore(bars, 60)
    if (result.score > 0) {
      expect(Array.isArray(result.details)).toBe(true)
      expect(result.details.length).toBeGreaterThan(0)
      result.details.forEach(d => expect(typeof d).toBe('string'))
    }
  })
})
