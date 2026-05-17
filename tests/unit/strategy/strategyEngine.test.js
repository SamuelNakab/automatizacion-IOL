import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/persistence/assetRepository.js')
vi.mock('../../../src/persistence/priceTickRepository.js')
vi.mock('../../../src/persistence/decisionRepository.js')
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Mocks compartidos para controlar el retorno de run() en cada test
const mockSellRun = vi.fn().mockResolvedValue('HOLD')
const mockBuyRun  = vi.fn().mockResolvedValue('HOLD')

vi.mock('../../../src/strategy/strategies/sellTakeProfitStrategy.js', () => ({
  default: vi.fn(() => ({ name: 'sellTakeProfit', run: mockSellRun })),
}))
vi.mock('../../../src/strategy/strategies/buyScoreStrategy.js', () => ({
  default: vi.fn(() => ({ name: 'buyScore', run: mockBuyRun, lastSignalData: null })),
}))

describe('strategyEngine.runCycle()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockSellRun.mockResolvedValue('HOLD')
    mockBuyRun.mockResolvedValue('HOLD')
  })

  it('llama a assetRepository.findAll() y priceTickRepository.getLatest() por cada activo', async () => {
    const { findAll }   = await import('../../../src/persistence/assetRepository.js')
    const { getLatest } = await import('../../../src/persistence/priceTickRepository.js')

    findAll.mockResolvedValue([{ id: 1, symbol: 'GGAL', market: 'bCBA', type: 'accion', active: true }])
    getLatest.mockResolvedValue([])

    const { runCycle } = await import('../../../src/strategy/strategyEngine.js')
    await runCycle()

    expect(findAll).toHaveBeenCalledOnce()
    expect(getLatest).toHaveBeenCalledWith(1, 100)
  })

  it('persiste decision cuando buyScoreStrategy retorna BUY y la incluye en decisions[]', async () => {
    const { findAll }   = await import('../../../src/persistence/assetRepository.js')
    const { getLatest } = await import('../../../src/persistence/priceTickRepository.js')
    const { insert }    = await import('../../../src/persistence/decisionRepository.js')

    findAll.mockResolvedValue([{ id: 1, symbol: 'GGAL', market: 'bCBA', type: 'accion', active: true }])
    getLatest.mockResolvedValue([{ price: '200', capturedAt: new Date() }])
    insert.mockResolvedValue({ id: 1, assetId: 1, signal: 'BUY', priceAtDecision: 200 })

    // sellStrategy retorna HOLD → buyStrategy corre y retorna BUY
    mockSellRun.mockResolvedValue('HOLD')
    mockBuyRun.mockResolvedValue('BUY')

    const { runCycle } = await import('../../../src/strategy/strategyEngine.js')
    const result = await runCycle()

    expect(insert).toHaveBeenCalledWith(1, 'BUY', 'buyScore', expect.anything(), null)
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
