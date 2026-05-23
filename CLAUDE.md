# CLAUDE.md — Trading Bot IOL

## Contexto del proyecto
Sistema de trading algorítmico multi-activo integrado con la API de InvertirOnline (IOL).
Node.js + PostgreSQL + Prisma. Opera sobre el mercado argentino de capitales.
Dos algoritmos separados: compra (alerta manual) y venta (automática por take profit).

## Stack tecnológico
- Runtime: Node.js 20+ con ESModules (import/export, no require)
- HTTP client: Axios
- Base de datos: PostgreSQL vía Prisma ORM
- Logging: Winston (structured JSON logs)
- Config: dotenv
- Testing: Vitest
- Alertas: Nodemailer (email) + Twilio (WhatsApp)

## Estructura de directorios
src/
auth/           # Token manager de IOL
market-data/    # Market Data Service
strategy/
baseStrategy.js
indicators.js
buyScoreCalculator.js    # Sistema de scoring de compra (9 puntos)
strategyEngine.js
strategies/
buyScoreStrategy.js    # Detecta oportunidades de compra
sellTakeProfitStrategy.js  # Take profit automático
myStrategy.js          # Reservado — no usar
risk/           # Risk Manager
execution/      # Execution Engine
persistence/    # Repositorios de acceso a DB
orchestrator/
orchestrator.js
positionUpdater.js
orderPoller.js
dailyUpdater.js
monitoring/
emailAlert.js
whatsappAlert.js
metricsServer.js
shared/
assets.js
constants.js
marketHours.js
riskConfig.js
prisma/
schema.prisma
migrations/
scripts/
startBot.js
backfill.js
runDailyUpdate.js
runBacktest.js
runBacktestV2.js
checkDb.js
runPipeline.js
docs/
archivos.md
funciones.md
backtest_results.md
backtest_v2_results.md
DEPLOY.md
tests/
unit/

## Reglas críticas de desarrollo

### Variables de entorno
- NUNCA hardcodear credenciales ni configuración sensible
- Toda config va en .env, el código la lee desde process.env
- .env.example siempre actualizado con todas las keys sin valores

### Autenticación con IOL
- Bearer token expira cada 15 minutos
- SIEMPRE usar src/auth/tokenManager.js
- Nunca llamar a IOL directamente sin pasar por el token manager

### Entorno
- IOL_BASE_URL=https://api.invertironline.com
- DRY_RUN=true obligatorio hasta Fase 8

### Logging
- Winston en todos los módulos, nunca console.log
- Formato JSON estructurado con timestamp
- Log levels: error, warn, info, debug

### Manejo de errores
- Nunca dejar promesas sin catch
- Retry con backoff exponencial en llamadas a IOL (máximo 3 intentos)
- Un error en un activo NO interrumpe el ciclo de los demás

### Base de datos
- Siempre usar repositorios en src/persistence/
- Nunca Prisma Client directamente fuera de prismaClient.js
- Transacciones para múltiples escrituras relacionadas

### Separación de responsabilidades
- Strategy Engine: SOLO genera señales
- Risk Manager: SOLO valida
- Execution Engine: SOLO envía órdenes validadas
- Orchestrator: coordina, sin lógica de negocio

## RESTRICCIÓN ABSOLUTA

### DRY_RUN
executionEngine.js NUNCA envía órdenes reales con DRY_RUN=true.
CERO llamadas a POST /api/v2/operar mientras DRY_RUN=true.

### Estrategias activas
Las dos estrategias activas son buyScoreStrategy y sellTakeProfitStrategy.
myStrategy.js existe como referencia pero NO se usa en el STRATEGY_MAP.
NUNCA modificar myStrategy.js.

### Alertas
whatsappAlert y emailAlert NUNCA lanzan errores que detengan el bot.
Un fallo de alerta se loguea y se ignora.

## Lista de activos operados
```javascript
export const ASSETS = [
  { symbol: 'GGAL',  market: 'bCBA', type: 'accion' },
  { symbol: 'BBAR',  market: 'bCBA', type: 'accion' },
  { symbol: 'PAMP',  market: 'bCBA', type: 'accion' },
  { symbol: 'TGSU2', market: 'bCBA', type: 'accion' },
  { symbol: 'TRAN',  market: 'bCBA', type: 'accion' },
  { symbol: 'YPFD',  market: 'bCBA', type: 'accion' },
]
```
ALUA, TXAR, MIRG, CRES removidos — sin histórico en IOL.
CEDEARs y bonos removidos — sin serie histórica en IOL.

## Endpoints clave de IOL

### Auth
POST https://api.invertironline.com/token
Content-Type: application/x-www-form-urlencoded
Body: username=X&password=Y&grant_type=password
POST https://api.invertironline.com/token
Body: refresh_token=X&grant_type=refresh_token

### Market Data (solo GET)
GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion
GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion/seriehistorica/{desde}/{hasta}/ajustada

### Portfolio (solo GET)
GET /api/v2/portafolio/{pais}
GET /api/v2/estadocuenta

### Órdenes (PROHIBIDO con DRY_RUN=true)
POST /api/v2/operar/Comprar   — PROHIBIDO
POST /api/v2/operar/Vender    — PROHIBIDO
DELETE /api/v2/operaciones/{id} — solo cancelaciones

## Schema de Prisma (no modificar sin instrucción explícita)

```prisma
model Asset {
  id           Int            @id @default(autoincrement())
  symbol       String
  market       String
  type         String
  active       Boolean        @default(true)
  createdAt    DateTime       @default(now()) @map("created_at")
  priceHistory PriceHistory[]
  priceTicks   PriceTick[]
  decisions    Decision[]
  orders       Order[]
  positions    Position[]
  @@unique([symbol, market])
  @@map("assets")
}

model PriceHistory {
  id      Int      @id @default(autoincrement())
  assetId Int      @map("asset_id")
  date    DateTime @db.Date
  open    Decimal
  high    Decimal
  low     Decimal
  close   Decimal
  volume  BigInt?
  source  String   @default("iol")
  asset   Asset    @relation(fields: [assetId], references: [id])
  @@unique([assetId, date])
  @@index([assetId, date])
  @@map("price_history")
}

model PriceTick {
  id         Int      @id @default(autoincrement())
  assetId    Int      @map("asset_id")
  price      Decimal
  open       Decimal?
  high       Decimal?
  low        Decimal?
  volume     BigInt?
  capturedAt DateTime @default(now()) @map("captured_at")
  asset      Asset    @relation(fields: [assetId], references: [id])
  @@index([assetId, capturedAt])
  @@map("price_ticks")
}

model Decision {
  id              Int      @id @default(autoincrement())
  assetId         Int      @map("asset_id")
  signal          String
  strategy        String
  priceAtDecision Decimal  @map("price_at_decision")
  metadata        Json?
  createdAt       DateTime @default(now()) @map("created_at")
  asset           Asset    @relation(fields: [assetId], references: [id])
  orders          Order[]
  @@map("decisions")
}

model Order {
  id          Int       @id @default(autoincrement())
  decisionId  Int?      @map("decision_id")
  assetId     Int       @map("asset_id")
  iolOrderId  String?   @map("iol_order_id")
  side        String
  quantity    Decimal
  price       Decimal
  status      String    @default("pending")
  iolResponse Json?     @map("iol_response")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  asset       Asset     @relation(fields: [assetId], references: [id])
  decision    Decision? @relation(fields: [decisionId], references: [id])
  @@map("orders")
}

model Position {
  id            Int      @id @default(autoincrement())
  assetId       Int      @unique @map("asset_id")
  quantity      Decimal
  avgCost       Decimal  @map("avg_cost")
  currentPrice  Decimal  @map("current_price")
  unrealizedPnl Decimal  @map("unrealized_pnl")
  openedAt      DateTime @map("opened_at")
  updatedAt     DateTime @updatedAt @map("updated_at")
  asset         Asset    @relation(fields: [assetId], references: [id])
  @@map("positions")
}

model BotState {
  id                Int       @id @default(autoincrement())
  capitalTotal      Decimal   @map("capital_total")
  capitalAvailable  Decimal   @map("capital_available")
  realizedPnl       Decimal   @default(0) @map("realized_pnl")
  unrealizedPnl     Decimal   @default(0) @map("unrealized_pnl")
  maxDrawdown       Decimal   @default(0) @map("max_drawdown")
  peakCapital       Decimal   @map("peak_capital")
  totalOperations   Int       @default(0) @map("total_operations")
  winningOperations Int       @default(0) @map("winning_operations")
  lastCycleAt       DateTime? @map("last_cycle_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  @@map("bot_state")
}
```

## Repositorios
- prismaClient.js
- assetRepository.js         — findAll, findBySymbolAndMarket, upsert
- priceHistoryRepository.js  — bulkUpsert, getRange, getLatest, count
- priceTickRepository.js     — insert, getLatest
- decisionRepository.js      — insert, getRecent
- orderRepository.js         — insert, updateStatus, getPending, getByAsset, getRecent
- positionRepository.js      — upsert, findByAsset, findAll
- botStateRepository.js      — get, update

## Variables de entorno requeridas
IOL_USERNAME=
IOL_PASSWORD=
IOL_BASE_URL=https://api.invertironline.com
DATABASE_URL=
DIRECT_URL=
NODE_ENV=development
INITIAL_CAPITAL=
DRY_RUN=true
MARKET_OPEN_HOUR=11
MARKET_CLOSE_HOUR=17
ORPHAN_ORDER_TIMEOUT_MIN=30
ORDER_POLL_INTERVAL_MS=60000
POLL_INTERVAL_MS=300000
RISK_MAX_CAPITAL_PER_TRADE_PCT=10
RISK_MAX_EXPOSURE_PER_ASSET_PCT=20
RISK_MAX_TOTAL_EXPOSURE_PCT=60
RISK_MAX_DRAWDOWN_PCT=15
RISK_MIN_OPERATION_INTERVAL_MINUTES=60
MONITORING_PORT=3001
ALERT_EMAIL_FROM=
ALERT_EMAIL_TO=
ALERT_EMAIL_PASSWORD=
ALERT_ON_ORDER=true
ALERT_DRAWDOWN_PCT=10
DASHBOARD_URL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_WHATSAPP_TO=
BUY_SIGNAL_THRESHOLD=6
BUY_ZSCORE_THRESHOLD=-1.5
BUY_RSI_OVERSOLD=35
BUY_RSI_EXTREME=25
BUY_INTRADAY_WINDOW_HOURS=2
TAKE_PROFIT_PCT=8

## Arquitectura de estrategias

### Algoritmo de VENTA (automático)
Archivo: src/strategy/strategies/sellTakeProfitStrategy.js
- Solo opera activos que están en la tabla positions
- Nunca genera SELL sobre activos sin posición abierta
- Comparación SIEMPRE contra avgCost de la posición:
  precioActual >= avgCost * (1 + TAKE_PROFIT_PCT/100)
- Fuente de precio: último price_tick disponible
- Nunca compara contra precio de ayer ni contra velas anteriores

### Algoritmo de COMPRA (alerta, no ejecuta)
Archivo: src/strategy/strategies/buyScoreStrategy.js
Calculador: src/strategy/buyScoreCalculator.js

Sistema de scoring sobre datos DIARIOS (price_history):
  z-score < -1.5      → 3 puntos
  z-score < -1.0      → 1 punto
  RSI < 35            → 2 puntos
  RSI < 25            → 1 punto extra
  precio <= BB lower  → 2 puntos
  precio < BB middle  → 1 punto
  volumen > media 10d → 1 punto
  Máximo posible: 9 puntos

Filtro duro: si precioActual > SMA50 → score = 0
Filtro intradiario: si precio actual < precio hace 2 horas → posponer
No alerta dos veces el mismo día para el mismo activo.

Confianza = round(score / 9 * 100)%
Umbral mínimo: BUY_SIGNAL_THRESHOLD puntos

### Flujo en el Orchestrator
SELL aprobado → executionEngine.execute() → whatsappAlert SELL_EXECUTED
BUY aprobado  → whatsappAlert BUY_SIGNAL → orderRepository pending_manual
               → NUNCA llama a executionEngine

### Estados de orden
pending          → creada, no enviada
sent             → enviada a IOL
filled           → ejecutada
partial          → ejecutada parcialmente
cancelled        → cancelada
rejected         → rechazada por IOL
dry_run          → simulada con DRY_RUN=true
pending_manual   → BUY que requiere acción manual del usuario

## Fase 2 — Base de datos
Seed: npx prisma db seed
Inserta activos y fila inicial de bot_state con INITIAL_CAPITAL.

## Fase 3 — Strategy Engine
Señales válidas: BUY, SELL, HOLD
HOLD no se persiste ni evalúa.
indicators.js: sma, ema, rsi, bollingerBands, macd — retornan null si datos insuficientes.

## Fase 4 — Risk Manager + histórico
price_history → OHLCV diario para scoring de compra
price_ticks   → precio actual para verificación de take profit

Backfill: node scripts/backfill.js (idempotente)
Daily update: src/orchestrator/dailyUpdater.js (cron 18:00 ARG)
Manual: node scripts/runDailyUpdate.js

Risk Manager: src/risk/riskManager.js
validate(decision, botState, positions, lastOrderByAsset)
→ { approved, reason, quantity }

## Fase 5 — Execution Engine
DRY_RUN=true → loguea "SIMULADA" sin enviar a IOL.
orderBuilder.js → construye JSON de orden
iolOrderClient.js → envía a IOL (solo con DRY_RUN=false)
executionEngine.js → coordina el ciclo completo

## Fase 6 — Orchestrator
Tres schedulers:
1. Ciclo principal (POLL_INTERVAL_MS)
2. Order poller (ORDER_POLL_INTERVAL_MS)
3. Daily updater (cron 18:00 ARG, días hábiles)

isRunning guard evita solapamiento de ciclos.
marketHours.js verifica horario 11:00-17:00 ARG lunes a viernes.

## Fase 7A — Email (Nodemailer)
src/monitoring/emailAlert.js
Eventos: BOT_START, ORDER_FILLED, DRAWDOWN_ALERT, CRITICAL_ERROR, BOT_STOP
Fallo de envío no detiene el bot.

## Fase 7B — Dashboard Vercel
Repo separado. Lee Neon directamente (solo SELECT).
URL: configurada en DASHBOARD_URL.

## Fase Nueva B — Estrategias de corto plazo (PENDIENTE)
Ver sección "Arquitectura de estrategias" arriba.
whatsappAlert: src/monitoring/whatsappAlert.js (Twilio)
Eventos WhatsApp: BUY_SIGNAL (con score y confianza), SELL_EXECUTED

## Fase 7C — Deploy Railway (PENDIENTE)
Bot 24/7 en servidor remoto.
Ver docs/DEPLOY.md cuando esté creado.

## Fase 8 — Producción real (PENDIENTE)
DRY_RUN=false — NUNCA antes de esta fase.
Capital real mínimo definido por el usuario.

## Backtesting
v1: node scripts/runBacktest.js (datos desde 2020)
v2: node scripts/runBacktestV2.js (desde 2022, filtro dólar, min 8 trades)
Resultados en docs/backtest_v2_results.md
Ganador v2: Momentum (referencia, no usado en el bot)
Los resultados del backtesting son material para el dashboard de análisis.

## Estado del proyecto
Ver PROGRESS.md al inicio de cada sesión.

### Cambio pendiente — Opción F: precios en USD (Mayo 2026)
Se agrega soporte para precios en dólares MEP en paralelo a los pesos.

Nueva tabla: exchange_rates
  - date (Date, unique)
  - mep_rate (Float) — precio del dólar MEP ese día
  - source (String) — 'ambito' o 'forward_fill'
  - created_at (DateTime)

Cambio en price_history: nueva columna close_usd (Float, nullable)
  close_usd = close / mep_rate del mismo día
  Nullable porque se llena en el backfill posterior, no en la migración.

IMPORTANTE: usar el mismo workaround de migración que en Fase 1:
  prisma migrate diff --script para generar SQL
  prisma migrate deploy para aplicar
  Nunca usar prisma migrate dev (falla en entorno no-interactivo)


  ### Cambio pendiente — MEP diario automático (Mayo 2026)

El daily updater (src/orchestrator/dailyUpdater.js) debe agregar al
final de su ejecución diaria (después de actualizar price_history):

1. Fetch del MEP del día desde Ámbito:
   GET https://mercados.ambito.com/dolar/mep/historico-general/{hoy}/{hoy}
   donde hoy es DD-MM-YYYY
   Si Ámbito falla o devuelve vacío: usar el último mep_rate de
   exchange_rates como fallback (forward-fill de un día).

2. INSERT en exchange_rates:
   Nuevo archivo: src/persistence/exchangeRateRepository.js
   Función: upsertExchangeRate(date, mepRate, source)
   Usa prisma.exchangeRate.upsert por fecha (unique).

3. UPDATE close_usd en price_history del día:
   Para cada activo, una vez guardado el precio del día:
   close_usd = close / mep_rate
   Agregar función updateCloseUsd(date, mepRate) en
   src/persistence/priceHistoryRepository.js que hace:
   UPDATE price_history SET close_usd = close / mepRate
   WHERE DATE(date) = fecha

Axios ya está disponible en el proyecto para el fetch a Ámbito.
El parseo del valor MEP es igual que en Python:
  valor string '1.245,50' → reemplazar '.' por '' y ',' por '.' → parseFloat