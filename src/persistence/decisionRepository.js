import prisma from './prismaClient.js';

export async function insert(assetId, signal, strategy, priceAtDecision, metadata = null) {
  return prisma.decision.create({
    data: { assetId, signal, strategy, priceAtDecision, metadata },
  });
}

export async function getRecent(assetId, limit = 10) {
  return prisma.decision.findMany({
    where: { assetId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
