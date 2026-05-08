import { describe, it, expect } from 'vitest'
import RiskManager from '../../../src/risk/riskManager.js'

// Configuración fija para tests — no depende de process.env
const CONFIG = {
  MAX_CAPITAL_PER_TRADE_PCT:      10,
  MAX_EXPOSURE_PER_ASSET_PCT:     20,
  MAX_TOTAL_EXPOSURE_PCT:         60,
  MAX_DRAWDOWN_PCT:               15,
  MIN_OPERATION_INTERVAL_MINUTES: 60,
}

const rm = new RiskManager(CONFIG)

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeBotState({ capitalTotal = 10000, capitalAvailable = 10000, peakCapital = 10000 } = {}) {
  return { capitalTotal, capitalAvailable, peakCapital }
}

function makeDecision({ assetId = 1, signal = 'BUY', priceAtDecision = 100, symbol = 'GGAL' } = {}) {
  return { assetId, signal, priceAtDecision, asset: { symbol } }
}

function makePosition({ assetId = 1, quantity = 0, currentPrice = 100 } = {}) {
  return { assetId, quantity, currentPrice }
}

const NO_ORDERS = new Map()

// ── REGLA 1: Drawdown ────────────────────────────────────────────────────────

describe('REGLA 1 — Drawdown', () => {
  it('rechaza BUY cuando drawdown >= MAX_DRAWDOWN_PCT', () => {
    // peakCapital=10000, capitalTotal=8000 → drawdown = 20% >= 15%
    const botState = makeBotState({ capitalTotal: 8000, capitalAvailable: 8000, peakCapital: 10000 })
    const result   = rm.validate(makeDecision({ signal: 'BUY' }), botState, [], NO_ORDERS)
    expect(result.approved).toBe(false)
    expect(result.reason).toMatch(/drawdown/i)
  })

  it('aprueba SELL aunque drawdown >= MAX_DRAWDOWN_PCT', () => {
    const botState = makeBotState({ capitalTotal: 8000, capitalAvailable: 8000, peakCapital: 10000 })
    // drawdown=20% pero es SELL → no aplica la restricción
    // Capital 8000, price=100 → cantidadEstimada = floor(8000*10%/100) = 8 ≥ 1 → pasa capital
    const result = rm.validate(makeDecision({ signal: 'SELL', priceAtDecision: 100 }), botState, [], NO_ORDERS)
    expect(result.approved).toBe(true)
  })

  it('aprueba BUY cuando drawdown < MAX_DRAWDOWN_PCT', () => {
    // peakCapital=10000, capitalTotal=9000 → drawdown = 10% < 15%
    const botState = makeBotState({ capitalTotal: 9000, capitalAvailable: 9000, peakCapital: 10000 })
    const result   = rm.validate(makeDecision({ signal: 'BUY', priceAtDecision: 100 }), botState, [], NO_ORDERS)
    expect(result.approved).toBe(true)
  })
})

// ── REGLA 2: Intervalo mínimo ────────────────────────────────────────────────

describe('REGLA 2 — Intervalo mínimo entre operaciones', () => {
  it('rechaza si la última orden fue hace menos de MIN_OPERATION_INTERVAL_MINUTES', () => {
    const lastOrders = new Map([[1, new Date(Date.now() - 30 * 60 * 1000)]]) // 30 min atrás
    const result     = rm.validate(makeDecision(), makeBotState(), [], lastOrders)
    expect(result.approved).toBe(false)
    expect(result.reason).toMatch(/intervalo/i)
  })

  it('aprueba si la última orden fue hace más de MIN_OPERATION_INTERVAL_MINUTES', () => {
    const lastOrders = new Map([[1, new Date(Date.now() - 90 * 60 * 1000)]]) // 90 min atrás
    const result     = rm.validate(makeDecision(), makeBotState(), [], lastOrders)
    expect(result.approved).toBe(true)
  })

  it('aprueba si no hay orden previa para el activo', () => {
    const result = rm.validate(makeDecision(), makeBotState(), [], NO_ORDERS)
    expect(result.approved).toBe(true)
  })
})

// ── REGLA 3: Capital por operación ──────────────────────────────────────────

describe('REGLA 3 — Capital disponible por operación', () => {
  it('rechaza cuando capitalAvailable es insuficiente para comprar 1 unidad', () => {
    // capitalAvailable=100, price=1000, MAX_CAPITAL=10% → cantidadEstimada=floor(10/1000)=0 < 1
    const botState = makeBotState({ capitalAvailable: 100 })
    const result   = rm.validate(makeDecision({ priceAtDecision: 1000 }), botState, [], NO_ORDERS)
    expect(result.approved).toBe(false)
    expect(result.reason).toMatch(/capital insuficiente/i)
  })

  it('aprueba cuando hay capital para al menos 1 unidad', () => {
    // capitalAvailable=10000, price=100, MAX_CAPITAL=10% → cantidadEstimada=floor(1000/100)=10 ≥ 1
    const result = rm.validate(makeDecision({ priceAtDecision: 100 }), makeBotState(), [], NO_ORDERS)
    expect(result.approved).toBe(true)
  })
})

// ── REGLA 4: Exposición por activo ──────────────────────────────────────────

describe('REGLA 4 — Exposición máxima por activo (solo BUY)', () => {
  it('rechaza BUY si la posición existente supera MAX_EXPOSURE_PER_ASSET_PCT', () => {
    // capitalTotal=10000, quantity=30, price=100 → posición=3000 → 30% >= 20%
    const positions = [makePosition({ quantity: 30, currentPrice: 100 })]
    const result    = rm.validate(
      makeDecision({ signal: 'BUY', priceAtDecision: 100 }),
      makeBotState(),
      positions,
      NO_ORDERS
    )
    expect(result.approved).toBe(false)
    expect(result.reason).toMatch(/exposición.*activo/i)
  })

  it('aprueba BUY si la posición existente está por debajo del límite', () => {
    // capitalTotal=10000, quantity=10, price=100 → posición=1000 → 10% < 20%
    const positions = [makePosition({ quantity: 10, currentPrice: 100 })]
    const result    = rm.validate(
      makeDecision({ signal: 'BUY', priceAtDecision: 100 }),
      makeBotState(),
      positions,
      NO_ORDERS
    )
    expect(result.approved).toBe(true)
  })

  it('SELL siempre pasa la regla de exposición por activo', () => {
    // Posición al 50% → rechazaría BUY, pero es SELL → no aplica
    const positions = [makePosition({ quantity: 50, currentPrice: 100 })]
    const result    = rm.validate(
      makeDecision({ signal: 'SELL', priceAtDecision: 100 }),
      makeBotState(),
      positions,
      NO_ORDERS
    )
    expect(result.approved).toBe(true)
  })
})

// ── REGLA 5: Exposición total del portafolio ─────────────────────────────────

describe('REGLA 5 — Exposición total del portafolio (solo BUY)', () => {
  it('rechaza BUY si el total expuesto supera MAX_TOTAL_EXPOSURE_PCT', () => {
    // capitalTotal=10000, posición de 7000 (70%) >= 60%
    const positions = [
      makePosition({ assetId: 2, quantity: 100, currentPrice: 70 }),
    ]
    const result = rm.validate(
      makeDecision({ signal: 'BUY', priceAtDecision: 100 }),
      makeBotState(),
      positions,
      NO_ORDERS
    )
    expect(result.approved).toBe(false)
    expect(result.reason).toMatch(/exposición total/i)
  })

  it('aprueba BUY si el total expuesto está por debajo del límite', () => {
    // capitalTotal=10000, posición de 5000 (50%) < 60%
    const positions = [
      makePosition({ assetId: 2, quantity: 100, currentPrice: 50 }),
    ]
    const result = rm.validate(
      makeDecision({ signal: 'BUY', priceAtDecision: 100 }),
      makeBotState(),
      positions,
      NO_ORDERS
    )
    expect(result.approved).toBe(true)
  })

  it('SELL siempre pasa la regla de exposición total', () => {
    const positions = [
      makePosition({ assetId: 2, quantity: 100, currentPrice: 80 }), // 80% expuesto
    ]
    const result = rm.validate(
      makeDecision({ signal: 'SELL', priceAtDecision: 100 }),
      makeBotState(),
      positions,
      NO_ORDERS
    )
    expect(result.approved).toBe(true)
  })
})

// ── Caso feliz completo ───────────────────────────────────────────────────────

describe('Caso happy path', () => {
  it('aprueba cuando todas las reglas pasan e incluye quantity calculada', () => {
    // capitalAvailable=10000, MAX_CAPITAL=10%, price=100 → quantity=floor(1000/100)=10
    const result = rm.validate(
      makeDecision({ signal: 'BUY', priceAtDecision: 100 }),
      makeBotState({ capitalTotal: 10000, capitalAvailable: 10000, peakCapital: 10000 }),
      [],
      NO_ORDERS
    )
    expect(result.approved).toBe(true)
    expect(result.reason).toBe('OK')
    expect(result.quantity).toBe(10)
  })
})
