import 'dotenv/config';
import { ASSETS } from '../src/shared/assets.js';
import { getQuote } from '../src/market-data/marketDataService.js';
import logger from '../src/shared/logger.js';

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10);

let intervalId = null;

async function fetchAllQuotes() {
  for (const asset of ASSETS) {
    try {
      const quote = await getQuote(asset.symbol, asset.market);
      logger.info('Cotización obtenida', { quote });
    } catch (err) {
      // Error en un activo no interrumpe los demás
      logger.error('Error obteniendo cotización', {
        symbol: asset.symbol,
        market: asset.market,
        error: err.message,
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
