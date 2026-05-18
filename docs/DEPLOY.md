# Deploy en Railway

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
