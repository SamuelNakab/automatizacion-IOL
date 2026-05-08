import { describe, it, expect } from 'vitest'
import BaseStrategy from '../../../src/strategy/baseStrategy.js'
import { SIGNALS } from '../../../src/shared/constants.js'

// Subclase de prueba que no implementa evaluate()
class NoEvaluate extends BaseStrategy {
  constructor() { super({ id: 1, symbol: 'TEST', market: 'bCBA', type: 'accion' }) }
}

// Subclase que devuelve señal inválida
class BadSignal extends BaseStrategy {
  constructor() { super({ id: 1, symbol: 'TEST', market: 'bCBA', type: 'accion' }) }
  evaluate() { return 'INVALID_SIGNAL' }
}

// Subclase válida que devuelve HOLD
class AlwaysHold extends BaseStrategy {
  constructor() { super({ id: 1, symbol: 'TEST', market: 'bCBA', type: 'accion' }) }
  evaluate() { return SIGNALS.HOLD }
}

const makePrice = (price) => ({ price, open: price, high: price, low: price, volume: 0, timestamp: new Date() })

describe('BaseStrategy.run()', () => {
  it('lanza error si evaluate() no está implementado', async () => {
    const strategy = new NoEvaluate()
    const prices   = [makePrice(100), makePrice(101)]
    await expect(strategy.run(prices)).rejects.toThrow('evaluate() debe ser implementado por la subclase')
  })

  it('lanza error si evaluate() retorna señal inválida', async () => {
    const strategy = new BadSignal()
    const prices   = [makePrice(100), makePrice(101)]
    await expect(strategy.run(prices)).rejects.toThrow('evaluate() retornó señal inválida: INVALID_SIGNAL')
  })

  it('retorna HOLD inmediatamente sin llamar a evaluate() cuando prices.length < 2', async () => {
    const strategy = new NoEvaluate()
    // Con 0 precios, run() debe retornar HOLD sin llamar evaluate() (que lanzaría error)
    expect(await strategy.run([])).toBe(SIGNALS.HOLD)
    // Con 1 precio, igual
    expect(await strategy.run([makePrice(100)])).toBe(SIGNALS.HOLD)
  })

  it('retorna la señal de evaluate() cuando es válida', async () => {
    const strategy = new AlwaysHold()
    const prices   = [makePrice(100), makePrice(101)]
    expect(await strategy.run(prices)).toBe(SIGNALS.HOLD)
  })
})

describe('BaseStrategy.computeIndicators()', () => {
  it('retorna objeto con todas las claves de indicadores', () => {
    const strategy = new AlwaysHold()
    const prices   = Array.from({ length: 30 }, (_, i) => makePrice(100 + i))
    const ind      = strategy.computeIndicators(prices)
    expect(ind).toHaveProperty('sma20')
    expect(ind).toHaveProperty('sma50')
    expect(ind).toHaveProperty('ema20')
    expect(ind).toHaveProperty('rsi14')
    expect(ind).toHaveProperty('bb20')
    expect(ind).toHaveProperty('macd')
  })

  it('retorna null en indicadores con período mayor al array disponible', () => {
    const strategy = new AlwaysHold()
    const prices   = Array.from({ length: 10 }, (_, i) => makePrice(100 + i))
    const ind      = strategy.computeIndicators(prices)
    expect(ind.sma20).toBeNull() // necesita 20
    expect(ind.sma50).toBeNull() // necesita 50
    expect(ind.macd).toBeNull()  // necesita 34
  })
})
