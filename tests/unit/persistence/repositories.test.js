import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/persistence/prismaClient.js', () => ({
  default: {
    asset:     { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    priceTick: { create: vi.fn(), findMany: vi.fn() },
    decision:  { create: vi.fn(), findMany: vi.fn() },
    order:     { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    position:  { upsert: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    botState:  { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

describe('repositories', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('priceTickRepository.insert', () => {
    it('llama a prisma.priceTick.create con assetId y los campos correctos', async () => {
      const { default: prisma } = await import('../../../src/persistence/prismaClient.js');
      prisma.priceTick.create.mockResolvedValue({ id: 1 });

      const { insert } = await import('../../../src/persistence/priceTickRepository.js');
      await insert(42, {
        price: 1234.56,
        open: 1200,
        high: 1250,
        low: 1190,
        volume: 500000,
      });

      expect(prisma.priceTick.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          assetId: 42,
          price: 1234.56,
          volume: BigInt(500000),
        }),
      });
    });

    it('convierte volume null a null sin lanzar error', async () => {
      const { default: prisma } = await import('../../../src/persistence/prismaClient.js');
      prisma.priceTick.create.mockResolvedValue({ id: 2 });

      const { insert } = await import('../../../src/persistence/priceTickRepository.js');
      await insert(1, { price: 100, open: null, high: null, low: null, volume: null });

      const call = prisma.priceTick.create.mock.calls[0][0];
      expect(call.data.volume).toBeNull();
    });
  });

  describe('botStateRepository.get', () => {
    it('lanza Error si prisma devuelve null', async () => {
      const { default: prisma } = await import('../../../src/persistence/prismaClient.js');
      prisma.botState.findUnique.mockResolvedValue(null);

      const { get } = await import('../../../src/persistence/botStateRepository.js');
      await expect(get()).rejects.toThrow('BotState no inicializado');
    });

    it('devuelve el estado si existe', async () => {
      const { default: prisma } = await import('../../../src/persistence/prismaClient.js');
      const fakeState = { id: 1, capitalTotal: 10000, capitalAvailable: 10000 };
      prisma.botState.findUnique.mockResolvedValue(fakeState);

      const { get } = await import('../../../src/persistence/botStateRepository.js');
      const result = await get();
      expect(result).toEqual(fakeState);
      expect(prisma.botState.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('positionRepository.upsert', () => {
    it('llama a prisma.position.upsert con where: { assetId }', async () => {
      const { default: prisma } = await import('../../../src/persistence/prismaClient.js');
      prisma.position.upsert.mockResolvedValue({ id: 1, assetId: 5 });

      const { upsert } = await import('../../../src/persistence/positionRepository.js');
      const data = {
        quantity: 100,
        avgCost: 1200,
        currentPrice: 1234.56,
        unrealizedPnl: 3456,
        openedAt: new Date('2024-01-15'),
      };
      await upsert(5, data);

      expect(prisma.position.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { assetId: 5 } })
      );
    });
  });

  describe('assetRepository.findBySymbolAndMarket', () => {
    it('llama a findUnique con el compound unique correcto', async () => {
      const { default: prisma } = await import('../../../src/persistence/prismaClient.js');
      prisma.asset.findUnique.mockResolvedValue({ id: 1, symbol: 'GGAL', market: 'bCBA' });

      const { findBySymbolAndMarket } = await import('../../../src/persistence/assetRepository.js');
      const result = await findBySymbolAndMarket('GGAL', 'bCBA');

      expect(result).toEqual({ id: 1, symbol: 'GGAL', market: 'bCBA' });
      expect(prisma.asset.findUnique).toHaveBeenCalledWith({
        where: { symbol_market: { symbol: 'GGAL', market: 'bCBA' } },
      });
    });
  });
});
