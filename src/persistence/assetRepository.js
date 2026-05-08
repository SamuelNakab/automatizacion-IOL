import prisma from './prismaClient.js';

export async function findAll() {
  return prisma.asset.findMany({ where: { active: true } });
}

export async function findBySymbolAndMarket(symbol, market) {
  return prisma.asset.findUnique({
    where: { symbol_market: { symbol, market } },
  });
}

export async function upsert(symbol, market, type) {
  return prisma.asset.upsert({
    where: { symbol_market: { symbol, market } },
    create: { symbol, market, type },
    update: { type },
  });
}
