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

export async function getSent() {
  return prisma.order.findMany({ where: { status: 'sent' } });
}

export async function getOrphans(timeoutMinutes) {
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);
  return prisma.order.findMany({
    where: {
      status: { in: ['pending', 'sent'] },
      createdAt: { lt: cutoff },
    },
  });
}
