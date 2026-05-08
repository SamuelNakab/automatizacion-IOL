import { RISK_CONFIG } from '../shared/riskConfig.js'

// REGLA 6 (documentada): no duplicar señal si ya hay una orden pending para el mismo activo.
// Esta validación la hace el Orchestrator antes de llamar a validate(), no el RiskManager.

export default class RiskManager {
  constructor(config = RISK_CONFIG) {
    this.config = config
  }

  // validate(decision, botState, positions, lastOrderByAsset)
  //   → { approved: boolean, reason: string }
  //
  // decision: { assetId, signal, priceAtDecision, asset: { symbol } }
  // botState:  objeto completo de botStateRepository.get()
  // positions: array de todas las posiciones abiertas
  // lastOrderByAsset: Map de assetId → Date de la última orden
  validate(decision, botState, positions, lastOrderByAsset) {
    const {
      MAX_CAPITAL_PER_TRADE_PCT,
      MAX_EXPOSURE_PER_ASSET_PCT,
      MAX_TOTAL_EXPOSURE_PCT,
      MAX_DRAWDOWN_PCT,
      MIN_OPERATION_INTERVAL_MINUTES,
    } = this.config

    const { assetId, signal, priceAtDecision } = decision
    const symbol         = decision.asset?.symbol ?? String(assetId)
    const capitalTotal     = Number(botState.capitalTotal)
    const capitalAvailable = Number(botState.capitalAvailable)
    const peakCapital      = Number(botState.peakCapital)

    // REGLA 1 — Drawdown: si supera el máximo, solo se permiten ventas
    const drawdown = peakCapital > 0
      ? (peakCapital - capitalTotal) / peakCapital * 100
      : 0
    if (drawdown >= MAX_DRAWDOWN_PCT && signal === 'BUY') {
      return { approved: false, reason: 'Drawdown máximo alcanzado: solo se permiten ventas' }
    }

    // REGLA 2 — Intervalo mínimo entre operaciones del mismo activo
    const lastOrderTime = lastOrderByAsset.get(assetId)
    if (lastOrderTime) {
      const minutesSince = (Date.now() - new Date(lastOrderTime).getTime()) / 60000
      if (minutesSince < MIN_OPERATION_INTERVAL_MINUTES) {
        return { approved: false, reason: `Intervalo mínimo no cumplido para ${symbol}` }
      }
    }

    // REGLA 3 — Capital disponible por operación
    const price = Number(priceAtDecision)
    const cantidadEstimada = Math.floor(capitalAvailable * MAX_CAPITAL_PER_TRADE_PCT / 100 / price)
    if (cantidadEstimada < 1) {
      return { approved: false, reason: `Capital insuficiente para operar ${symbol}` }
    }

    // REGLA 4 — Exposición máxima por activo (solo BUY)
    if (signal === 'BUY') {
      const position       = positions.find(p => p.assetId === assetId)
      const posicionActual = position ? Number(position.quantity) * price : 0
      if (capitalTotal > 0 && posicionActual / capitalTotal * 100 >= MAX_EXPOSURE_PER_ASSET_PCT) {
        return { approved: false, reason: `Exposición máxima por activo alcanzada: ${symbol}` }
      }
    }

    // REGLA 5 — Exposición total del portafolio (solo BUY)
    if (signal === 'BUY') {
      const totalExpuesto = positions.reduce((sum, pos) => {
        return sum + Number(pos.quantity) * Number(pos.currentPrice)
      }, 0)
      if (capitalTotal > 0 && totalExpuesto / capitalTotal * 100 >= MAX_TOTAL_EXPOSURE_PCT) {
        return { approved: false, reason: 'Exposición total del portafolio alcanzada' }
      }
    }

    return { approved: true, reason: 'OK', quantity: cantidadEstimada }
  }
}
