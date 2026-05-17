import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/persistence/positionRepository.js')
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const makePrices = (price) => [{ price, capturedAt: new Date() }]

describe('SellTakeProfitStrategy', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('sin posición → HOLD', async () => {
    const { findByAsset } = await import('../../../src/persistence/positionRepository.js')
    findByAsset.mockResolvedValue(null)

    const { default: SellTakeProfitStrategy } = await import('../../../src/strategy/strategies/sellTakeProfitStrategy.js')
    const strategy = new SellTakeProfitStrategy({ id: 1, symbol: 'GGAL', market: 'bCBA' })
    const signal   = await strategy.evaluate(makePrices(120), {})

    expect(signal).toBe('HOLD')
  })

  it('con posición, precio < objetivo → HOLD', async () => {
    const { findByAsset } = await import('../../../src/persistence/positionRepository.js')
    findByAsset.mockResolvedValue({ quantity: 100, avgCost: 100 })

    process.env.TAKE_PROFIT_PCT = '8'
    const { default: SellTakeProfitStrategy } = await import('../../../src/strategy/strategies/sellTakeProfitStrategy.js')
    const strategy = new SellTakeProfitStrategy({ id: 1, symbol: 'GGAL', market: 'bCBA' })
    const signal   = await strategy.evaluate(makePrices(105), {})  // objetivo = 108

    expect(signal).toBe('HOLD')
  })

  it('con posición, precio === objetivo exacto → SELL', async () => {
    const { findByAsset } = await import('../../../src/persistence/positionRepository.js')
    findByAsset.mockResolvedValue({ quantity: 100, avgCost: 100 })

    process.env.TAKE_PROFIT_PCT = '8'
    const { default: SellTakeProfitStrategy } = await import('../../../src/strategy/strategies/sellTakeProfitStrategy.js')
    const strategy = new SellTakeProfitStrategy({ id: 1, symbol: 'GGAL', market: 'bCBA' })
    const signal   = await strategy.evaluate(makePrices(108), {})  // objetivo = 108 exacto

    expect(signal).toBe('SELL')
  })

  it('con posición, precio > objetivo → SELL', async () => {
    const { findByAsset } = await import('../../../src/persistence/positionRepository.js')
    findByAsset.mockResolvedValue({ quantity: 50, avgCost: 200 })

    process.env.TAKE_PROFIT_PCT = '10'
    const { default: SellTakeProfitStrategy } = await import('../../../src/strategy/strategies/sellTakeProfitStrategy.js')
    const strategy = new SellTakeProfitStrategy({ id: 1, symbol: 'GGAL', market: 'bCBA' })
    const signal   = await strategy.evaluate(makePrices(250), {})  // objetivo = 220

    expect(signal).toBe('SELL')
  })

  it('logger.debug llamado con avgCost, objetivo y precioActual', async () => {
    const { findByAsset } = await import('../../../src/persistence/positionRepository.js')
    findByAsset.mockResolvedValue({ quantity: 100, avgCost: 100 })
    const logger = (await import('../../../src/shared/logger.js')).default

    process.env.TAKE_PROFIT_PCT = '8'
    const { default: SellTakeProfitStrategy } = await import('../../../src/strategy/strategies/sellTakeProfitStrategy.js')
    const strategy = new SellTakeProfitStrategy({ id: 1, symbol: 'GGAL', market: 'bCBA' })
    await strategy.evaluate(makePrices(105), {})

    expect(logger.debug).toHaveBeenCalledWith(
      'Verificando take profit',
      expect.objectContaining({ avgCost: 100, objetivo: 108, precioActual: 105 })
    )
  })
})
