import { get } from './iolClient.js';
import logger from '../shared/logger.js';

function normalizeQuote(raw, symbol, market) {
  logger.debug('Raw quote response de IOL', { symbol, market, raw });

  return {
    symbol,
    market,
    price:     raw.ultimoPrecio    ?? raw.ultimo         ?? raw.precioUltimo  ?? null,
    open:      raw.apertura        ?? null,
    high:      raw.maximo          ?? null,
    low:       raw.minimo          ?? null,
    volume:    raw.volumenNominal  ?? raw.volumen         ?? raw.cantidadOperaciones ?? null,
    timestamp: raw.fechaHora       ?? raw.fecha           ?? new Date().toISOString(),
  };
}

function normalizeHistoricalPoint(point) {
  return {
    price:     point.ultimoPrecio  ?? point.ultimo  ?? point.precio ?? null,
    open:      point.apertura      ?? null,
    high:      point.maximo        ?? null,
    low:       point.minimo        ?? null,
    volume:    point.volumenNominal ?? point.volumen ?? null,
    timestamp: point.fechaHora     ?? point.fecha   ?? null,
  };
}

export async function getQuote(symbol, market) {
  const endpoint = `/api/v2/${market}/Titulos/${symbol}/Cotizacion`;
  const raw = await get(endpoint);
  return normalizeQuote(raw, symbol, market);
}

export async function getHistoricalSeries(symbol, market, fromDate, toDate) {
  const endpoint = `/api/v2/${market}/Titulos/${symbol}/Cotizacion/seriehistorica/${fromDate}/${toDate}/ajustada`;
  const raw = await get(endpoint);
  const series = Array.isArray(raw) ? raw : (raw.series ?? raw.datos ?? []);
  return series.map(normalizeHistoricalPoint);
}
