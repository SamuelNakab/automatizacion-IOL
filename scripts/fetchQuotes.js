import 'dotenv/config';
import { ASSETS } from '../src/shared/assets.js';
import { getQuote } from '../src/market-data/marketDataService.js';
import * as assetRepository    from '../src/persistence/assetRepository.js';
import * as priceTickRepository from '../src/persistence/priceTickRepository.js';
import logger from '../src/shared/logger.js';

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10);

let intervalId = null;

async function fetchAllQuotes() {
  for (const asset of ASSETS) {
    try {
      const quote = await getQuote(asset.symbol, asset.market);

      const assetRecord = await assetRepository.findBySymbolAndMarket(asset.symbol, asset.market);
      if (!assetRecord) {
        logger.warn('Activo no encontrado en DB, omitiendo persistencia', {
          symbol: asset.symbol,
          market: asset.market,
        });
        continue;
      }

      await priceTickRepository.insert(assetRecord.id, quote);
      logger.info('Cotización persistida', {
        symbol:      quote.symbol,
        assetId:     assetRecord.id,
        price:       quote.price,
        persistedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Error en un activo no interrumpe los demás
      logger.error('Error en ciclo de cotización', {
        symbol: asset.symbol,
        market: asset.market,
        error:  err.message,
      });
    }
  }
}

process.on('SIGINT', () => {
  logger.info('Bot detenido');
  if (intervalId) clearInterval(intervalId);
  process.exit(0);
});

logger.info('Iniciando bot de cotizaciones', { pollIntervalMs: POLL_INTERVAL_MS, assets: ASSETS });
await fetchAllQuotes();
intervalId = setInterval(fetchAllQuotes, POLL_INTERVAL_MS);
