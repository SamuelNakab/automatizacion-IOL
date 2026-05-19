# Deploy en Railway

## Prerequisitos

- Cuenta de GitHub con el repo del bot
- Cuenta de Railway ([railway.app](https://railway.app)) creada con esa cuenta de GitHub

---

## Pasos

### 1. Crear el proyecto

- railway.app → **New Project → Deploy from GitHub repo**
- Seleccionar el repo del bot
- Railway detecta Node.js automáticamente y usa el `railway.json` y `Procfile` de la raíz

### 2. Variables de entorno

En Railway Dashboard → tu proyecto → **Settings → Variables → Add Variable**,
agregar **TODAS** las variables de `.env.railway.example` con sus valores reales.

Variables críticas a no olvidar:

| Variable | Valor |
|----------|-------|
| `DRY_RUN` | `true` — NUNCA `false` hasta Fase 8 |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL del pooler de Neon |
| `DIRECT_URL` | URL directa de Neon (sin `-pooler` en el hostname) |
| `IOL_USERNAME` | Email de tu cuenta IOL |
| `IOL_PASSWORD` | Contraseña de tu cuenta IOL |
| `IOL_BASE_URL` | `https://api.invertironline.com` |
| `INITIAL_CAPITAL` | Capital inicial en ARS |
| `TWILIO_ACCOUNT_SID` | SID de tu cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | Auth token de Twilio |
| `TWILIO_WHATSAPP_TO` | Número destino `whatsapp:+549XXXXXXXXXX` |
| `ALERT_EMAIL_FROM` | Email Gmail remitente |
| `ALERT_EMAIL_PASSWORD` | App password de Google |
| `ALERT_EMAIL_TO` | Email destinatario de alertas |

Las demás variables (`MARKET_*`, `RISK_*`, `BUY_*`, `TAKE_PROFIT_PCT`, etc.)
pueden usar los valores por defecto del `.env.railway.example`.

### 3. Deploy

Railway hace el deploy automáticamente al detectar el repositorio.
Cada push a `main` dispara un nuevo deploy.

Verificar en **Railway → Deployments → Logs** que aparece:

```
{"message":"Metrics server escuchando","port":XXXX,"endpoint":"/health"}
{"message":"Bot iniciando..."}
{"message":"Bot corriendo. Ctrl+C para detener."}
```

También debería llegar un email de `BOT_START` a `ALERT_EMAIL_TO`.

### 4. Verificar funcionamiento

En **Railway logs** verificar los ciclos del bot:

- **Entre 11:00-17:00 ARG** (lunes a viernes): aparece el score de cada activo y señales
- **Fuera de horario**: aparece `"Mercado cerrado — próxima apertura: ..."`
- **Cada 5 minutos** (`POLL_INTERVAL_MS=300000`): nuevo ciclo de análisis

### 5. DRY_RUN=false (solo Fase 8)

Cuando estés listo para operar con capital real:

1. Railway Dashboard → tu proyecto → **Settings → Variables**
2. Editar `DRY_RUN` → cambiar a `false`
3. Verificar en logs que aparece `"dryRun":false`
4. El bot comenzará a enviar órdenes reales a IOL

**NUNCA cambiar DRY_RUN antes de la Fase 8.**

---

## Archivos de configuración incluidos

| Archivo | Propósito |
|---------|-----------|
| `railway.json` | Builder NIXPACKS, restart `ON_FAILURE` (máx 3 reintentos) |
| `Procfile` | `web: node scripts/startBot.js` |
| `.env.railway.example` | Lista completa de variables con descripción |

---

## Rollback

Railway Dashboard → **Deployments** → seleccionar un deploy anterior → **Redeploy**.

---

## Actualizar variables sin redeploy

Railway aplica los cambios de variables reiniciando el servicio automáticamente
al guardar en Settings → Variables.
