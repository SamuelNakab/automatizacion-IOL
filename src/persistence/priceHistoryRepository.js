import prisma from './prismaClient.js';

const CHUNK_SIZE = 100

export async function bulkUpsert(assetId, bars) {
  let processed = 0
  for (let i = 0; i < bars.length; i += CHUNK_SIZE) {
    const chunk = bars.slice(i, i + CHUNK_SIZE)
    const ops = chunk.map(bar => {
      const date = new Date(String(bar.date).substring(0, 10))
      return prisma.priceHistory.upsert({
        where:  { assetId_date: { assetId, date } },
        create: {
          assetId,
          date,
          open:   bar.open,
          high:   bar.high,
          low:    bar.low,
          close:  bar.close,
          volume: bar.volume !== null && bar.volume !== undefined ? BigInt(bar.volume) : null,
        },
        update: {}, // idempotente — nunca sobreescribir datos históricos
      })
    })
    await prisma.$transaction(ops)
    processed += chunk.length
  }
  return processed
}

export async function getRange(assetId, from, to) {
  return prisma.priceHistory.findMany({
    where: {
      assetId,
      date: { gte: new Date(from), lte: new Date(to) },
    },
    orderBy: { date: 'asc' },
  })
}

export async function getLatest(assetId, limit = 1) {
  return prisma.priceHistory.findMany({
    where:   { assetId },
    orderBy: { date: 'desc' },
    take:    limit,
  })
}

export async function count(assetId) {
  return prisma.priceHistory.count({ where: { assetId } })
}

export async function updateCloseUsdForDate(dateStr, mepRate) {
  const result = await prisma.$executeRaw`
    UPDATE price_history
    SET close_usd = CAST(close AS DOUBLE PRECISION) / ${mepRate}
    WHERE DATE(date) = ${dateStr}::date
  `
  return result
}
