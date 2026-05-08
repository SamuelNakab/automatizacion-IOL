import prisma from './prismaClient.js';

export async function insert(data) {
  return prisma.order.create({ data });
}

export async function updateStatus(id, status, iolResponse = null) {
  return prisma.order.update({
    where: { id },
    data: { status, iolResponse },
  });
}

export async function getPending() {
  return prisma.order.findMany({ where: { status: 'pending' } });
}

export async function getByAsset(assetId) {
  return prisma.order.findMany({ where: { assetId } });
}
