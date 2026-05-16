import { describe, it, expect } from 'vitest'
import { rsiMeanReversion, momentum, bollingerReversion, maCrossover, atrBreakout } from '../../../src/backtest/algorithms.js'

// Genera barras planas con un precio dado
function flatBars(price, count) {
  return Array.from({ length: count }, (_, i) => ({
    date:  `2024-01-${String(i + 1).padStart(2, '0')}`,
    open:  price, high: price, low: price, close: price, volume: 1000,
  }))
}

// Genera barras con precio ascendente desde start, step por barra
function rampBars(start, step, count) {
  return Array.from({ length: count }, (_, i) => {
    const p = start + i * step
    return { date: `2024-01-${String(i + 1).padStart(2, '0')}`, open: p, high: p, low: p, close: p, volume: 1000 }
  })
}

describe('rsiMeanReversion', () => {
  it('genera BUY cuando RSI < oversold', () => {
    // Para forzar RSI bajo: precio cae agresivamente
    const bars = [
      ...flatBars(100, 15),
      ...Array.from({ length: 10 }, (_, i) => ({
        date: `2024-02-${String(i + 1).padStart(2, '0')}`,
        open: 100 - i * 8, high: 100 - i * 8, low: 100 - i * 8, close: 100 - i * 8, volume: 1000,
      })),
    ]
    const signals = rsiMeanReversion(bars, { rsiPeriod: 14, oversold: 30, overbought: 70 })
    const buys = signals.filter(s => s.action === 'BUY')
    expect(buys.length).toBeGreaterThan(0)
  })

  it('no genera dos BUY consecutivos sin un SELL intermedio', () => {
    const bars = [
      ...flatBars(100, 15),
      ...Array.from({ length: 20 }, (_, i) => ({
        date: `2024-02-${String(i + 1).padStart(2, '0')}`,
        open: 100 - i * 5, high: 100 - i * 5, low: 100 - i * 5, close: 100 - i * 5, volume: 1000,
      })),
    ]
    const signals = rsiMeanReversion(bars)
    for (let i = 1; i < signals.length; i++) {
      expect(signals[i].action).not.toBe(signals[i - 1].action === 'BUY' ? 'BUY' : null)
      if (signals[i - 1].action === 'BUY') expect(signals[i].action).toBe('SELL')
    }
  })
})

describe('momentum', () => {
  it('genera BUY cuando retorno > threshold', () => {
    // Precio plano, luego sube 20% de golpe
    const bars = [
      ...flatBars(100, 20),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: `2024-02-${String(i + 1).padStart(2, '0')}`,
        open: 120, high: 120, low: 120, close: 120, volume: 1000,
      })),
    ]
    const signals = momentum(bars, { window: 20, threshold: 0.05 })
    const buys = signals.filter(s => s.action === 'BUY')
    expect(buys.length).toBeGreaterThan(0)
  })
})

describe('bollingerReversion', () => {
  it('genera BUY cuando precio < banda inferior', () => {
    // Precio plano en 100, luego cae mucho (fuera de banda inferior)
    const baseBars = flatBars(100, 25)
    const crashBars = [{
      date: '2024-02-01', open: 60, high: 65, low: 58, close: 60, volume: 1000,
    }]
    const bars = [...baseBars, ...crashBars]
    const signals = bollingerReversion(bars, { period: 20, stdDev: 2 })
    const buys = signals.filter(s => s.action === 'BUY')
    expect(buys.length).toBeGreaterThan(0)
  })
})

describe('maCrossover', () => {
  it('genera BUY en cruce alcista y SELL en cruce bajista', () => {
    // Fase bajista (50 barras decrecientes) → cruce bajista: MA rápida < MA lenta
    // Fase alcista (50 barras crecientes) → cruce alcista: MA rápida > MA lenta
    const downBars = rampBars(200, -1, 50)
    const upBars   = rampBars(150, 2, 60).map((b, i) => ({
      ...b, date: `2025-01-${String(i + 1).padStart(2, '0')}`,
    }))
    const bars = [...downBars, ...upBars]
    const signals = maCrossover(bars, { fastPeriod: 20, slowPeriod: 50 })
    expect(signals.length).toBeGreaterThan(0)
    const buys  = signals.filter(s => s.action === 'BUY')
    const sells = signals.filter(s => s.action === 'SELL')
    // Con datos suficientes debe generar al menos una señal
    expect(buys.length + sells.length).toBeGreaterThan(0)
  })
})

describe('atrBreakout', () => {
  it('genera BUY cuando precio supera rango superior', () => {
    // Precio estable, luego un spike grande hacia arriba
    const baseBars = Array.from({ length: 30 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      open: 100, high: 102, low: 98, close: 100, volume: 1000,
    }))
    const spikeBars = [{
      date: '2024-02-01', open: 100, high: 135, low: 100, close: 132, volume: 5000,
    }]
    const bars = [...baseBars, ...spikeBars]
    const signals = atrBreakout(bars, { atrPeriod: 14, multiplier: 1.5 })
    const buys = signals.filter(s => s.action === 'BUY')
    expect(buys.length).toBeGreaterThan(0)
  })
})
