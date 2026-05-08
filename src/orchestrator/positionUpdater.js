import prisma                from '../persistence/prismaClient.js'
import * as positionRepository from '../persistence/positionRepository.js'
import * as botStateRepository from '../persistence/botStateRepository.js'
import logger                  from '../shared/logger.js'

// Confirma que una orden fue ejecutada por el mercado.
// Usa prisma.$transaction para actualizar orders, positions y bot_state ATÓMICAMENTE.
// Si la transacción falla: loguea y relanza — requiere intervención manual.
export async function confirmOrderFilled(order, filledQuantity, filledPrice) {
  const qty   = Number(filledQuantity)
  const price = Number(filledPrice)

  try {
    await prisma.$transaction(async (tx) => {
      // 1 — Actualizar la orden a 'filled'
      await tx.order.update({
        where: { id: order.id },
        data:  { status: 'filled', iolResponse: { filledQuantity: qty, filledPrice: price, confirmedAt: new Date().toISOString() } },
      })

      // 2 — Upsert de posición
      const existing = await tx.position.findUnique({ where: { assetId: order.assetId } })

      if (order.side === 'buy') {
        if (!existing) {
          await tx.position.create({
            data: {
              assetId:       order.assetId,
              quantity:      qty,
              avgCost:       price,
              currentPrice:  price,
              unrealizedPnl: 0,
              openedAt:      new Date(),
            },
          })
        } else {
          const oldQty  = Number(existing.quantity)
          const oldCost = Number(existing.avgCost)
          const totalQty  = oldQty + qty
          const newAvgCost = (oldQty * oldCost + qty * price) / totalQty
          await tx.position.update({
            where: { assetId: order.assetId },
            data:  {
              quantity:      totalQty,
              avgCost:       newAvgCost,
              currentPrice:  price,
              unrealizedPnl: (price - newAvgCost) * totalQty,
            },
          })
        }
      } else {
        // SELL
        if (existing) {
          const remaining = Number(existing.quantity) - qty
          if (remaining <= 0) {
            await tx.position.delete({ where: { assetId: order.assetId } })
          } else {
            const avgCost = Number(existing.avgCost)
            await tx.position.update({
              where: { assetId: order.assetId },
              data:  {
                quantity:      remaining,
                currentPrice:  price,
                unrealizedPnl: (price - avgCost) * remaining,
              },
            })
          }
        }
      }

      // 3 — Actualizar bot_state
      const bs = await tx.botState.findUnique({ where: { id: 1 } })
      let capitalAvailable = Number(bs.capitalAvailable)
      let realizedPnl      = Number(bs.realizedPnl)

      if (order.side === 'buy') {
        capitalAvailable -= qty * price
      } else {
        capitalAvailable += qty * price
        if (existing) realizedPnl += (price - Number(existing.avgCost)) * qty
      }

      const allPositions  = await tx.position.findMany()
      const unrealizedPnl = allPositions.reduce((s, p) => s + Number(p.unrealizedPnl), 0)
      const capitalTotal  = Number(bs.capitalTotal)
      const peakCapital   = Number(bs.peakCapital)
      const maxDrawdown   = capitalTotal < peakCapital
        ? Math.max(Number(bs.maxDrawdown), (peakCapital - capitalTotal) / peakCapital * 100)
        : Number(bs.maxDrawdown)

      await tx.botState.update({
        where: { id: 1 },
        data:  { capitalAvailable, realizedPnl, unrealizedPnl, maxDrawdown, totalOperations: bs.totalOperations + 1 },
      })
    })

    logger.info('Orden confirmada como filled', { orderId: order.id, side: order.side, qty, price })
  } catch (err) {
    logger.error('Error en confirmOrderFilled — requiere intervención manual', {
      orderId: order.id, error: err.message,
    })
    throw err
  }
}

// Actualiza unrealizedPnl de todas las posiciones con precios en tiempo real.
// No usa transacción (es estimativa, no financiera).
export async function updateUnrealizedPnl(currentPrices) {
  const positions = await positionRepository.findAll()

  for (const pos of positions) {
    const currentPrice = currentPrices.get(pos.assetId)
    if (currentPrice === undefined) continue

    const qty     = Number(pos.quantity)
    const avgCost = Number(pos.avgCost)

    await positionRepository.upsert(pos.assetId, {
      quantity:      qty,
      avgCost:       avgCost,
      currentPrice,
      unrealizedPnl: (currentPrice - avgCost) * qty,
      openedAt:      pos.openedAt,
    })
  }

  const updated        = await positionRepository.findAll()
  const totalUnrealized = updated.reduce((s, p) => s + Number(p.unrealizedPnl), 0)
  await botStateRepository.update({ unrealizedPnl: totalUnrealized })
}
