import { describe, it, expect } from 'vitest'
import { sma, ema, rsi, bollingerBands, macd } from '../../../src/strategy/indicators.js'

describe('sma', () => {
  it('retorna el promedio de los últimos period valores', () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4)
  })

  it('retorna null si el array tiene menos elementos que period', () => {
    expect(sma([1, 2], 3)).toBeNull()
    expect(sma([], 5)).toBeNull()
  })

  it('usa exactamente los últimos period valores (no todos)', () => {
    // sma de [3,4,5] = 4, ignorando el 1 y el 2
    expect(sma([1, 2, 3, 4, 5], 3)).toBeCloseTo(4)
    // sma de [4,5] = 4.5
    expect(sma([1, 2, 3, 4, 5], 2)).toBeCloseTo(4.5)
  })
})

describe('ema', () => {
  it('retorna null si el array es más corto que period', () => {
    expect(ema([1, 2], 5)).toBeNull()
  })

  it('retorna la media del único valor si period === prices.length', () => {
    // Con exactamente period valores, EMA = SMA (primer valor = promedio simple)
    expect(ema([10, 10, 10], 3)).toBeCloseTo(10)
  })

  it('da más peso a los precios recientes que SMA del mismo período', () => {
    // 20 precios bajos seguidos de un spike alto
    // SMA de los últimos 5 = (10+10+10+10+100)/5 = 28
    // EMA reacciona más rápido al spike → ~40 > 28
    const prices = [...Array(20).fill(10), 100]
    const emaVal = ema(prices, 5)
    const smaVal = sma(prices, 5)
    expect(emaVal).toBeGreaterThan(smaVal)
  })
})

describe('rsi', () => {
  it('retorna null con menos de period+1 precios', () => {
    expect(rsi([1, 2, 3], 14)).toBeNull()
    expect(rsi(Array(14).fill(100), 14)).toBeNull() // necesita 15
  })

  it('retorna número entre 0 y 100 con datos suficientes', () => {
    // 20 precios aleatorios con varianza real
    const prices = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
                    110, 108, 107, 109, 111, 110, 112, 111, 113, 115]
    const result = rsi(prices, 14)
    expect(result).not.toBeNull()
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(100)
  })

  it('retorna 100 cuando todos los cambios son positivos (sin pérdidas)', () => {
    const alwaysUp = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    expect(rsi(alwaysUp, 14)).toBe(100)
  })
})

describe('bollingerBands', () => {
  it('retorna null con menos elementos que period', () => {
    expect(bollingerBands([1, 2], 5)).toBeNull()
  })

  it('retorna upper > middle > lower para datos con varianza', () => {
    const prices = Array.from({ length: 20 }, (_, i) => i + 1) // [1..20]
    const bb = bollingerBands(prices, 20)
    expect(bb).not.toBeNull()
    expect(bb.upper).toBeGreaterThan(bb.middle)
    expect(bb.middle).toBeGreaterThan(bb.lower)
  })

  it('upper === lower === middle cuando todos los precios son iguales (sin varianza)', () => {
    const flat = Array(20).fill(100)
    const bb = bollingerBands(flat, 20)
    expect(bb.upper).toBeCloseTo(bb.middle)
    expect(bb.lower).toBeCloseTo(bb.middle)
  })

  it('middle es el SMA del período', () => {
    const prices = [1, 2, 3, 4, 5]
    const bb = bollingerBands(prices, 5)
    expect(bb.middle).toBeCloseTo(3) // (1+2+3+4+5)/5
  })
})

describe('macd', () => {
  it('retorna null con menos de slow+signal-1 precios', () => {
    // default: slow=26, signal=9 → necesita 34
    expect(macd(Array(33).fill(100))).toBeNull()
    expect(macd(Array(34).fill(100))).not.toBeNull()
  })

  it('retorna { macd, signal, histogram } con datos suficientes', () => {
    const prices = Array(50).fill(100)
    const result = macd(prices)
    expect(result).toHaveProperty('macd')
    expect(result).toHaveProperty('signal')
    expect(result).toHaveProperty('histogram')
  })

  it('histogram es la diferencia entre macd y signal', () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i)
    const result = macd(prices)
    expect(result.histogram).toBeCloseTo(result.macd - result.signal)
  })
})
