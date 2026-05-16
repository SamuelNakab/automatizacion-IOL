import axios  from 'axios'
import prisma  from '../persistence/prismaClient.js'
import logger  from '../shared/logger.js'

const FALLBACK_FROM_RATE    = 105
const FALLBACK_TO_RATE      = 1200
const FALLBACK_APPRECIATION = parseFloat(
  ((FALLBACK_TO_RATE - FALLBACK_FROM_RATE) / FALLBACK_FROM_RATE * 100).toFixed(2)
)

async function tryGD30Source(fromDate, toDate) {
  try {
    const asset = await prisma.asset.findUnique({
      where: { symbol_market: { symbol: 'GD30', market: 'bCBA' } },
    })
    if (!asset) return null

    const bars = await prisma.priceHistory.findMany({
      where: { assetId: asset.id, date: { gte: fromDate, lte: toDate } },
      orderBy: { date: 'asc' },
    })
    // Necesitamos precio en pesos Y en dólares para calcular MEP.
    // price_history solo almacena precio en pesos — fuente estructuralmente incompleta.
    if (bars.length < 2) return null
    return null
  } catch {
    return null
  }
}

async function tryBCRASource(fromDate, toDate) {
  try {
    const desde = fromDate.toISOString().substring(0, 10)
    const hasta  = toDate.toISOString().substring(0, 10)
    const url    = `https://api.bcra.gob.ar/estadisticas/v3.0/monetarias/1/${desde}/${hasta}`

    const { data } = await axios.get(url, { timeout: 8000 })

    const series = Array.isArray(data?.results)
      ? data.results
      : (data?.results?.series ?? [])

    if (!series || series.length < 2) return null

    const sorted   = [...series].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    const fromRate = Number(sorted[0].valor)
    const toRate   = Number(sorted[sorted.length - 1].valor)

    if (isNaN(fromRate) || isNaN(toRate) || fromRate <= 0 || toRate <= 0) return null

    const appreciation = parseFloat(((toRate - fromRate) / fromRate * 100).toFixed(2))
    return {
      appreciation,
      source:   'bcra_oficial',
      fromRate,
      toRate,
      fromDate: new Date(sorted[0].fecha),
      toDate:   new Date(sorted[sorted.length - 1].fecha),
    }
  } catch {
    return null
  }
}

export async function getDollarAppreciation(fromDate, toDate) {
  const gd30Result = await tryGD30Source(fromDate, toDate)
  if (gd30Result) return gd30Result

  const bcraResult = await tryBCRASource(fromDate, toDate)
  if (bcraResult) return bcraResult

  logger.warn('Usando benchmark de dólar hardcodeado (fallback)')
  return {
    appreciation: FALLBACK_APPRECIATION,
    source:       'fallback',
    fromRate:     FALLBACK_FROM_RATE,
    toRate:       FALLBACK_TO_RATE,
    fromDate,
    toDate,
  }
}
