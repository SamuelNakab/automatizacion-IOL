import 'dotenv/config'
import * as emailAlert from '../src/monitoring/emailAlert.js'
import logger from '../src/shared/logger.js'

await emailAlert.sendAlert('BOT_START', {
  dryRun:       true,
  pollInterval: 30000,
  capital:      100000,
})

logger.info('Email de prueba enviado — revisá tu bandeja de entrada')
process.exit(0)
