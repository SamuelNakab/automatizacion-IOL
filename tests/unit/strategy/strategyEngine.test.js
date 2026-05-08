import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/persistence/assetRepository.js')
vi.mock('../../../src/persistence/priceTickRepository.js')
vi.mock('../../../src/persistence/decisionRepository.js')
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Precios que generan BUY con SmaCrossover:
// 30 precios bajos luego 20 altos → sma20 (200) > sma50 (140) → BUY
// getLatest devuelve newest first → los proveemos en orden DESC
const BUY_PRICES_DESC = [
  ...Array(20).fill(null).map(() => ({ price: '200' })),
  ...Array(30).fill(null).map(() => ({ price: '100' })),
]

describe('strategyEngine.runCycle()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('llama a assetRepository.findAll() y priceTickRepository.getLatest() por cada activo', async () => {
    const { findAll }   = await import('../../../src/persistence/assetRepository.js')
    const { getLatest } = await import('../../../src/persistence/priceTickRepository.js')

    findAll.mockResolvedValue([{ id: 1, symbol: 'GGAL', market: 'bCBA', type: 'accion', active: true }])
    getLatest.mockResolvedValue([]) // sin precios → HOLD

    const { runCycle } = await import('../../../src/strategy/strategyEngine.js')
    await runCycle()

    expect(findAll).toHaveBeenCalledOnce()
    expect(getLatest).toHaveBeenCalledWith(1, 100) // assetId=1, HISTORY_LIMIT=100
  })

  it('persiste decision cuando la señal es BUY y la retorna en decisions[]', async () => {
    const { findAll }   = await import('../../../src/persistence/assetRepository.js')
    const { getLatest } = await import('../../../src/persistence/priceTickRepository.js')
    const { insert }    = await import('../../../src/persistence/decisionRepository.js')

    findAll.mockResolvedValue([{ id: 1, symbol: 'GGAL', market: 'bCBA', type: 'accion', active: true }])
    getLatest.mockResolvedValue(BUY_PRICES_DESC)
    insert.mockResolvedValue({ id: 1, assetId: 1, signal: 'BUY', priceAtDecision: 200 })

    const { runCycle } = await import('../../../src/strategy/strategyEngine.js')
    const result = await runCycle()

    expect(insert).toHaveBeenCalledWith(1, 'BUY', 'smaCrossover', expect.anything(), null)
    expect(result.decisions).toHaveLength(1)
    expect(result.decisions[0].signal).toBe('BUY')
    expect(result.decisions[0].asset.symbol).toBe('GGAL')
  })

  it('NO persiste decision cuando la señal es HOLD', async () => {
    const { findAll }   = await import('../../../src/persistence/assetRepository.js')
    const { getLatest } = await import('../../../src/persistence/priceTickRepository.js')
    const { insert }    = await import('../../../src/persistence/decisionRepository.js')

    findAll.mockResolvedValue([{ id: 1, symbol: 'GGAL', market: 'bCBA', type: 'accion', active: true }])
    getLatest.mockResolvedValue([])
    insert.mockResolvedValue({ id: 1 })

    const { runCycle } = await import('../../../src/strategy/strategyEngine.js')
    const result = await runCycle()

    expect(insert).not.toHaveBeenCalled()
    expect(result.decisions).toHaveLength(0)
  })

  it('un error en un activo no interrumpe el procesamiento de los demás', async () => {
    const { findAll }   = await import('../../../src/persistence/assetRepository.js')
    const { getLatest } = await import('../../../src/persistence/priceTickRepository.js')
    const { insert }    = await import('../../../src/persistence/decisionRepository.js')

    findAll.mockResolvedValue([
      { id: 1, symbol: 'GGAL', market: 'bCBA', type: 'accion', active: true },
      { id: 2, symbol: 'YPFD', market: 'bCBA', type: 'accion', active: true },
    ])
    getLatest
      .mockRejectedValueOnce(new Error('DB error simulado'))
      .mockResolvedValueOnce([])

    const { runCycle } = await import('../../../src/strategy/strategyEngine.js')
    const results = await runCycle()

    expect(insert).not.toHaveBeenCalled()
    expect(results.HOLD).toBe(1) // solo YPFD completó
  })
})
