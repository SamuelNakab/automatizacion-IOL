import * as assetRepository        from '../persistence/assetRepository.js'
import * as priceHistoryRepository from '../persistence/priceHistoryRepository.js'
import { getHistoricalSeries }     from '../market-data/yahooMarketData.js'
import { fetchMepToday, fetchMepRange } from '../market-data/mepService.js'
import { upsertExchangeRate, getLastMepRate, deleteTestRates, getRateDatesSince } from '../persistence/exchangeRateRepository.js'
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

// Días hacia atrás en los que se verifica que haya MEP cargado
const MEP_CHECK_DAYS = 200

// Revisa el MEP de los últimos MEP_CHECK_DAYS días: borra filas de prueba,
// trae de Ámbito los días faltantes y devuelve desde qué fecha hay que
// recalcular close_usd (o null si no hubo cambios).
async function syncMepHistory(today) {
  const from = new Date(today)
  from.setDate(today.getDate() - MEP_CHECK_DAYS)
  const fromStr = dateToString(from)

  const removed = await deleteTestRates()
  if (removed > 0) logger.warn('Filas de MEP de prueba eliminadas', { filas: removed })

  const have = await getRateDatesSince(fromStr)
  let firstMissing = null
  for (const d = new Date(from); d < today; d.setDate(d.getDate() + 1)) {
    const day = d.getDay()
    if (day === 0 || day === 6) continue   // fines de semana: sin cotización
    if (!have.has(dateToString(d))) { firstMissing = new Date(d); break }
  }

  let recomputeFrom = removed > 0 ? fromStr : null
  if (firstMissing) {
    const rates = await fetchMepRange(firstMissing, today)
    let inserted = 0
    for (const [dateStr, rate] of rates) {
      if (have.has(dateStr)) continue
      await upsertExchangeRate(new Date(`${dateStr}T00:00:00Z`), rate, 'ambito')
      inserted++
    }
    logger.info('MEP histórico completado desde Ámbito', { desde: dateToString(firstMissing), dias: inserted })
    if (inserted > 0) {
      const f = dateToString(firstMissing)
      recomputeFrom = recomputeFrom && recomputeFrom < f ? recomputeFrom : f
    }
  }
  return recomputeFrom
}

export async function runDailyUpdate() {
  const today      = new Date()
  const sevenAgo   = new Date(today)
  sevenAgo.setDate(today.getDate() - 7)

  const todayStr   = dateToString(today)
  const fechaHasta = todayStr

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
      const series = await getHistoricalSeries(asset.symbol, asset.market, fechaDesde, fechaHasta)

      const bars = toBars(series)

      await priceHistoryRepository.bulkUpsert(asset.id, bars)

      logger.info('Daily update OK', { symbol: asset.symbol, barras: bars.length })
    } catch (error) {
      logger.error('Daily update falló para activo', { symbol: asset.symbol, error: error.message })
    }
  }

  logger.info('Daily update completado', { timestamp: new Date() })

  // --- MEP histórico: limpiar filas de prueba y completar días faltantes ---
  let recomputeFrom = null
  try {
    recomputeFrom = await syncMepHistory(today)
  } catch (err) {
    logger.error('Error sincronizando MEP histórico — no es bloqueante', { error: err.message })
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

  // --- close_usd faltante (filas nuevas, reconstruidas o con MEP corregido) ---
  try {
    // Barras recientes refrescadas desde Yahoo (ventana de getStartDate) + MEP corregido
    const tenAgo = new Date(today)
    tenAgo.setDate(today.getDate() - 10)
    const refreshFrom = dateToString(tenAgo)
    const from = recomputeFrom && recomputeFrom < refreshFrom ? recomputeFrom : refreshFrom
    const n = await priceHistoryRepository.recomputeCloseUsd(from)
    logger.info('close_usd recalculado', { filas: Number(n) })
  } catch (err) {
    logger.error('Error recalculando close_usd — no es bloqueante', { error: err.message })
  }
}
