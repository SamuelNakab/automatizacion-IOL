import 'dotenv/config'
import { runCycle }           from '../src/strategy/strategyEngine.js'
import * as botStateRepository from '../src/persistence/botStateRepository.js'
import * as positionRepository from '../src/persistence/positionRepository.js'
import * as orderRepository    from '../src/persistence/orderRepository.js'
import * as assetRepository    from '../src/persistence/assetRepository.js'
import RiskManager             from '../src/risk/riskManager.js'
import prisma                  from '../src/persistence/prismaClient.js'
import logger                  from '../src/shared/logger.js'

// 1. Obtener estado del sistema
const botState  = await botStateRepository.get()
const positions = await positionRepository.findAll()

// 2. Construir mapa de última orden por activo
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

// 3. Ejecutar ciclo de estrategia
const { BUY, SELL, HOLD, decisions } = await runCycle()

// 4. Validar cada decisión BUY / SELL con el Risk Manager
const riskManager = new RiskManager()
let approved = 0
let rejected = 0

for (const decision of decisions) {
  const result = riskManager.validate(decision, botState, positions, lastOrderByAsset)
  logger.info('Validación de riesgo', {
    symbol:   decision.asset.symbol,
    signal:   decision.signal,
    approved: result.approved,
    reason:   result.reason,
  })
  if (result.approved) {
    logger.info('→ APROBADA — lista para ejecución (Fase 5)', { symbol: decision.asset.symbol })
    approved++
  } else {
    logger.info(`→ RECHAZADA: ${result.reason}`, { symbol: decision.asset.symbol })
    rejected++
  }
}

logger.info('Resumen del ciclo con Risk Manager', {
  senalesEstrategia: { BUY: BUY ?? 0, SELL: SELL ?? 0, HOLD: HOLD ?? 0 },
  riskAprobadas:     approved,
  riskRechazadas:    rejected,
})

await prisma.$disconnect()
process.exit(0)
