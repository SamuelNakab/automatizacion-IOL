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

// ¿Hay filas de este activo que no vengan de Yahoo? (histórico viejo de IOL,
// sin ajustar por splits) → hay que reconstruirlo completo.
export async function needsYahooResync(assetId) {
  const row = await prisma.priceHistory.findFirst({
    where:  { assetId, NOT: { source: 'yahoo' } },
    select: { id: true },
  })
  return row !== null
}

// Reemplaza el histórico con datos de Yahoo (sobreescribe OHLCV) y deja
// close_usd en null para recalcularlo con recomputeMissingCloseUsd().
export async function replaceFromYahoo(assetId, bars) {
  let processed = 0
  for (let i = 0; i < bars.length; i += CHUNK_SIZE) {
    const chunk = bars.slice(i, i + CHUNK_SIZE)
    const ops = chunk.map(bar => {
      const date   = new Date(String(bar.date).substring(0, 10))
      const values = {
        open:     bar.open,
        high:     bar.high,
        low:      bar.low,
        close:    bar.close,
        volume:   bar.volume !== null && bar.volume !== undefined ? BigInt(Math.round(bar.volume)) : null,
        source:   'yahoo',
        closeUsd: null,
      }
      return prisma.priceHistory.upsert({
        where:  { assetId_date: { assetId, date } },
        create: { assetId, date, ...values },
        update: values,
      })
    })
    await prisma.$transaction(ops)
    processed += chunk.length
  }
  // Días que Yahoo no tiene: se borran para no mezclar precios sin ajustar
  await prisma.priceHistory.deleteMany({ where: { assetId, NOT: { source: 'yahoo' } } })
  return processed
}

// close_usd = close / último MEP con fecha <= día, para filas sin valor
export async function recomputeMissingCloseUsd() {
  return prisma.$executeRaw`
    UPDATE price_history ph
    SET close_usd = CAST(ph.close AS DOUBLE PRECISION) / (
      SELECT er.mep_rate FROM exchange_rates er
      WHERE DATE(er.date) <= ph.date
      ORDER BY er.date DESC LIMIT 1)
    WHERE ph.close_usd IS NULL
      AND EXISTS (SELECT 1 FROM exchange_rates er2 WHERE DATE(er2.date) <= ph.date)
  `
}
