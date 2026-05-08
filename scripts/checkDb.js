import 'dotenv/config';
import prisma from '../src/persistence/prismaClient.js';
import * as assetRepository        from '../src/persistence/assetRepository.js';
import * as priceHistoryRepository from '../src/persistence/priceHistoryRepository.js';
import * as priceTickRepository    from '../src/persistence/priceTickRepository.js';
import * as botStateRepository     from '../src/persistence/botStateRepository.js';
import logger from '../src/shared/logger.js';

const assets = await assetRepository.findAll();
logger.info('Activos en DB', { count: assets.length, assets: assets.map(a => `${a.symbol}/${a.market}`) });

const tickCount     = await prisma.priceTick.count();
const decisionCount = await prisma.decision.count();
logger.info('Total de ticks en DB',        { count: tickCount });
logger.info('Total de decisiones en DB',   { count: decisionCount });

const botState = await botStateRepository.get();
logger.info('BotState', {
  capitalTotal:      botState.capitalTotal.toString(),
  capitalAvailable:  botState.capitalAvailable.toString(),
  realizedPnl:       botState.realizedPnl.toString(),
  unrealizedPnl:     botState.unrealizedPnl.toString(),
  totalOperations:   botState.totalOperations,
  winningOperations: botState.winningOperations,
});

for (const asset of assets) {
  const histCount = await priceHistoryRepository.count(asset.id);
  const [latestTick] = await priceTickRepository.getLatest(asset.id, 1);
  const [latestBar]  = await priceHistoryRepository.getLatest(asset.id, 1);

  logger.info('Estado de datos por activo', {
    symbol:           asset.symbol,
    assetId:          asset.id,
    barsHistoricos:   histCount,
    ultimaTick:       latestTick ? { price: latestTick.price.toString(), at: latestTick.capturedAt } : null,
    ultimaBarHist:    latestBar  ? { close: latestBar.close.toString(),  date: latestBar.date }      : null,
  });
}

await prisma.$disconnect();
process.exit(0);
