import prisma from './prismaClient.js'

export async function upsertExchangeRate(date, mepRate, source) {
  return prisma.exchangeRate.upsert({
    where:  { date },
    create: { date, mepRate, source, createdAt: new Date() },
    update: { mepRate, source },
  })
}

export async function getLastMepRate() {
  const row = await prisma.exchangeRate.findFirst({ orderBy: { date: 'desc' } })
  return row ? row.mepRate : null
}
