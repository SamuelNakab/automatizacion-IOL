import axios from 'axios'
import logger from '../shared/logger.js'

// Fuente de precios: Yahoo Finance (gratis, sin cuenta ni API key).
// Reemplaza a la API de IOL. Las acciones de BYMA cotizan con sufijo .BA
// (GGAL → GGAL.BA). Los precios vienen ajustados por splits.
// Las cotizaciones intradiarias tienen ~20 minutos de demora.

const BASE_URL     = 'https://query1.finance.yahoo.com/v8/finance/chart'
const HEADERS      = { 'User-Agent': 'Mozilla/5.0 (compatible; bot-analisis-iol/1.0)' }
const MAX_ATTEMPTS = 3
const RETRY_DELAYS_MS = [1000, 2000, 4000]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function toYahooSymbol(symbol) {
  return `${symbol}.BA`
}

async function fetchChart(symbol, params) {
  let lastError
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const url = `${BASE_URL}/${encodeURIComponent(toYahooSymbol(symbol))}`
      const { data } = await axios.get(url, { params, headers: HEADERS, timeout: 15000 })
      const result = data?.chart?.result?.[0]
      if (!result) throw new Error(data?.chart?.error?.description ?? 'Respuesta vacía de Yahoo')
      return result
    } catch (err) {
      lastError = err
      logger.error('Error en request a Yahoo Finance', {
        symbol, attempt, maxAttempts: MAX_ATTEMPTS,
        status: err.response?.status ?? 'network_error', message: err.message,
      })
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAYS_MS[attempt - 1])
    }
  }
  throw lastError
}

// Fecha local de la bolsa (YYYY-MM-DD) de un timestamp unix de Yahoo
function exchangeDate(ts, gmtoffset = -10800) {
  return new Date((ts + gmtoffset) * 1000).toISOString().slice(0, 10)
}

function toUnix(dateStr, endOfDay = false) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (endOfDay) d.setUTCDate(d.getUTCDate() + 1)
  return Math.floor(d.getTime() / 1000)
}

// Misma forma que devolvía la versión de IOL
export async function getQuote(symbol, market) {
  const result = await fetchChart(symbol, { range: '5d', interval: '1d' })
  const meta   = result.meta ?? {}
  const q      = result.indicators?.quote?.[0] ?? {}
  const opens  = q.open ?? []
  const lastOpen = [...opens].reverse().find(v => v !== null && v !== undefined) ?? null

  return {
    symbol,
    market,
    price:     meta.regularMarketPrice   ?? null,
    open:      lastOpen,
    high:      meta.regularMarketDayHigh ?? null,
    low:       meta.regularMarketDayLow  ?? null,
    volume:    meta.regularMarketVolume  ?? null,
    timestamp: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
  }
}

// fromDate / toDate en formato YYYY-MM-DD (inclusive)
export async function getHistoricalSeries(symbol, market, fromDate, toDate) {
  const result = await fetchChart(symbol, {
    period1:  toUnix(fromDate),
    period2:  toUnix(toDate, true),
    interval: '1d',
  })
  const ts  = result.timestamp ?? []
  const q   = result.indicators?.quote?.[0] ?? {}
  const off = result.meta?.gmtoffset ?? -10800

  return ts
    .map((t, i) => ({
      price:     q.close?.[i]  ?? null,
      open:      q.open?.[i]   ?? null,
      high:      q.high?.[i]   ?? null,
      low:       q.low?.[i]    ?? null,
      volume:    q.volume?.[i] ?? null,
      timestamp: exchangeDate(t, off),
    }))
    .filter(p => p.price !== null)
}
