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

// Borra la fila de prueba (source='test', 1234.56) y las copias que el
// forward-fill hizo de ese valor en junio 2026 cuando Ámbito no respondía.
export async function deleteTestRates() {
  return Number(await prisma.$executeRaw`
    DELETE FROM exchange_rates WHERE source = 'test' OR mep_rate = 1234.56`)
}

// Fechas (YYYY-MM-DD) que ya tienen MEP desde una fecha dada
export async function getRateDatesSince(dateStr) {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT TO_CHAR(DATE(date), 'YYYY-MM-DD') AS d
    FROM exchange_rates WHERE DATE(date) >= ${dateStr}::date`
  return new Set(rows.map(r => r.d))
}
