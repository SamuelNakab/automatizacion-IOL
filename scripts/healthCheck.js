import 'dotenv/config'
import http from 'http'

const port = process.env.MONITORING_PORT || 3001
const url  = `http://localhost:${port}/health`

const req = http.get(url, (res) => {
  if (res.statusCode === 200) {
    console.log(`✅ Bot corriendo correctamente — ${url} respondió ${res.statusCode}`)
  } else {
    console.log(`⚠️  /health respondió status inesperado: ${res.statusCode}`)
  }
  process.exit(0)
})

req.on('error', () => {
  console.log(`❌ Bot no responde en el puerto ${port}`)
  process.exit(0)
})

req.setTimeout(3000, () => {
  console.log(`❌ Bot no responde en el puerto ${port} (timeout 3s)`)
  req.destroy()
  process.exit(0)
})
