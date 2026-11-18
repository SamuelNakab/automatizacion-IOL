import axios from 'axios'
import { getAuthHeaders } from '../auth/tokenManager.js'
import logger from '../shared/logger.js'
import { ANALYSIS_ONLY } from '../shared/constants.js'

function assertTradingAllowed(action) {
  if (ANALYSIS_ONLY) {
    logger.error('Bloqueado: el bot está en modo SOLO ANÁLISIS y nunca opera', { action })
    throw new Error(`Modo solo análisis: ${action} bloqueado — el bot nunca envía órdenes`)
  }
}

// IMPORTANTE: Este módulo NUNCA se llama con DRY_RUN=true.
// La verificación de DRY_RUN la hace executionEngine.js antes de llamar aquí.

const RETRY_DELAYS_MS = [1000, 2000, 4000]

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function postWithRetry(endpoint, payload) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const headers = await getAuthHeaders()
      const url = `${process.env.IOL_BASE_URL}${endpoint}`
      const response = await axios.post(url, payload, { headers })
      return response.data
    } catch (err) {
      lastError = err
      logger.error('Error en POST de orden a IOL', {
        endpoint, attempt, maxAttempts: 3,
        status:  err.response?.status ?? 'network_error',
        message: err.message,
      })
      if (attempt < 3) await sleep(RETRY_DELAYS_MS[attempt - 1])
    }
  }
  throw lastError
}

export async function sendBuyOrder(orderPayload) {
  assertTradingAllowed('sendBuyOrder')
  return postWithRetry('/api/v2/operar/Comprar', orderPayload)
}

export async function sendSellOrder(orderPayload) {
  assertTradingAllowed('sendSellOrder')
  return postWithRetry('/api/v2/operar/Vender', orderPayload)
}

export async function cancelOrder(iolOrderId) {
  assertTradingAllowed('cancelOrder')
  const headers = await getAuthHeaders()
  const response = await axios.delete(
    `${process.env.IOL_BASE_URL}/api/v2/operaciones/${iolOrderId}`,
    { headers }
  )
  return response.data
}

export async function getOrderStatus(iolOrderId) {
  const headers = await getAuthHeaders()
  const response = await axios.get(
    `${process.env.IOL_BASE_URL}/api/v2/operaciones/${iolOrderId}`,
    { headers }
  )
  return response.data
}
