import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/persistence/assetRepository.js')
vi.mock('../../../src/persistence/priceHistoryRepository.js')
vi.mock('../../../src/backtest/dollarBenchmark.js')
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const DOLLAR_MOCK = {
  appreciation: 900,
  source:       'fallback',
  fromRate:     100,
  toRate:       1000,
  fromDate:     new Date('2022-01-01'),
  toDate:       new Date(),
}

describe('evaluateValidity', () => {
  it('< MIN_TRADES → valid=false, invalidReason=pocos_trades', async () => {
    const { evaluateValidity } = await import('../../../src/backtest/backtestV2Runner.js')
    const result = evaluateValidity(5, 5000, 100)
    expect(result.valid).toBe(false)
    expect(result.invalidReason).toBe('pocos_trades')
  })

  it('>= MIN_TRADES pero alpha negativo → valid=false, invalidReason=no_gana_dolar', async () => {
    const { evaluateValidity } = await import('../../../src/backtest/backtestV2Runner.js')
    const result = evaluateValidity(10, 50, 900)
    expect(result.valid).toBe(false)
    expect(result.invalidReason).toBe('no_gana_dolar')
    expect(result.alpha).toBeLessThan(0)
  })

  it('>= MIN_TRADES y alpha positivo → valid=true', async () => {
    const { evaluateValidity } = await import('../../../src/backtest/backtestV2Runner.js')
    const result = evaluateValidity(10, 5000, 100)
    expect(result.valid).toBe(true)
    expect(result.invalidReason).toBe(null)
    expect(result.alpha).toBeGreaterThan(0)
  })
})

describe('buildConsolidatedTable + declareWinner', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('declareWinner con todos descalificados retorna null', async () => {
    const { declareWinner } = await import('../../../src/backtest/backtestV2Runner.js')
    const disqualified = [
      { algorithm: 'RSI Mean Reversion',  descalificado: true, validCount: 0, totalAssets: 3 },
      { algorithm: 'Momentum',            descalificado: true, validCount: 0, totalAssets: 3 },
      { algorithm: 'Bollinger Reversion', descalificado: true, validCount: 0, totalAssets: 3 },
      { algorithm: 'MA Crossover',        descalificado: true, validCount: 0, totalAssets: 3 },
      { algorithm: 'ATR Breakout',        descalificado: true, validCount: 0, totalAssets: 3 },
    ]
    expect(declareWinner(disqualified)).toBe(null)
  })

  it('declareWinner con un ganador claro retorna ese algoritmo', async () => {
    const { declareWinner } = await import('../../../src/backtest/backtestV2Runner.js')
    const results = [
      { algorithm: 'RSI Mean Reversion',  descalificado: false, sharpe: 2.5, totalReturn: 800, validCount: 3, totalAssets: 3 },
      { algorithm: 'Momentum',            descalificado: false, sharpe: 0.8, totalReturn: 300, validCount: 2, totalAssets: 3 },
      { algorithm: 'Bollinger Reversion', descalificado: true,  validCount: 0, totalAssets: 3 },
      { algorithm: 'MA Crossover',        descalificado: false, sharpe: 1.2, totalReturn: 400, validCount: 2, totalAssets: 3 },
      { algorithm: 'ATR Breakout',        descalificado: true,  validCount: 0, totalAssets: 3 },
    ]
    const winner = declareWinner(results)
    expect(winner).not.toBe(null)
    expect(winner.algorithm).toBe('RSI Mean Reversion')
  })

  it('buildConsolidatedTable con resultados mixed: valid y no válidos por activo', async () => {
    const { buildConsolidatedTable } = await import('../../../src/backtest/backtestV2Runner.js')
    const results = [
      { symbol: 'GGAL', algorithm: 'RSI Mean Reversion', totalTrades: 3, totalReturn: 500, winRate: 100, maxDrawdown: 0, sharpe: 2, alpha: 400, valid: false, invalidReason: 'pocos_trades' },
      { symbol: 'BBAR', algorithm: 'RSI Mean Reversion', totalTrades: 10, totalReturn: 1000, winRate: 80, maxDrawdown: 5, sharpe: 3, alpha: 100, valid: true, invalidReason: null },
    ]
    const consolidated = buildConsolidatedTable(results)
    const rsiRow = consolidated.find(r => r.algorithm === 'RSI Mean Reversion')
    // Solo BBAR fue válido → validCount=1
    expect(rsiRow.descalificado).toBe(false)
    expect(rsiRow.validCount).toBe(1)
    expect(rsiRow.totalReturn).toBe(1000)
  })
})

describe('runBacktestV2 — integración con mocks', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('activo con barras insuficientes es saltado', async () => {
    const { findAll }            = await import('../../../src/persistence/assetRepository.js')
    const { getRange }           = await import('../../../src/persistence/priceHistoryRepository.js')
    const { getDollarAppreciation } = await import('../../../src/backtest/dollarBenchmark.js')

    findAll.mockResolvedValue([{ id: 1, symbol: 'GGAL', market: 'bCBA' }])
    getRange.mockResolvedValue([])  // 0 barras → insuficiente
    getDollarAppreciation.mockResolvedValue(DOLLAR_MOCK)

    const { runBacktestV2 } = await import('../../../src/backtest/backtestV2Runner.js')
    const { results } = await runBacktestV2()

    expect(results).toHaveLength(0)
  })

  it('barras planas (sin señales) → todos los algoritmos con pocos_trades', async () => {
    const { findAll }            = await import('../../../src/persistence/assetRepository.js')
    const { getRange }           = await import('../../../src/persistence/priceHistoryRepository.js')
    const { getDollarAppreciation } = await import('../../../src/backtest/dollarBenchmark.js')

    const flatBars = Array.from({ length: 100 }, (_, i) => ({
      date: new Date(2022, 0, i + 1), open: 100, high: 100, low: 100, close: 100, volume: 1000,
    }))
    findAll.mockResolvedValue([{ id: 1, symbol: 'GGAL', market: 'bCBA' }])
    getRange.mockResolvedValue(flatBars)
    getDollarAppreciation.mockResolvedValue(DOLLAR_MOCK)

    const { runBacktestV2 } = await import('../../../src/backtest/backtestV2Runner.js')
    const { results } = await runBacktestV2()

    // Precio plano → 0 señales → 0 trades < MIN_TRADES → pocos_trades
    for (const r of results) {
      expect(r.valid).toBe(false)
      expect(r.invalidReason).toBe('pocos_trades')
    }
  })
})
