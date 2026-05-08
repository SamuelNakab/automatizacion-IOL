import prisma from './prismaClient.js';

export async function upsert(assetId, data) {
  return prisma.position.upsert({
    where: { assetId },
    create: { assetId, ...data },
    update: data,
  });
}

export async function findByAsset(assetId) {
  return prisma.position.findUnique({ where: { assetId } });
}

export async function findAll() {
  return prisma.position.findMany();
}
