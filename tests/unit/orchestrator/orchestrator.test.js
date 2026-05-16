import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn(() => ({ stop: vi.fn() })) },
}))
vi.mock('../../../src/orchestrator/dailyUpdater.js', () => ({
  runDailyUpdate: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../../src/shared/marketHours.js', () => ({
  isMarketOpen:       vi.fn(),
  formatMarketStatus: vi.fn(() => 'Mercado cerrado — próxima apertura: test'),
}))
vi.mock('../../../src/persistence/assetRepository.js')
vi.mock('../../../src/persistence/priceTickRepository.js')
vi.mock('../../../src/persistence/positionRepository.js')
vi.mock('../../../src/persistence/orderRepository.js')
vi.mock('../../../src/persistence/botStateRepository.js')
vi.mock('../../../src/persistence/prismaClient.js', () => ({
  default: { $disconnect: vi.fn() },
}))
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

function makeOrchestrator(deps = {}) {
  const defaults = {
    marketDataService: { getQuote: vi.fn() },
    strategyEngine:    { runCycle: vi.fn().mockResolvedValue({ BUY: 0, SELL: 0, HOLD: 0, decisions: [] }) },
    riskManager:       { validate: vi.fn() },
    executionEngine:   { execute: vi.fn() },
    positionUpdater:   { updateUnrealizedPnl: vi.fn(), confirmOrderFilled: vi.fn() },
    orderPoller:       { pollPendingOrders: vi.fn(), resolveOrphanOrders: vi.fn() },
  }
  return { ...defaults, ...deps }
}

describe('Orchestrator.runCycle()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('si isRunning=true: retorna sin ejecutar nada', async () => {
    const { isMarketOpen } = await import('../../../src/shared/marketHours.js')
    isMarketOpen.mockReturnValue(true)

    const { findAll } = await import('../../../src/persistence/assetRepository.js')

    const { default: Orchestrator } = await import('../../../src/orchestrator/orchestrator.js')
    const deps = makeOrchestrator()
    const orch = new Orchestrator(deps)

    orch.isRunning = true
    await orch.runCycle()

    expect(findAll).not.toHaveBeenCalled()
    expect(deps.strategyEngine.runCycle).not.toHaveBeenCalled()
  })

  it('si mercado cerrado: loguea estado y retorna sin ejecutar pipeline', async () => {
    const { isMarketOpen } = await import('../../../src/shared/marketHours.js')
    isMarketOpen.mockReturnValue(false)

    const { findAll } = await import('../../../src/persistence/assetRepository.js')

    const { default: Orchestrator } = await import('../../../src/orchestrator/orchestrator.js')
    const deps = makeOrchestrator()
    const orch = new Orchestrator(deps)

    await orch.runCycle()

    expect(deps.strategyEngine.runCycle).not.toHaveBeenCalled()
    expect(findAll).not.toHaveBeenCalled()
    // isRunning debe volver a false (finally)
    expect(orch.isRunning).toBe(false)
  })

  it('si strategyEngine.runCycle() lanza error: isRunning vuelve a false', async () => {
    const { isMarketOpen } = await import('../../../src/shared/marketHours.js')
    isMarketOpen.mockReturnValue(true)

    const { findAll } = await import('../../../src/persistence/assetRepository.js')
    findAll.mockResolvedValue([])

    const { update } = await import('../../../src/persistence/botStateRepository.js')
    update.mockResolvedValue({})

    const { default: Orchestrator } = await import('../../../src/orchestrator/orchestrator.js')
    const deps = makeOrchestrator({
      strategyEngine: { runCycle: vi.fn().mockRejectedValue(new Error('strategy crash')) },
    })
    const orch = new Orchestrator(deps)

    await orch.runCycle()

    expect(orch.isRunning).toBe(false)
  })
})
