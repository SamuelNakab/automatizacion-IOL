import { describe, it, expect } from 'vitest'
import SmaCrossover from '../../../src/strategy/strategies/smaCrossover.js'
import { SIGNALS } from '../../../src/shared/constants.js'

const asset = { id: 1, symbol: 'GGAL', market: 'bCBA', type: 'accion' }

// 30 precios bajos luego 20 precios altos → sma20 > sma50 → BUY
// sma20 = 200, sma50 = (30×100 + 20×200)/50 = 140
function makeBuyPrices() {
  return [
    ...Array(30).fill(null).map(() => ({ price: 100 })),
    ...Array(20).fill(null).map(() => ({ price: 200 })),
  ]
}

// 30 precios altos luego 20 precios bajos → sma20 < sma50 → SELL
function makeSellPrices() {
  return [
    ...Array(30).fill(null).map(() => ({ price: 200 })),
    ...Array(20).fill(null).map(() => ({ price: 100 })),
  ]
}

describe('SmaCrossover.evaluate()', () => {
  it('retorna BUY cuando sma20 > sma50', async () => {
    const strategy = new SmaCrossover(asset)
    const signal   = await strategy.run(makeBuyPrices())
    expect(signal).toBe(SIGNALS.BUY)
  })

  it('retorna SELL cuando sma20 < sma50', async () => {
    const strategy = new SmaCrossover(asset)
    const signal   = await strategy.run(makeSellPrices())
    expect(signal).toBe(SIGNALS.SELL)
  })

  it('retorna HOLD cuando sma20 o sma50 son null (datos insuficientes)', async () => {
    const strategy = new SmaCrossover(asset)
    // Con menos de 50 precios, sma50 = null → HOLD
    const fewPrices = Array(10).fill(null).map(() => ({ price: 100 }))
    const signal    = await strategy.run(fewPrices)
    expect(signal).toBe(SIGNALS.HOLD)
  })

  it('retorna HOLD cuando sma20 === sma50', async () => {
    const strategy = new SmaCrossover(asset)
    const flat     = Array(50).fill(null).map(() => ({ price: 100 }))
    const signal   = await strategy.run(flat)
    expect(signal).toBe(SIGNALS.HOLD)
  })
})
