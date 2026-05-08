import * as orderRepository from '../persistence/orderRepository.js'
import * as iolOrderClient  from '../execution/iolOrderClient.js'
import { confirmOrderFilled } from './positionUpdater.js'
import logger from '../shared/logger.js'

const ORPHAN_TIMEOUT_MIN = () => parseInt(process.env.ORPHAN_ORDER_TIMEOUT_MIN ?? '30')

// Estados de IOL que se consideran "filled" (el mercado ejecutó la orden)
const FILLED_STATUSES = new Set(['Cerrada', 'filled', 'Ejecutada', 'ParcialmenteEjecutada'])
const CANCELLED_STATUSES = new Set(['Cancelada', 'cancelled', 'Rechazada', 'rejected'])

export async function pollPendingOrders() {
  const sentOrders = await orderRepository.getSent()
  let updated = 0

  for (const order of sentOrders) {
    if (!order.iolOrderId) continue
    try {
      const iolStatus = await iolOrderClient.getOrderStatus(order.iolOrderId)
      const estado = iolStatus?.estado ?? iolStatus?.status ?? ''

      if (FILLED_STATUSES.has(estado)) {
        await confirmOrderFilled(order, Number(order.quantity), Number(order.price))
        updated++
      } else if (CANCELLED_STATUSES.has(estado)) {
        await orderRepository.updateStatus(order.id, 'cancelled', iolStatus)
        updated++
      }
      // Si sigue 'sent': no hacer nada
    } catch (err) {
      logger.error('Error al consultar estado de orden en IOL', {
        orderId: order.id, iolOrderId: order.iolOrderId, error: err.message,
      })
    }
  }

  logger.info('Polling de órdenes completado', { checked: sentOrders.length, updated })
}

export async function resolveOrphanOrders() {
  const orphans = await orderRepository.getOrphans(ORPHAN_TIMEOUT_MIN())
  if (orphans.length === 0) return

  logger.warn('Órdenes huérfanas detectadas', { count: orphans.length })

  for (const order of orphans) {
    try {
      if (order.iolOrderId) {
        const iolStatus = await iolOrderClient.getOrderStatus(order.iolOrderId)
        const estado = iolStatus?.estado ?? iolStatus?.status ?? ''

        if (FILLED_STATUSES.has(estado)) {
          await confirmOrderFilled(order, Number(order.quantity), Number(order.price))
        } else {
          const newStatus = CANCELLED_STATUSES.has(estado) ? 'cancelled' : 'rejected'
          await orderRepository.updateStatus(order.id, newStatus, iolStatus)
        }
      } else {
        await orderRepository.updateStatus(order.id, 'rejected', { reason: 'orphan_no_iol_id' })
      }
      logger.info('Orden huérfana resuelta', { orderId: order.id, side: order.side, status: order.status })
    } catch (err) {
      logger.error('Error resolviendo orden huérfana', { orderId: order.id, error: err.message })
    }
  }
}
