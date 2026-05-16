import 'dotenv/config'
import { runDailyUpdate } from '../src/orchestrator/dailyUpdater.js'
import prisma             from '../src/persistence/prismaClient.js'
import logger             from '../src/shared/logger.js'

logger.info('Corriendo daily update manual...')
await runDailyUpdate()
await prisma.$disconnect()
process.exit(0)
