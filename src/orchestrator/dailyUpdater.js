import * as assetRepository        from '../persistence/assetRepository.js'
import * as priceHistoryRepository from '../persistence/priceHistoryRepository.js'
import { getHistoricalSeries }     from '../market-data/marketDataService.js'
import logger                      from '../shared/logger.js'

function dateToString(d) {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function runDailyUpdate() {
  const today      = new Date()
  const sevenAgo   = new Date(today)
  sevenAgo.setDate(today.getDate() - 7)

  const fechaDesde = dateToString(sevenAgo)
  const fechaHasta = dateToString(today)

  const assets = await assetRepository.findAll()

  for (const asset of assets) {
    try {
      const series = await getHistoricalSeries(asset.symbol, asset.market, fechaDesde, fechaHasta)

      const bars = series
        .filter(bar => bar.timestamp !== null)
        .map(bar => ({
          date:   String(bar.timestamp).substring(0, 10),
          open:   bar.open  ?? bar.price,
          high:   bar.high  ?? bar.price,
          low:    bar.low   ?? bar.price,
          close:  bar.price,
          volume: bar.volume,
        }))
        .filter(bar => bar.close !== null)

      await priceHistoryRepository.bulkUpsert(asset.id, bars)

      logger.info('Daily update OK', { symbol: asset.symbol, barras: bars.length })
    } catch (error) {
      logger.error('Daily update falló para activo', { symbol: asset.symbol, error: error.message })
    }
  }

  logger.info('Daily update completado', { timestamp: new Date() })
}
