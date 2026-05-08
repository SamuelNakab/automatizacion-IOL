import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/persistence/prismaClient.js', () => {
  const db = {
    $transaction:  vi.fn(),
    order:    { update: vi.fn() },
    position: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn() },
    botState: { findUnique: vi.fn(), update: vi.fn() },
  }
  db.$transaction.mockImplementation(fn => fn(db))
  return { default: db }
})
vi.mock('../../../src/persistence/positionRepository.js')
vi.mock('../../../src/persistence/botStateRepository.js')
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const BASE_BOT_STATE = {
  capitalAvailable: 10000, capitalTotal: 10000, peakCapital: 10000,
  realizedPnl: 0, unrealizedPnl: 0, maxDrawdown: 0, totalOperations: 0,
}

function makeOrder(overrides = {}) {
  return { id: 1, assetId: 1, side: 'buy', quantity: 10, price: 100, iolOrderId: null, ...overrides }
}

describe('positionUpdater.confirmOrderFilled()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('BUY sin posición previa: crea posición con avgCost=filledPrice', async () => {
    const { default: prisma } = await import('../../../src/persistence/prismaClient.js')
    prisma.position.findUnique.mockResolvedValue(null)
    prisma.position.findMany.mockResolvedValue([])
    prisma.botState.findUnique.mockResolvedValue({ ...BASE_BOT_STATE, id: 1 })
    prisma.order.update.mockResolvedValue({})
    prisma.botState.update.mockResolvedValue({})

    const { confirmOrderFilled } = await import('../../../src/orchestrator/positionUpdater.js')
    await confirmOrderFilled(makeOrder({ side: 'buy' }), 10, 150)

    expect(prisma.position.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ avgCost: 150, quantity: 10 }) })
    )
  })

  it('BUY con posición previa: recalcula avgCost correctamente', async () => {
    const { default: prisma } = await import('../../../src/persistence/prismaClient.js')
    // Posición previa: 10 unidades a 100 → avgCost = (10×100 + 10×150) / 20 = 125
    prisma.position.findUnique.mockResolvedValue({ assetId: 1, quantity: 10, avgCost: 100 })
    prisma.position.findMany.mockResolvedValue([])
    prisma.botState.findUnique.mockResolvedValue({ ...BASE_BOT_STATE, id: 1 })
    prisma.order.update.mockResolvedValue({})
    prisma.position.update.mockResolvedValue({})
    prisma.botState.update.mockResolvedValue({})

    const { confirmOrderFilled } = await import('../../../src/orchestrator/positionUpdater.js')
    await confirmOrderFilled(makeOrder({ side: 'buy' }), 10, 150)

    expect(prisma.position.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ avgCost: 125, quantity: 20 }) })
    )
  })

  it('SELL reduce quantity de la posición', async () => {
    const { default: prisma } = await import('../../../src/persistence/prismaClient.js')
    prisma.position.findUnique.mockResolvedValue({ assetId: 1, quantity: 20, avgCost: 100 })
    prisma.position.findMany.mockResolvedValue([])
    prisma.botState.findUnique.mockResolvedValue({ ...BASE_BOT_STATE, id: 1 })
    prisma.order.update.mockResolvedValue({})
    prisma.position.update.mockResolvedValue({})
    prisma.botState.update.mockResolvedValue({})

    const { confirmOrderFilled } = await import('../../../src/orchestrator/positionUpdater.js')
    await confirmOrderFilled(makeOrder({ side: 'sell' }), 5, 120)

    expect(prisma.position.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 15 }) })
    )
  })

  it('SELL que lleva quantity a 0: elimina la posición', async () => {
    const { default: prisma } = await import('../../../src/persistence/prismaClient.js')
    prisma.position.findUnique.mockResolvedValue({ assetId: 1, quantity: 10, avgCost: 100 })
    prisma.position.findMany.mockResolvedValue([])
    prisma.botState.findUnique.mockResolvedValue({ ...BASE_BOT_STATE, id: 1 })
    prisma.order.update.mockResolvedValue({})
    prisma.botState.update.mockResolvedValue({})

    const { confirmOrderFilled } = await import('../../../src/orchestrator/positionUpdater.js')
    await confirmOrderFilled(makeOrder({ side: 'sell' }), 10, 120)

    expect(prisma.position.delete).toHaveBeenCalledWith({ where: { assetId: 1 } })
  })

  it('si la transacción falla: lanza el error sin silenciarlo', async () => {
    const { default: prisma } = await import('../../../src/persistence/prismaClient.js')
    prisma.$transaction.mockRejectedValue(new Error('DB connection lost'))

    const { confirmOrderFilled } = await import('../../../src/orchestrator/positionUpdater.js')
    await expect(confirmOrderFilled(makeOrder(), 10, 100)).rejects.toThrow('DB connection lost')
  })
})
