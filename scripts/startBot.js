import 'dotenv/config'
import { getQuote }          from '../src/market-data/marketDataService.js'
import * as strategyEngine   from '../src/strategy/strategyEngine.js'
import RiskManager           from '../src/risk/riskManager.js'
import ExecutionEngine       from '../src/execution/executionEngine.js'
import { updateUnrealizedPnl, confirmOrderFilled } from '../src/orchestrator/positionUpdater.js'
import { pollPendingOrders, resolveOrphanOrders }  from '../src/orchestrator/orderPoller.js'
import Orchestrator          from '../src/orchestrator/orchestrator.js'
import * as emailAlert       from '../src/monitoring/emailAlert.js'
import * as whatsappAlert    from '../src/monitoring/whatsappAlert.js'
import { RISK_CONFIG }       from '../src/shared/riskConfig.js'
import logger                from '../src/shared/logger.js'

// SEGURIDAD: El bot no puede arrancar sin DRY_RUN=true
if (process.env.DRY_RUN !== 'true') {
  logger.error(
    'DRY_RUN debe ser true. ' +
    'Cambiarlo a false solo está permitido en Fase 8 con instrucción explícita.'
  )
  process.exit(1)
}

// Loguear configuración activa (sin credenciales)
logger.info('Configuración del bot', {
  baseUrl:        process.env.IOL_BASE_URL,
  dryRun:         process.env.DRY_RUN,
  pollIntervalMs: process.env.POLL_INTERVAL_MS,
  marketOpen:     process.env.MARKET_OPEN_HOUR  ?? '10',
  marketClose:    process.env.MARKET_CLOSE_HOUR ?? '17',
  riskConfig:     RISK_CONFIG,
})

// Instanciar dependencias
const marketDataService = { getQuote }
const riskManager       = new RiskManager()
const executionEngine   = new ExecutionEngine()
const positionUpdater   = { updateUnrealizedPnl, confirmOrderFilled }
const orderPoller       = { pollPendingOrders, resolveOrphanOrders }

const orchestrator = new Orchestrator({
  marketDataService,
  strategyEngine,
  riskManager,
  executionEngine,
  positionUpdater,
  orderPoller,
  emailAlert,
  whatsappAlert,
})

await orchestrator.start()
