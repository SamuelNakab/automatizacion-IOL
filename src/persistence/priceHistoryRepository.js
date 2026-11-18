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
          source: 'yahoo',
        },
        // Yahoo es la fuente de verdad: se refrescan las barras recientes (corrige
        // barras parciales). close_usd se recalcula al final del daily update
        // (sin ponerlo en NULL, para que los modelos nunca lean huecos).
        update: {
          open:     bar.open,
          high:     bar.high,
          low:      bar.low,
          close:    bar.close,
          volume:   bar.volume !== null && bar.volume !== undefined ? BigInt(bar.volume) : null,
          source:   'yahoo',
        },
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
// Una sola sentencia SQL por activo: guardar ~1700 días fila por fila contra
// Neon tarda minutos por la latencia de red.
export async function replaceFromYahoo(assetId, bars) {
  const dates  = bars.map(b => String(b.date).substring(0, 10))
  const opens  = bars.map(b => Number(b.open))
  const highs  = bars.map(b => Number(b.high))
  const lows   = bars.map(b => Number(b.low))
  const closes = bars.map(b => Number(b.close))
  const vols   = bars.map(b => (b.volume === null || b.volume === undefined ? null : Math.round(Number(b.volume))))

  const upserted = await prisma.$executeRaw`
    INSERT INTO price_history (asset_id, date, open, high, low, close, volume, source, close_usd)
    SELECT ${assetId}, t.d::date, t.o, t.h, t.l, t.c, t.v::bigint, 'yahoo', NULL
    FROM unnest(${dates}::text[], ${opens}::float8[], ${highs}::float8[], ${lows}::float8[],
                ${closes}::float8[], ${vols}::float8[]) AS t(d, o, h, l, c, v)
    ON CONFLICT (asset_id, date) DO UPDATE
      SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
          close = EXCLUDED.close, volume = EXCLUDED.volume,
          source = 'yahoo', close_usd = NULL
  `
  // Días que Yahoo no tiene: se borran para no mezclar precios sin ajustar
  await prisma.$executeRaw`
    DELETE FROM price_history WHERE asset_id = ${assetId} AND source <> 'yahoo'
  `
  return Number(upserted)
}

// close_usd = close / último MEP con fecha <= día, para filas sin valor
// Recalcula close_usd en un solo UPDATE: filas sin close_usd y, si se pasa
// fromDateStr, todas las filas desde esa fecha (MEP o cierre corregidos).
// No hay ventana con NULLs visibles para otros lectores.
export async function recomputeCloseUsd(fromDateStr = null) {
  return prisma.$executeRaw`
    UPDATE price_history ph
    SET close_usd = CAST(ph.close AS DOUBLE PRECISION) / (
      SELECT er.mep_rate FROM exchange_rates er
      WHERE DATE(er.date) <= ph.date
      ORDER BY er.date DESC LIMIT 1)
    WHERE (ph.close_usd IS NULL OR ph.date >= ${fromDateStr ?? '9999-12-31'}::date)
      AND EXISTS (SELECT 1 FROM exchange_rates er2 WHERE DATE(er2.date) <= ph.date)
  `
}

export async function recomputeMissingCloseUsd() {
  return recomputeCloseUsd(null)
}
