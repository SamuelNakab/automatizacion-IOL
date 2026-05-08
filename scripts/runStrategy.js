import 'dotenv/config'
import { runCycle } from '../src/strategy/strategyEngine.js'
import prisma from '../src/persistence/prismaClient.js'
import logger from '../src/shared/logger.js'

const results = await runCycle()

logger.info('Resumen del ciclo de estrategia', {
  BUY:  results.BUY  ?? 0,
  SELL: results.SELL ?? 0,
  HOLD: results.HOLD ?? 0,
})

await prisma.$disconnect()
process.exit(0)
