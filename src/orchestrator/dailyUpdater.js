import * as assetRepository        from '../persistence/assetRepository.js'
import * as priceHistoryRepository from '../persistence/priceHistoryRepository.js'
import { getHistoricalSeries }     from '../market-data/yahooMarketData.js'
import { fetchMepToday, fetchMepRange } from '../market-data/mepService.js'
import { upsertExchangeRate, getLastMepRate } from '../persistence/exchangeRateRepository.js'
import logger                      from '../shared/logger.js'

function dateToString(d) {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Inicio del histórico completo (igual que el backfill original)
const HISTORY_START = '2020-01-01'

function toBars(series) {
  return series
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
}

// Máximo de días hacia atrás que se recuperan si el bot estuvo caído
const MAX_GAP_DAYS = 400

// Desde qué fecha pedir histórico: el último día guardado (si hay un hueco
// porque el bot estuvo apagado) o, como mínimo, los últimos 7 días.
async function getStartDate(assetId, today) {
  const sevenAgo = new Date(today)
  sevenAgo.setDate(today.getDate() - 7)
  try {
    const latest = await priceHistoryRepository.getLatest(assetId, 1)
    const last   = Array.isArray(latest) && latest[0]?.date ? new Date(latest[0].date) : null
    if (!last || last >= sevenAgo) return sevenAgo
    const limit = new Date(today)
    limit.setDate(today.getDate() - MAX_GAP_DAYS)
    return last < limit ? limit : last
  } catch {
    return sevenAgo
  }
}

// Completa exchange_rates y close_usd para cada día del hueco (forward-fill)
async function fillMepGap(fromDate, today) {
  const rates = await fetchMepRange(fromDate, today)
  let last = await getLastMepRate().catch(() => null)
  let filled = 0
  for (const d = new Date(fromDate); d < today; d.setDate(d.getDate() + 1)) {
    const key  = dateToString(d)
    const rate = rates.get(key) ?? last
    if (!rate) continue
    last = rate
    await upsertExchangeRate(new Date(d), rate, rates.has(key) ? 'ambito' : 'forward_fill')
    await priceHistoryRepository.updateCloseUsdForDate(key, rate)
    filled++
  }
  logger.info('Hueco de MEP completado', { desde: dateToString(fromDate), dias: filled })
}

export async function runDailyUpdate() {
  const today      = new Date()
  const sevenAgo   = new Date(today)
  sevenAgo.setDate(today.getDate() - 7)

  const todayStr   = dateToString(today)
  const fechaHasta = todayStr
  let earliestStart = sevenAgo

  const assets = await assetRepository.findAll()

  for (const asset of assets) {
    // Histórico viejo de IOL (sin ajustar por splits): reconstruir completo desde Yahoo
    try {
      if (await priceHistoryRepository.needsYahooResync(asset.id)) {
        const series = await getHistoricalSeries(asset.symbol, asset.market, HISTORY_START, todayStr)
        const bars   = toBars(series)
        if (bars.length > 200) {
          const n = await priceHistoryRepository.replaceFromYahoo(asset.id, bars)
          logger.info('Histórico reconstruido desde Yahoo', { symbol: asset.symbol, barras: n })
          continue
        }
        logger.warn('Yahoo devolvió pocas barras, no se reconstruye', { symbol: asset.symbol, barras: bars.length })
      }
    } catch (error) {
      logger.error('Reconstrucción de histórico falló', { symbol: asset.symbol, error: error.message })
    }

    try {
      const start      = await getStartDate(asset.id, today)
      const fechaDesde = dateToString(start)
      if (start < earliestStart) earliestStart = start
      const series = await getHistoricalSeries(asset.symbol, asset.market, fechaDesde, fechaHasta)

      const bars = toBars(series)

      await priceHistoryRepository.bulkUpsert(asset.id, bars)

      logger.info('Daily update OK', { symbol: asset.symbol, barras: bars.length })
    } catch (error) {
      logger.error('Daily update falló para activo', { symbol: asset.symbol, error: error.message })
    }
  }

  logger.info('Daily update completado', { timestamp: new Date() })

  // --- Hueco de MEP si el bot estuvo caído más de una semana ---
  if (earliestStart < sevenAgo) {
    try {
      await fillMepGap(earliestStart, today)
    } catch (err) {
      logger.error('Error completando hueco de MEP — no es bloqueante', { error: err.message })
    }
  }

  // --- MEP del día ---
  try {
    const mepValue = await fetchMepToday()
    let mepRate, source
    if (mepValue) {
      mepRate = mepValue
      source  = 'ambito'
    } else {
      const last = await getLastMepRate()
      if (!last) throw new Error('Sin MEP disponible')
      mepRate = last
      source  = 'forward_fill'
      logger.warn('MEP de Ambito no disponible, usando forward-fill')
    }
    await upsertExchangeRate(today, mepRate, source)
    const updated = await priceHistoryRepository.updateCloseUsdForDate(todayStr, mepRate)
    logger.info('MEP diario actualizado', { mepRate, source, rowsUpdated: updated })
  } catch (err) {
    logger.error('Error actualizando MEP diario — no es bloqueante', { error: err.message })
  }

  // --- close_usd faltante (filas nuevas o reconstruidas) ---
  try {
    const n = await priceHistoryRepository.recomputeMissingCloseUsd()
    logger.info('close_usd recalculado', { filas: Number(n) })
  } catch (err) {
    logger.error('Error recalculando close_usd — no es bloqueante', { error: err.message })
  }
}
