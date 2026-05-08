import { buildBuyOrder, buildSellOrder } from './orderBuilder.js'
import * as iolOrderClient  from './iolOrderClient.js'
import * as orderRepository from '../persistence/orderRepository.js'
import logger               from '../shared/logger.js'
import { SIGNALS }          from '../shared/constants.js'

export default class ExecutionEngine {
  // execute(approvedDecision)
  //   approvedDecision = { assetId, signal, priceAtDecision, quantity, asset: { symbol, market }, id? }
  //   Retorna: { success: bool, orderId, status, reason? }
  async execute(approvedDecision) {
    const { assetId, signal, priceAtDecision, quantity, asset } = approvedDecision
    const { symbol, market } = asset
    const price    = Number(priceAtDecision)
    const qty      = Math.floor(Number(quantity))

    // PASO 1 — Verificar DRY_RUN antes de cualquier comunicación con IOL
    if (process.env.DRY_RUN === 'true') {
      logger.info('ORDEN SIMULADA [DRY_RUN]', { tipo: 'DRY_RUN', symbol, signal, quantity: qty, price })

      const order = await orderRepository.insert({
        assetId,
        decisionId: approvedDecision.id ?? null,
        side:       signal === SIGNALS.BUY ? 'buy' : 'sell',
        quantity:   qty,
        price,
        status:     'dry_run',
      })

      return { success: true, orderId: order.id, status: 'dry_run', reason: 'DRY_RUN activo' }
    }

    // PASO 2 — Construir la orden para IOL (puro, sin efectos)
    const orderPayload = signal === SIGNALS.BUY
      ? buildBuyOrder(symbol, market, qty, price)
      : buildSellOrder(symbol, market, qty, price)

    // PASO 3 — Persistir como 'pending' antes de enviar
    const order = await orderRepository.insert({
      assetId,
      decisionId: approvedDecision.id ?? null,
      side:       signal === SIGNALS.BUY ? 'buy' : 'sell',
      quantity:   qty,
      price,
      status:     'pending',
    })

    // PASO 4 — Enviar a IOL
    try {
      const iolResponse = signal === SIGNALS.BUY
        ? await iolOrderClient.sendBuyOrder(orderPayload)
        : await iolOrderClient.sendSellOrder(orderPayload)

      // PASO 5 — Actualizar con iolOrderId y status 'sent'
      const iolOrderId = iolResponse?.numero ? String(iolResponse.numero) : null
      await orderRepository.updateStatus(order.id, 'sent', iolResponse)

      // PASO 6 — Loguear envío
      logger.info('Orden enviada a IOL', { symbol, signal, quantity: qty, price, iolOrderId })

      // PASO 7 — Retornar
      return { success: true, orderId: order.id, status: 'sent' }
    } catch (err) {
      await orderRepository.updateStatus(order.id, 'rejected', { error: err.message })
      logger.error('Error enviando orden a IOL', { symbol, signal, error: err.message })
      return { success: false, orderId: order.id, status: 'rejected', reason: err.message }
    }
  }
}
