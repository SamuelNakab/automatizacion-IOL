import 'dotenv/config'
import { runCycle }           from '../src/strategy/strategyEngine.js'
import * as botStateRepository from '../src/persistence/botStateRepository.js'
import * as positionRepository from '../src/persistence/positionRepository.js'
import * as orderRepository    from '../src/persistence/orderRepository.js'
import * as assetRepository    from '../src/persistence/assetRepository.js'
import RiskManager             from '../src/risk/riskManager.js'
import ExecutionEngine         from '../src/execution/executionEngine.js'
import prisma                  from '../src/persistence/prismaClient.js'
import logger                  from '../src/shared/logger.js'

// SEGURIDAD: el pipeline no puede correr sin DRY_RUN=true
if (process.env.DRY_RUN !== 'true') {
  logger.error('SEGURIDAD: DRY_RUN no está activado. Abortando pipeline.', { DRY_RUN: process.env.DRY_RUN })
  process.exit(1)
}

logger.info('=== CICLO PIPELINE [DRY_RUN] ===')

// 1. Estado del sistema
const botState  = await botStateRepository.get()
const positions = await positionRepository.findAll()

// 2. Mapa de última orden por activo
const lastOrderByAsset = new Map()
const assets = await assetRepository.findAll()
for (const asset of assets) {
  const orders = await orderRepository.getByAsset(asset.id)
  if (orders.length > 0) {
    const latest = orders.reduce((max, o) =>
      new Date(o.createdAt) > new Date(max.createdAt) ? o : max
    )
    lastOrderByAsset.set(asset.id, new Date(latest.createdAt))
  }
}

// 3. Ciclo de estrategia
const { BUY, SELL, HOLD, decisions } = await runCycle()
logger.info('Señales del ciclo', { BUY: BUY ?? 0, SELL: SELL ?? 0, HOLD: HOLD ?? 0 })

// 4. Validación y ejecución de cada decisión
const riskManager = new RiskManager()
const engine      = new ExecutionEngine()

let approved = 0
let executed = 0

for (const decision of decisions) {
  const riskResult = riskManager.validate(decision, botState, positions, lastOrderByAsset)

  logger.info('Validación de riesgo', {
    symbol:   decision.asset.symbol,
    signal:   decision.signal,
    approved: riskResult.approved,
    reason:   riskResult.reason,
  })

  if (riskResult.approved) {
    approved++
    if (decision.signal === 'SELL') {
      const execResult = await engine.execute({ ...decision, quantity: riskResult.quantity })
      executed++
      logger.info('Resultado de ejecución SELL', { symbol: decision.asset.symbol, execResult })
    } else if (decision.signal === 'BUY') {
      // BUY nunca llama a executionEngine — crea pending_manual
      await orderRepository.insert({
        decisionId: decision.id,
        assetId:    decision.assetId,
        side:       'BUY',
        quantity:   0,
        price:      decision.priceAtDecision,
        status:     'pending_manual',
      })
      executed++
      logger.info('BUY: orden pending_manual creada (requiere acción manual)', {
        symbol:     decision.asset.symbol,
        price:      decision.priceAtDecision,
        confidence: decision.strategyInstance?.lastSignalData?.confidence ?? 0,
      })
    }
  } else {
    logger.info('→ RECHAZADA por Risk Manager', {
      symbol: decision.asset.symbol,
      reason: riskResult.reason,
    })
  }
}

// 5. Resumen
logger.info('Resumen del pipeline', {
  totalDecisiones:  decisions.length,
  aprobadas:        approved,
  ejecutadasDryRun: executed,
})

await prisma.$disconnect()
process.exit(0)
