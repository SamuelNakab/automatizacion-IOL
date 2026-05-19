import http   from 'http'
import logger from '../shared/logger.js'

let server = null

export function setupMetricsServer() {
  // PORT es asignado por la plataforma (Railway/Render); MONITORING_PORT es el fallback local
  const port = Number(process.env.PORT || process.env.MONITORING_PORT || 3001)

  server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  server.listen(port, () => {
    logger.info('Metrics server escuchando', { port, endpoint: '/health' })
  })

  server.on('error', (err) => {
    logger.error('Error en metrics server', { error: err.message })
  })

  return server
}

export function stopMetricsServer() {
  if (server) server.close()
}
