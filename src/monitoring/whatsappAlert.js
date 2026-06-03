import twilio from 'twilio'
import logger  from '../shared/logger.js'

const TWILIO_ACCOUNT_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN    = process.env.TWILIO_AUTH_TOKEN
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM
const TWILIO_WHATSAPP_TO   = process.env.TWILIO_WHATSAPP_TO

let client       = null
let isConfigured = false

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM && TWILIO_WHATSAPP_TO) {
  client       = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  isConfigured = true
} else {
  logger.warn('WhatsApp no configurado — alertas desactivadas')
}

function buildBody(type, data) {
  if (type === 'BUY_SIGNAL') {
    const signalLines = (data.signals ?? []).map(s => `  ✓ ${s}`).join('\n')
    const dashLine    = data.dashboardUrl ? `\nVer dashboard: ${data.dashboardUrl}` : ''
    return [
      `🟢 Oportunidad de compra — ${data.symbol}`,
      `Confianza: ${data.confidence}% (${data.score}/9 puntos)`,
      `Precio actual: $${data.price}`,
      '',
      'Señales activas:',
      signalLines,
      dashLine,
    ].join('\n').trim()
  }

  if (type === 'SELL_EXECUTED') {
    return [
      `✅ Venta ejecutada — ${data.symbol}`,
      `Precio de compra: $${data.buyPrice}`,
      `Precio de venta: $${data.sellPrice}`,
      `Ganancia: +${data.gainPct}%`,
    ].join('\n')
  }

  if (type === 'CRITICAL_ERROR') {
    return `🚨 Error crítico en el bot\n${data.message}`
  }

  if (type === 'MARKET_OPEN') {
    const now = new Date()
    const argTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const timeStr = argTime.toISOString().slice(11, 16)
    return [
      '🔔 Mercado abierto',
      `Hora: ${timeStr} ARG`,
      'Bot activo — monitoreando 6 activos',
      `Ver dashboard: ${process.env.DASHBOARD_URL || ''}`,
    ].join('\n').trim()
  }

  if (type === 'MARKET_CLOSE') {
    const now = new Date()
    const argTime = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const timeStr = argTime.toISOString().slice(11, 16)
    return [
      '🔕 Mercado cerrado',
      `Hora: ${timeStr} ARG`,
      'Bot en standby hasta el próximo día hábil',
    ].join('\n').trim()
  }

  return `[${type}] ${JSON.stringify(data)}`
}

export async function sendAlert(type, data) {
  if (!isConfigured) return

  try {
    const body = buildBody(type, data)
    await client.messages.create({ from: TWILIO_WHATSAPP_FROM, to: TWILIO_WHATSAPP_TO, body })
    logger.info('WhatsApp alerta enviada', { type, to: TWILIO_WHATSAPP_TO })
  } catch (err) {
    logger.error('Error enviando WhatsApp', { type, error: err.message })
  }
}
