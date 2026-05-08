import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/execution/iolOrderClient.js', () => ({
  sendBuyOrder:   vi.fn(),
  sendSellOrder:  vi.fn(),
  cancelOrder:    vi.fn(),
  getOrderStatus: vi.fn(),
}))
vi.mock('../../../src/persistence/orderRepository.js', () => ({
  insert:       vi.fn(),
  updateStatus: vi.fn(),
  getPending:   vi.fn(),
  getByAsset:   vi.fn(),
}))
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const DECISION = {
  id:              1,
  assetId:         1,
  signal:          'BUY',
  priceAtDecision: 1000,
  quantity:        5,
  asset: { symbol: 'GGAL', market: 'bCBA' },
}

describe('ExecutionEngine con DRY_RUN=true', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.DRY_RUN = 'true'
  })

  afterEach(() => {
    delete process.env.DRY_RUN
  })

  it('NO llama a iolOrderClient.sendBuyOrder ni sendSellOrder', async () => {
    const orderRepo = await import('../../../src/persistence/orderRepository.js')
    orderRepo.insert.mockResolvedValue({ id: 99 })

    const { default: ExecutionEngine } = await import('../../../src/execution/executionEngine.js')
    await new ExecutionEngine().execute(DECISION)

    const iolClient = await import('../../../src/execution/iolOrderClient.js')
    expect(iolClient.sendBuyOrder).not.toHaveBeenCalled()
    expect(iolClient.sendSellOrder).not.toHaveBeenCalled()
  })

  it('llama a orderRepository.insert con status "dry_run"', async () => {
    const orderRepo = await import('../../../src/persistence/orderRepository.js')
    orderRepo.insert.mockResolvedValue({ id: 99 })

    const { default: ExecutionEngine } = await import('../../../src/execution/executionEngine.js')
    await new ExecutionEngine().execute(DECISION)

    expect(orderRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'dry_run', assetId: 1, side: 'buy' })
    )
  })

  it('retorna { success: true, status: "dry_run" }', async () => {
    const orderRepo = await import('../../../src/persistence/orderRepository.js')
    orderRepo.insert.mockResolvedValue({ id: 42 })

    const { default: ExecutionEngine } = await import('../../../src/execution/executionEngine.js')
    const result = await new ExecutionEngine().execute(DECISION)

    expect(result).toEqual({ success: true, orderId: 42, status: 'dry_run', reason: 'DRY_RUN activo' })
  })
})

describe('ExecutionEngine con DRY_RUN=false', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.DRY_RUN = 'false'
  })

  afterEach(() => {
    delete process.env.DRY_RUN
  })

  it('retorna { success: false } cuando iolOrderClient lanza error', async () => {
    const orderRepo = await import('../../../src/persistence/orderRepository.js')
    orderRepo.insert.mockResolvedValue({ id: 10 })
    orderRepo.updateStatus.mockResolvedValue({})

    const iolClient = await import('../../../src/execution/iolOrderClient.js')
    iolClient.sendBuyOrder.mockRejectedValue(new Error('IOL timeout'))

    const { default: ExecutionEngine } = await import('../../../src/execution/executionEngine.js')
    const result = await new ExecutionEngine().execute(DECISION)

    expect(result.success).toBe(false)
    expect(result.status).toBe('rejected')
    expect(result.reason).toContain('IOL timeout')
  })

  it('actualiza la orden a "rejected" en DB cuando IOL falla', async () => {
    const orderRepo = await import('../../../src/persistence/orderRepository.js')
    orderRepo.insert.mockResolvedValue({ id: 10 })
    orderRepo.updateStatus.mockResolvedValue({})

    const iolClient = await import('../../../src/execution/iolOrderClient.js')
    iolClient.sendBuyOrder.mockRejectedValue(new Error('error'))

    const { default: ExecutionEngine } = await import('../../../src/execution/executionEngine.js')
    await new ExecutionEngine().execute(DECISION)

    expect(orderRepo.updateStatus).toHaveBeenCalledWith(10, 'rejected', expect.any(Object))
  })
})
