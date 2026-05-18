# Deploy — Trading Bot IOL

---

## Deploy en Render

### Paso 1 — Crear el servicio

1. [render.com](https://render.com) → **New → Web Service**
2. Conectar el repositorio de GitHub del bot
3. Configuración:
   - **Build Command:** `npm install`
   - **Start Command:** `node scripts/startBot.js`
   - **Environment:** Node
   - El archivo `render.yaml` en la raíz ya define estas opciones automáticamente

### Paso 2 — Variables de entorno

En Render Dashboard → tu servicio → **Environment**, agregar todas estas variables:

| Variable | Descripción |
|----------|-------------|
| `IOL_USERNAME` | Email de tu cuenta IOL |
| `IOL_PASSWORD` | Contraseña de tu cuenta IOL |
| `IOL_BASE_URL` | `https://api.invertironline.com` |
| `DATABASE_URL` | URL del pooler de Neon (con `-pooler` en el hostname) |
| `DIRECT_URL` | URL directa de Neon (sin `-pooler`) |
| `DRY_RUN` | `true` hasta Fase 8 — NUNCA cambiar a false antes |
| `INITIAL_CAPITAL` | Capital inicial en ARS |
| `MARKET_OPEN_HOUR` | `11` |
| `MARKET_CLOSE_HOUR` | `17` |
| `POLL_INTERVAL_MS` | `300000` (5 minutos) |
| `ORDER_POLL_INTERVAL_MS` | `60000` |
| `ORPHAN_ORDER_TIMEOUT_MIN` | `30` |
| `RISK_MAX_CAPITAL_PER_TRADE_PCT` | `10` |
| `RISK_MAX_EXPOSURE_PER_ASSET_PCT` | `20` |
| `RISK_MAX_TOTAL_EXPOSURE_PCT` | `60` |
| `RISK_MAX_DRAWDOWN_PCT` | `15` |
| `RISK_MIN_OPERATION_INTERVAL_MINUTES` | `60` |
| `MONITORING_PORT` | `3001` (Render asigna PORT automáticamente, este es el fallback) |
| `ALERT_EMAIL_FROM` | Email Gmail remitente |
| `ALERT_EMAIL_TO` | Email destinatario de alertas |
| `ALERT_EMAIL_PASSWORD` | App password de Google |
| `ALERT_ON_ORDER` | `true` |
| `ALERT_DRAWDOWN_PCT` | `10` |
| `DASHBOARD_URL` | URL del dashboard (opcional) |
| `TWILIO_ACCOUNT_SID` | SID de tu cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | Auth token de Twilio |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` |
| `TWILIO_WHATSAPP_TO` | Número destino `whatsapp:+549XXXXXXXXXX` |
| `BUY_SIGNAL_THRESHOLD` | `6` |
| `BUY_INTRADAY_WINDOW_HOURS` | `2` |
| `TAKE_PROFIT_PCT` | `8` |

Ver `.env.deploy.example` para la lista completa.

> **Nota sobre PORT:** Render inyecta automáticamente la variable `PORT`. El servidor de
> health check del bot usa `process.env.PORT` primero — no es necesario configurarla manualmente.

### Paso 3 — Deploy

Click en **"Create Web Service"**.

Render detecta el `render.yaml` y ejecuta `npm install` + `node scripts/startBot.js`.

Verificar en los logs de Render que aparece:

```
{"message":"Metrics server escuchando","port":XXXX,"endpoint":"/health"}
{"message":"Bot iniciando..."}
{"message":"Bot corriendo. Ctrl+C para detener."}
```

### Paso 4 — Configurar UptimeRobot

Render free tier duerme el servicio después de 15 minutos sin requests HTTP.
UptimeRobot hace ping cada 5 minutos para mantenerlo despierto.

1. [uptimerobot.com](https://uptimerobot.com) → **Add New Monitor**
2. **Monitor Type:** HTTP(s)
3. **Friendly Name:** Trading Bot IOL
4. **URL:** `https://tu-servicio.onrender.com/health`
5. **Monitoring Interval:** Every 5 minutes
6. Click **"Create Monitor"**

Verificar que UptimeRobot marca el monitor como **"Up"** (verde).
El bot ya no se dormirá.

### Paso 5 — Verificar funcionamiento

En **Render logs** verificar que cada ciclo del bot aparece en los logs.

En **UptimeRobot** verificar que el monitor está verde y los pings llegan cada 5 minutos.

Para verificar el health check manualmente desde la máquina local (con el bot corriendo):

```bash
node scripts/healthCheck.js
# ✅ Bot corriendo correctamente — http://localhost:3001/health respondió 200
```

---

## Deploy en Railway

## Prerequisitos

- Cuenta en [Railway](https://railway.app)
- CLI de Railway instalada: `npm install -g @railway/cli`
- Repositorio en GitHub
- Base de datos Neon PostgreSQL activa con el schema aplicado

---

## Paso 1 — Crear el proyecto en Railway

```bash
railway login
railway init
```

O desde el dashboard: **New Project → Deploy from GitHub repo → seleccionar este repo**.

---

## Paso 2 — Configurar variables de entorno

En Railway Dashboard → tu proyecto → **Settings → Variables**, agregar todas las variables del archivo `.env.railway.example`.

Variables obligatorias:

| Variable | Descripción |
|----------|-------------|
| `IOL_USERNAME` | Email de tu cuenta IOL |
| `IOL_PASSWORD` | Contraseña de tu cuenta IOL |
| `IOL_BASE_URL` | `https://api.invertironline.com` |
| `DATABASE_URL` | URL del pooler de Neon (con `-pooler` en el hostname) |
| `DIRECT_URL` | URL directa de Neon (sin `-pooler`) |
| `DRY_RUN` | `true` hasta Fase 8 — NUNCA cambiar a false antes de esa fase |
| `INITIAL_CAPITAL` | Capital inicial del bot en ARS |
| `TWILIO_ACCOUNT_SID` | SID de tu cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | Auth token de Twilio |
| `TWILIO_WHATSAPP_TO` | Número destino `whatsapp:+549XXXXXXXXXX` |
| `ALERT_EMAIL_FROM` | Email Gmail remitente |
| `ALERT_EMAIL_TO` | Email destinatario de alertas |
| `ALERT_EMAIL_PASSWORD` | App password de Google |

Variables con default razonable (se pueden dejar en los valores del `.env.railway.example`):

`MARKET_OPEN_HOUR`, `MARKET_CLOSE_HOUR`, `POLL_INTERVAL_MS`, `ORDER_POLL_INTERVAL_MS`,
`ORPHAN_ORDER_TIMEOUT_MIN`, `RISK_*`, `BUY_*`, `TAKE_PROFIT_PCT`, `ALERT_ON_ORDER`, `ALERT_DRAWDOWN_PCT`

---

## Paso 3 — Deploy

```bash
railway up
```

O desde el dashboard: el deploy se dispara automáticamente en cada push a `main`.

Railway detecta el `Procfile` o `railway.json` y ejecuta:

```
node scripts/startBot.js
```

---

## Paso 4 — Verificar que arrancó

En Railway Dashboard → tu proyecto → **Deployments → ver logs**.

Buscar en los logs:

```
{"message":"Bot iniciando..."}
{"message":"Configuración del bot","dryRun":"true",...}
{"message":"Daily update programado para las 18:00 ARG días hábiles"}
{"message":"Bot corriendo. Ctrl+C para detener."}
```

Si aparece `DRY_RUN debe ser true`, verificar que la variable `DRY_RUN=true` está configurada en Railway.

---

## Paso 5 — Confirmar DRY_RUN

**CRÍTICO**: El bot no debe operar con dinero real hasta la Fase 8.

Verificar en los logs que aparece `"dryRun":true` en el mensaje de configuración.

Verificar que las órdenes generadas tienen status `dry_run` o `pending_manual`, nunca `sent`.

---

## Monitoreo continuo

- **Logs en tiempo real**: Railway Dashboard → Deployments → Logs
- **Alertas por email**: configuradas en `ALERT_EMAIL_TO`
- **Alertas por WhatsApp**: enviadas a `TWILIO_WHATSAPP_TO`
- **Reinicio automático**: Railway reinicia el bot en caso de crash (`ON_FAILURE`, máx 3 reintentos)

---

## Rollback

Desde Railway Dashboard → Deployments → seleccionar un deploy anterior → **Redeploy**.

---

## Actualizar variables sin redeploy

Railway permite actualizar variables en Settings → Variables sin necesidad de redeploy manual.
El servicio se reinicia automáticamente al guardar los cambios.

---

## Base de datos — Neon PostgreSQL

El bot usa Neon en modo serverless. La URL del pooler (`DATABASE_URL`) es para las
queries de runtime. La URL directa (`DIRECT_URL`) es solo para `prisma migrate`.

En producción Railway **no corre migrations automáticamente**. Si hay cambios de schema:

```bash
# Desde tu máquina local con DIRECT_URL configurada:
npx prisma db push
```

---

## Fase 8 — Activar operaciones reales

Solo cuando el usuario dé instrucción explícita:

1. Cambiar `DRY_RUN=false` en Railway Settings → Variables
2. Verificar en logs que aparece `"dryRun":false`
3. El bot comenzará a enviar órdenes reales a IOL

**NUNCA cambiar DRY_RUN a false antes de la Fase 8.**
