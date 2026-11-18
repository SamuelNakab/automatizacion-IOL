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

// Borra filas de prueba (source='test') que contaminan el forward-fill
export async function deleteTestRates() {
  return Number(await prisma.$executeRaw`DELETE FROM exchange_rates WHERE source = 'test'`)
}

// Fechas (YYYY-MM-DD) que ya tienen MEP desde una fecha dada
export async function getRateDatesSince(dateStr) {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT TO_CHAR(DATE(date), 'YYYY-MM-DD') AS d
    FROM exchange_rates WHERE DATE(date) >= ${dateStr}::date`
  return new Set(rows.map(r => r.d))
}
