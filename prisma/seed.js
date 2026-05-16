import 'dotenv/config';
import { ASSETS } from '../src/shared/assets.js';
import logger from '../src/shared/logger.js';
import prisma from '../src/persistence/prismaClient.js';

async function main() {
  for (const asset of ASSETS) {
    const result = await prisma.asset.upsert({
      where: { symbol_market: { symbol: asset.symbol, market: asset.market } },
      create: { symbol: asset.symbol, market: asset.market, type: asset.type },
      update: { type: asset.type, active: true },
    });
    logger.info('Asset upserted', { id: result.id, symbol: result.symbol, market: result.market });
  }

  const initialCapital = parseFloat(process.env.INITIAL_CAPITAL ?? '0');
  const existing = await prisma.botState.findUnique({ where: { id: 1 } });

  if (!existing) {
    const state = await prisma.botState.create({
      data: {
        id: 1,
        capitalTotal: initialCapital,
        capitalAvailable: initialCapital,
        peakCapital: initialCapital,
        realizedPnl: 0,
        unrealizedPnl: 0,
        maxDrawdown: 0,
        totalOperations: 0,
        winningOperations: 0,
      },
    });
    logger.info('BotState inicializado', { capitalTotal: state.capitalTotal.toString() });
  } else {
    logger.info('BotState ya existe, omitiendo', { id: existing.id });
  }
}

main()
  .catch(err => {
    logger.error('Error en seed', { error: err.message });
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
