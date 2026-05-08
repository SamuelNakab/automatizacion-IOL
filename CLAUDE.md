# CLAUDE.md — Trading Bot IOL

## Contexto del proyecto
Sistema de trading algorítmico multi-activo integrado con la API de InvertirOnline (IOL).
Node.js + Express + PostgreSQL + Prisma. Opera sobre el mercado argentino de capitales.

## Stack tecnológico
- Runtime: Node.js 20+ con ESModules (import/export, no require)
- HTTP client: Axios
- Base de datos: PostgreSQL vía Prisma ORM
- Logging: Winston (structured JSON logs)
- Config: dotenv
- Testing: Vitest
- Linter: ESLint con reglas estándar

## Estructura de directorios
src/
auth/           # Token manager de IOL (obtención y renovación automática)
market-data/    # Market Data Service (cotizaciones, series históricas)
strategy/       # Strategy Engine (señales por activo)
risk/           # Risk Manager (validación de decisiones)
execution/      # Execution Engine
persistence/    # Repositorios de acceso a DB
orchestrator/   # Scheduler y coordinación del ciclo — Fase 6
monitoring/     # Métricas, alertas, dashboard — Fase 7
shared/         # Types, constantes, utilidades comunes
prisma/
schema.prisma
migrations/
scripts/
docs/
tests/
unit/
integration/

## Reglas críticas de desarrollo

### Variables de entorno
- NUNCA hardcodear credenciales, URLs de API, o configuración sensible
- Toda config va en .env, el código la lee desde process.env
- El archivo .env.example debe existir siempre con las keys necesarias sin valores reales

### Autenticación con IOL
- El bearer token de IOL expira cada 15 minutos
- SIEMPRE usar src/auth/tokenManager.js para obtener headers autenticados
- El token manager renueva automáticamente sin que los llamadores lo sepan
- Nunca llamar a la API de IOL directamente sin pasar por el token manager

### Entorno
- IOL_BASE_URL=https://api.invertironline.com es el único entorno disponible
- DRY_RUN=true debe estar activo en todo momento hasta la Fase 8

### Logging
- Usar Winston en todos los módulos, nunca console.log en código de producción
- Log levels: error, warn, info, debug
- Cada evento relevante del bot DEBE loguearse con contexto (símbolo, precio, decisión, motivo)
- Formato: JSON estructurado con timestamp

### Manejo de errores
- Nunca dejar promesas sin catch
- Los errores de red hacia IOL deben tener retry con backoff exponencial (máximo 3 intentos)
- Un error en un activo NO debe interrumpir el ciclo de otros activos
- Loguear siempre el error completo antes de continuar

### Base de datos
- Usar siempre los repositorios en src/persistence/, nunca Prisma Client directamente
- Toda escritura de decisión u orden DEBE ser persistida antes de ejecutarse
- Usar transacciones Prisma cuando hay múltiples escrituras relacionadas

### Separación de responsabilidades (CRÍTICO)
- El Strategy Engine SOLO genera señales. No ejecuta, no persiste, no llama a IOL.
- El Risk Manager SOLO valida. No ejecuta, no genera señales.
- El Execution Engine SOLO envía órdenes ya validadas. No decide nada.
- El Orchestrator coordina el flujo. No contiene lógica de negocio.

## RESTRICCIÓN ABSOLUTA — Execution Engine y estrategia

### Execution Engine
El archivo src/execution/executionEngine.js bajo ningún concepto puede
enviar órdenes reales a IOL mientras DRY_RUN=true.
Si DRY_RUN=true → loguear la orden como "SIMULADA" y retornar sin llamar a IOL.
CERO llamadas a POST /api/v2/operar/Comprar o POST /api/v2/operar/Vender
mientras DRY_RUN=true.

### Estrategia personalizada
src/strategy/strategies/myStrategy.js es el archivo donde el usuario
escribirá su lógica de trading. El método evaluate() actualmente retorna
SIGNALS.HOLD y debe mantenerse así hasta que el usuario lo modifique
explícitamente. NUNCA modificar myStrategy.js salvo que el usuario lo pida.

## Activos iniciales
```javascript
const ASSETS = [
  { symbol: 'GGAL', market: 'bCBA', type: 'accion' },
  { symbol: 'YPFD', market: 'bCBA', type: 'accion' },
  { symbol: 'GD35', market: 'bCBA', type: 'bono'   },
]
```

## Endpoints clave de IOL

### Auth
POST https://api.invertironline.com/token
Content-Type: application/x-www-form-urlencoded
Body: username=X&password=Y&grant_type=password
POST https://api.invertironline.com/token
Body: refresh_token=X&grant_type=refresh_token

### Market Data (solo GET — lectura)
GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion
GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion/seriehistorica/{fechaDesde}/{fechaHasta}/ajustada

### Portfolio (solo GET — lectura)
GET /api/v2/portafolio/{pais}
GET /api/v2/estadocuenta

### Órdenes (PROHIBIDO con DRY_RUN=true)
POST /api/v2/operar/Comprar   — PROHIBIDO mientras DRY_RUN=true
POST /api/v2/operar/Vender    — PROHIBIDO mientras DRY_RUN=true
DELETE /api/v2/operaciones/{id} — solo para cancelaciones, con precaución

## Schema de Prisma (fuente de verdad — no modificar sin instrucción explícita)

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
  id          Int      @id @default(autoincrement())
  decisionId  Int?     @map("decision_id")
  assetId     Int      @map("asset_id")
  iolOrderId  String?  @map("iol_order_id")
  side        String
  quantity    Decimal
  price       Decimal
  status      String   @default("pending")
  iolResponse Json?    @map("iol_response")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  asset       Asset    @relation(fields: [assetId], references: [id])
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

## Repositorios (patrón obligatorio)
Cada tabla tiene su propio archivo en src/persistence/.
Los módulos de negocio nunca importan PrismaClient directamente.

- prismaClient.js          — singleton del PrismaClient
- assetRepository.js       — findAll, findBySymbolAndMarket, upsert
- priceHistoryRepository.js — bulkUpsert, getRange, getLatest, count
- priceTickRepository.js   — insert, getLatest
- decisionRepository.js    — insert, getRecent
- orderRepository.js       — insert, updateStatus, getPending, getByAsset
- positionRepository.js    — upsert, findByAsset, findAll
- botStateRepository.js    — get, update

## Variables de entorno requeridas
IOL_USERNAME=              # Email de cuenta IOL
IOL_PASSWORD=              # Contraseña de cuenta IOL
IOL_BASE_URL=https://api.invertironline.com
DATABASE_URL=              # postgresql://user:pass@host:5432/dbname
INITIAL_CAPITAL=           # Capital inicial en pesos para bot_state
NODE_ENV=development
POLL_INTERVAL_MS=30000
DRY_RUN=true               # NUNCA cambiar a false hasta Fase 8
Risk Manager (opcionales, tienen defaults)
RISK_MAX_CAPITAL_PER_TRADE_PCT=10
RISK_MAX_EXPOSURE_PER_ASSET_PCT=20
RISK_MAX_TOTAL_EXPOSURE_PCT=60
RISK_MAX_DRAWDOWN_PCT=15
RISK_MIN_OPERATION_INTERVAL_MINUTES=60

## Fase 2 — Base de datos

### Seed inicial
prisma/seed.js inserta los 3 activos y crea la fila inicial de bot_state
con INITIAL_CAPITAL del .env. Correr con: npx prisma db seed

### Repositorios
Ver lista completa en la sección "Repositorios" arriba.
Cada repositorio importa solo prismaClient.js.

## Fase 3 — Strategy Engine

### Arquitectura
Cada estrategia extiende BaseStrategy e implementa evaluate().
Una instancia por activo. strategyEngine.runCycle() coordina todo.

### Señales válidas
- 'BUY'  → evaluada por el Risk Manager
- 'SELL' → evaluada por el Risk Manager
- 'HOLD' → no se persiste, no se evalúa

### Indicadores disponibles en indicators.js
- sma(prices, period)
- ema(prices, period)
- rsi(prices, period)
- bollingerBands(prices, period, stdDev)
- macd(prices, fast, slow, signal)
Todas retornan null si no hay datos suficientes.

### Archivo reservado para estrategia personalizada
src/strategy/strategies/myStrategy.js — evaluate() retorna SIGNALS.HOLD.
NUNCA modificar este archivo salvo instrucción explícita del usuario.

### STRATEGY_MAP en strategyEngine.js
Define qué estrategia usa cada activo.
Para cambiar la estrategia de un activo, solo modificar este mapa.

## Fase 4 — Risk Manager + datos históricos

### Tablas de precios (dos granularidades separadas)
price_history → OHLCV diario, cargado via backfill, para modelos y backtesting
price_ticks   → cotizaciones en tiempo real del polling, para señales inmediatas

### Script de backfill
scripts/backfill.js — correr UNA SOLA VEZ.
Carga hasta 5 años de histórico diario por activo via IOL.
Usa bulkUpsert en chunks de 100 para evitar timeouts de Prisma.
Resultado actual: GGAL 1217 barras, YPFD 1217 barras, GD35 0 barras.

### Risk Manager
src/risk/riskManager.js — clase pura, sin DB, sin IOL.
Método principal: validate(decision, botState, positions, lastOrderByAsset)
Retorna: { approved: boolean, reason: string, quantity?: number }

Reglas en cascada (primera que falla rechaza):
1. MAX_DRAWDOWN_PCT: si drawdown supera el límite, solo SELL
2. MIN_OPERATION_INTERVAL_MINUTES: tiempo mínimo entre ops del mismo activo
3. Capital insuficiente para comprar al menos 1 unidad
4. MAX_EXPOSURE_PER_ASSET_PCT: exposición máxima por activo (solo BUY)
5. MAX_TOTAL_EXPOSURE_PCT: exposición total del portafolio (solo BUY)

Configuración en src/shared/riskConfig.js, leída desde process.env.

## Fase 5 — Execution Engine

### Restricción DRY_RUN
DRY_RUN=true en .env es obligatorio hasta la Fase 8.
executionEngine.js verifica esta variable antes de cualquier envío.
Si DRY_RUN=true → loguea la orden como "SIMULADA [DRY_RUN]" y retorna.
iolOrderClient.js NUNCA es llamado con DRY_RUN=true.

### Módulos del Execution Engine
src/execution/orderBuilder.js     — construye el JSON de orden para IOL (puro, sin efectos)
src/execution/iolOrderClient.js   — wrapper Axios para endpoints de órdenes
src/execution/executionEngine.js  — coordina el ciclo completo de una orden

### Método principal
executionEngine.execute(approvedDecision)
approvedDecision = { assetId, signal, priceAtDecision, quantity, asset: { symbol, market } }
Retorna: { success: bool, orderId, status, reason }

### Estados de orden
pending   → creada en DB, no enviada
sent      → enviada a IOL
filled    → ejecutada por el mercado
partial   → ejecutada parcialmente
cancelled → cancelada
rejected  → rechazada por IOL
dry_run   → simulada por DRY_RUN=true

### Actualización de posiciones y bot_state
La actualización después de una orden filled es responsabilidad
del Orchestrator (Fase 6), no del Execution Engine.

### Estructura de orden para IOL
{
  mercado:  "bCBA",
  simbolo:  "GGAL",
  cantidad: 10,
  precio:   1250.50,
  plazo:    "t2",
  validez:  "HOY"
}

### Documentación del código
docs/archivos.md  — descripción de cada archivo .js del proyecto
docs/funciones.md — descripción de cada función pública

## Estado actual del proyecto
Ver PROGRESS.md para el detalle de cada fase completada.
Leer PROGRESS.md antes de cualquier otra cosa al iniciar una sesión.