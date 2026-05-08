import prisma from './prismaClient.js';

export async function insert(assetId, tickData) {
  const { price, open, high, low, volume } = tickData
  return prisma.priceTick.create({
    data: {
      assetId,
      price,
      open:   open   ?? null,
      high:   high   ?? null,
      low:    low    ?? null,
      volume: volume !== null && volume !== undefined ? BigInt(volume) : null,
    },
  })
}

export async function getLatest(assetId, limit = 1) {
  return prisma.priceTick.findMany({
    where:   { assetId },
    orderBy: { capturedAt: 'desc' },
    take:    limit,
  })
}
