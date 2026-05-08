import nodemailer from 'nodemailer'
import logger from '../shared/logger.js'

const emailFrom    = process.env.ALERT_EMAIL_FROM
const emailTo      = process.env.ALERT_EMAIL_TO
const emailPass    = process.env.ALERT_EMAIL_PASSWORD
const dashboardUrl = process.env.DASHBOARD_URL || ''

let transporter  = null
let isConfigured = false

if (emailFrom && emailTo && emailPass) {
  transporter  = nodemailer.createTransport({ service: 'gmail', auth: { user: emailFrom, pass: emailPass } })
  isConfigured = true
} else {
  logger.warn('Email alerts no configuradas — alertas desactivadas')
}

function link() {
  return dashboardUrl ? `<p><a href="${dashboardUrl}">Ver dashboard →</a></p>` : ''
}

function buildSubject(type, data) {
  switch (type) {
    case 'BOT_START':      return '🤖 Trading Bot iniciado'
    case 'ORDER_FILLED':   return `✅ Orden ejecutada — ${data.side} ${data.symbol}`
    case 'DRAWDOWN_ALERT': return `⚠️ Alerta de drawdown — ${data.current}%`
    case 'CRITICAL_ERROR': return '🚨 Error crítico en el bot'
    case 'BOT_STOP':       return '⛔ Trading Bot detenido'
    default:               return `Bot alert: ${type}`
  }
}

function buildHtml(type, data) {
  switch (type) {
    case 'BOT_START':
      return `<h2>Bot iniciado correctamente</h2>
<p><b>Modo:</b> ${data.dryRun ? 'DRY RUN (simulación)' : '⚠️ PRODUCCIÓN'}</p>
<p><b>Capital inicial:</b> $${data.capital}</p>
<p><b>Ciclo:</b> cada ${(data.pollInterval / 1000)}s</p>
${link()}`

    case 'ORDER_FILLED':
      return `<h2>Orden ejecutada</h2>
<table>
  <tr><td>Activo</td><td>${data.symbol}</td></tr>
  <tr><td>Operación</td><td>${data.side}</td></tr>
  <tr><td>Cantidad</td><td>${data.quantity}</td></tr>
  <tr><td>Precio</td><td>$${data.price}</td></tr>
  <tr><td>PnL</td><td>$${data.pnl}</td></tr>
</table>
${link()}`

    case 'DRAWDOWN_ALERT':
      return `<h2>⚠️ Drawdown alto detectado</h2>
<p><b>Drawdown actual:</b> ${data.current}%</p>
<p><b>Límite configurado:</b> ${data.limit}%</p>
<p>El bot sigue operando pero solo aprobará señales SELL.</p>
${link()}`

    case 'CRITICAL_ERROR':
      return `<h2>🚨 Error crítico</h2>
<p><b>Error:</b> ${data.message}</p>
<p><b>Contexto:</b> ${data.context}</p>
<p>Revisar logs para más detalle.</p>`

    case 'BOT_STOP':
      return `<h2>Bot detenido</h2>
<p><b>Motivo:</b> ${data.reason}</p>`

    default:
      return `<pre>${JSON.stringify(data, null, 2)}</pre>`
  }
}

export async function sendAlert(type, data) {
  if (!isConfigured) return

  try {
    const subject = buildSubject(type, data)
    const html    = buildHtml(type, data)
    await transporter.sendMail({ from: emailFrom, to: emailTo, subject, html })
    logger.info('Email alert enviada', { type, to: emailTo })
  } catch (err) {
    logger.error('Error enviando email alert', { type, error: err.message })
    // NO relanzar — un fallo de email nunca detiene el bot
  }
}
