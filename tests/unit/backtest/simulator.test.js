import { describe, it, expect } from 'vitest'
import { simulate, calcMetrics } from '../../../src/backtest/simulator.js'

const BARS = [
  { date: '2024-01-01', close: 100 },
  { date: '2024-01-10', close: 120 },
  { date: '2024-01-20', close: 90  },
]

describe('simulate', () => {
  it('BUY seguido de SELL retorna trade con PnL correcto', () => {
    const signals = [
      { date: '2024-01-01', action: 'BUY',  price: 100 },
      { date: '2024-01-10', action: 'SELL', price: 120 },
    ]
    const { trades, finalCapital } = simulate(signals, BARS, 100000)
    expect(trades).toHaveLength(1)
    const trade = trades[0]
    expect(trade.buyPrice).toBe(100)
    expect(trade.sellPrice).toBe(120)
    expect(trade.won).toBe(true)
    // pnl = quantity * (120-100), finalCapital ≈ 100000 + ganancia
    expect(finalCapital).toBeGreaterThan(100000)
    expect(trade.pnlPct).toBeCloseTo(20, 1)
  })

  it('capital insuficiente para comprar ni 1 unidad: no genera trade', () => {
    const signals = [
      { date: '2024-01-01', action: 'BUY',  price: 999999 },
      { date: '2024-01-10', action: 'SELL', price: 1100000 },
    ]
    const { trades } = simulate(signals, BARS, 1000)
    expect(trades).toHaveLength(0)
  })

  it('posición abierta al final se cierra al último precio', () => {
    const signals = [{ date: '2024-01-01', action: 'BUY', price: 100 }]
    const bars = [{ date: '2024-01-01', close: 100 }, { date: '2024-01-20', close: 90 }]
    const { trades } = simulate(signals, bars, 100000)
    expect(trades).toHaveLength(1)
    expect(trades[0].sellDate).toBe('open')
    expect(trades[0].sellPrice).toBe(90)
    expect(trades[0].won).toBe(false)
  })
})

describe('calcMetrics', () => {
  it('0 trades retorna valores seguros sin dividir por cero', () => {
    const metrics = calcMetrics([], 100000, 100000)
    expect(metrics.totalTrades).toBe(0)
    expect(metrics.winRate).toBe(0)
    expect(metrics.sharpe).toBe(0)
    expect(metrics.totalReturn).toBe(0)
  })

  it('winRate = 100% si todos los trades son ganadores', () => {
    const trades = [
      { pnl: 500,  pnlPct: 5,  won: true },
      { pnl: 300,  pnlPct: 3,  won: true },
      { pnl: 1000, pnlPct: 10, won: true },
    ]
    const metrics = calcMetrics(trades, 100000, 101800)
    expect(metrics.winRate).toBe(100)
    expect(metrics.totalTrades).toBe(3)
    expect(metrics.totalReturn).toBeCloseTo(1.8, 1)
  })
})
