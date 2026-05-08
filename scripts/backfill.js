import 'dotenv/config'
import * as assetRepository       from '../src/persistence/assetRepository.js'
import * as priceHistoryRepository from '../src/persistence/priceHistoryRepository.js'
import { getHistoricalSeries }    from '../src/market-data/marketDataService.js'
import prisma                     from '../src/persistence/prismaClient.js'
import logger                     from '../src/shared/logger.js'

function dateToString(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const today   = new Date()
const fiveYearsAgo = new Date(today)
fiveYearsAgo.setFullYear(today.getFullYear() - 5)

const fechaDesde = dateToString(fiveYearsAgo)
const fechaHasta = dateToString(today)

const assets = await assetRepository.findAll()
let totalBars = 0

for (const asset of assets) {
  try {
    logger.info('Iniciando backfill', { symbol: asset.symbol, desde: fechaDesde, hasta: fechaHasta })

    const series = await getHistoricalSeries(asset.symbol, asset.market, fechaDesde, fechaHasta)

    const bars = series
      .filter(bar => bar.timestamp !== null)
      .map(bar => ({
        date:   String(bar.timestamp).substring(0, 10), // YYYY-MM-DD from timestamp string
        open:   bar.open   ?? bar.price,
        high:   bar.high   ?? bar.price,
        low:    bar.low    ?? bar.price,
        close:  bar.price,
        volume: bar.volume,
      }))
      .filter(bar => bar.close !== null)

    const persisted = await priceHistoryRepository.bulkUpsert(asset.id, bars)
    totalBars += persisted

    logger.info('Backfill completado', {
      symbol:    asset.symbol,
      received:  series.length,
      persisted,
    })
  } catch (err) {
    logger.error('Error en backfill de activo', { symbol: asset.symbol, error: err.message })
  }
}

logger.info('Backfill total completado', { totalBars })

await prisma.$disconnect()
process.exit(0)
