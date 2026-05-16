import cron                     from 'node-cron'
import { isMarketOpen, formatMarketStatus } from '../shared/marketHours.js'
import { runDailyUpdate }       from './dailyUpdater.js'
import * as assetRepository    from '../persistence/assetRepository.js'
import * as priceTickRepository from '../persistence/priceTickRepository.js'
import * as positionRepository  from '../persistence/positionRepository.js'
import * as orderRepository     from '../persistence/orderRepository.js'
import * as botStateRepository  from '../persistence/botStateRepository.js'
import prisma                   from '../persistence/prismaClient.js'
import logger                   from '../shared/logger.js'

const POLL_INTERVAL_MS       = () => parseInt(process.env.POLL_INTERVAL_MS       ?? '30000')
const ORDER_POLL_INTERVAL_MS = () => parseInt(process.env.ORDER_POLL_INTERVAL_MS ?? '60000')

// No-op por defecto — si no se inyecta emailAlert los test existentes no se rompen
const noOpAlert = { sendAlert: async () => {} }

export default class Orchestrator {
  constructor({ marketDataService, strategyEngine, riskManager, executionEngine, positionUpdater, orderPoller, emailAlert = noOpAlert }) {
    this.marketDataService = marketDataService
    this.strategyEngine    = strategyEngine
    this.riskManager       = riskManager
    this.executionEngine   = executionEngine
    this.positionUpdater   = positionUpdater
    this.orderPoller       = orderPoller
    this.emailAlert        = emailAlert

    this.isRunning      = false
    this.cycleInterval  = null
    this.pollerInterval = null
    this.dailyCronJob   = null
  }

  async start() {
    logger.info('Bot iniciando...')

    try {
      const state = await botStateRepository.get()
      await this.emailAlert.sendAlert('BOT_START', {
        dryRun:       process.env.DRY_RUN === 'true',
        pollInterval: Number(process.env.POLL_INTERVAL_MS ?? 30000),
        capital:      state.capitalTotal,
      })
    } catch (err) {
      logger.error('Error enviando alerta BOT_START', { error: err.message })
    }

    await this.orderPoller.resolveOrphanOrders()
    await this.runCycle()

    this.cycleInterval  = setInterval(() => this.runCycle(),              POLL_INTERVAL_MS())
    this.pollerInterval = setInterval(() => this.orderPoller.pollPendingOrders(), ORDER_POLL_INTERVAL_MS())

    // Cron job diario a las 18:00 ARG (21:00 UTC, Argentina es UTC-3)
    this.dailyCronJob = cron.schedule('0 21 * * 1-5', async () => {
      logger.info('Iniciando daily update de price_history')
      await runDailyUpdate()
    }, {
      timezone: 'America/Argentina/Buenos_Aires',
    })
    logger.info('Daily update programado para las 18:00 ARG días hábiles')

    process.on('SIGINT',  () => this.stop('SIGINT'))
    process.on('SIGTERM', () => this.stop('SIGTERM'))

    logger.info('Bot corriendo. Ctrl+C para detener.')
  }

  async stop(reason = 'manual') {
    logger.info('Bot deteniendo...')
    await this.emailAlert.sendAlert('BOT_STOP', { reason })
    if (this.cycleInterval)  clearInterval(this.cycleInterval)
    if (this.pollerInterval) clearInterval(this.pollerInterval)
    if (this.dailyCronJob)   this.dailyCronJob.stop()
    await prisma.$disconnect()
    logger.info('Bot detenido limpiamente.')
    process.exit(0)
  }

  async runCycle() {
    if (this.isRunning) {
      logger.warn('Ciclo anterior todavía en ejecución, saltando')
      return
    }
    this.isRunning = true
    const startedAt = Date.now()

    try {
      if (!isMarketOpen()) {
        logger.info(formatMarketStatus())
        return
      }

      // 1 — Cotizaciones y ticks
      const assets        = await assetRepository.findAll()
      const currentPrices = new Map()

      for (const asset of assets) {
        try {
          const quote = await this.marketDataService.getQuote(asset.symbol, asset.market)
          await priceTickRepository.insert(asset.id, quote)
          if (quote.price !== null) currentPrices.set(asset.id, Number(quote.price))
        } catch (err) {
          logger.error('Error obteniendo cotización', { symbol: asset.symbol, error: err.message })
        }
      }

      // 2 — Actualizar PnL no realizado
      if (currentPrices.size > 0) {
        await this.positionUpdater.updateUnrealizedPnl(currentPrices)
      }

      // 3 — Ciclo de estrategia
      const { BUY, SELL, HOLD, decisions } = await this.strategyEngine.runCycle()

      // 4 — Actualizar lastCycleAt
      await botStateRepository.update({ lastCycleAt: new Date() })

      // 5 — Validar y ejecutar cada decisión
      let approved        = 0
      let executed        = 0
      const executedItems = []

      for (const decision of decisions) {
        const botState  = await botStateRepository.get()
        const positions = await positionRepository.findAll()

        const lastOrderByAsset = new Map()
        for (const asset of assets) {
          const orders = await orderRepository.getByAsset(asset.id)
          if (orders.length > 0) {
            const latest = orders.reduce((max, o) =>
              new Date(o.createdAt) > new Date(max.createdAt) ? o : max
            )
            lastOrderByAsset.set(asset.id, new Date(latest.createdAt))
          }
        }

        const riskResult = this.riskManager.validate(decision, botState, positions, lastOrderByAsset)

        if (riskResult.approved) {
          approved++
          const execResult = await this.executionEngine.execute({ ...decision, quantity: riskResult.quantity })
          if (execResult.success) {
            executed++
            executedItems.push({ decision, quantity: riskResult.quantity })
          }
        } else {
          logger.info('Decisión rechazada por Risk Manager', {
            symbol: decision.asset?.symbol, reason: riskResult.reason,
          })
        }
      }

      // 6 — Alertas por órdenes ejecutadas
      if (process.env.ALERT_ON_ORDER === 'true') {
        for (const item of executedItems) {
          await this.emailAlert.sendAlert('ORDER_FILLED', {
            symbol:   item.decision.asset?.symbol,
            side:     item.decision.signal === 'BUY' ? 'compra' : 'venta',
            quantity: item.quantity,
            price:    Number(item.decision.priceAtDecision),
            pnl:      0,
          })
        }
      }

      // 7 — Verificar drawdown
      const finalState    = await botStateRepository.get()
      const capitalTotal  = Number(finalState.capitalTotal)
      const peakCapital   = Number(finalState.peakCapital)
      if (peakCapital > 0) {
        const drawdown   = (peakCapital - capitalTotal) / peakCapital * 100
        const alertThreshold = Number(process.env.ALERT_DRAWDOWN_PCT ?? 10)
        if (drawdown >= alertThreshold) {
          await this.emailAlert.sendAlert('DRAWDOWN_ALERT', {
            current: drawdown.toFixed(2),
            limit:   alertThreshold,
          })
        }
      }

      const duracionMs = Date.now() - startedAt
      logger.info('Resumen del ciclo', {
        duracionMs,
        senales: { BUY: BUY ?? 0, SELL: SELL ?? 0, HOLD: HOLD ?? 0 },
        aprobadas: approved,
        ejecutadas: executed,
      })
    } catch (err) {
      logger.error('Error en ciclo del Orchestrator', {
        duracionMs: Date.now() - startedAt,
        error: err.message,
        stack: err.stack,
      })
      await this.emailAlert.sendAlert('CRITICAL_ERROR', {
        message: err.message,
        context: 'runCycle',
      })
    } finally {
      this.isRunning = false
    }
  }
}
