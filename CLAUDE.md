markdown# CLAUDE.md — Trading Bot IOL

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
orchestrator/   # Scheduler y coordinación del ciclo
monitoring/     # Métricas, alertas, dashboard
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
src/strategy/strategies/myStrategy.js es el archivo donde se implementará
la estrategia ganadora del backtesting. El método evaluate() actualmente
retorna SIGNALS.HOLD y debe mantenerse así hasta la Fase Nueva B.
NUNCA modificar myStrategy.js salvo instrucción explícita.

### Lógica de ejecución por tipo de señal
Cuando la estrategia esté implementada (Fase Nueva B):
- Señal SELL → el bot ejecuta la venta automáticamente via Execution Engine
- Señal BUY  → el bot NO ejecuta. Envía alerta por email al usuario y registra
  la decisión como 'pending_manual'. El usuario decide si comprar según fondos disponibles.

## Lista de activos operados
```javascriptexport const ASSETS = [
{ symbol: 'GGAL',  market: 'bCBA', type: 'accion' },
{ symbol: 'BBAR',  market: 'bCBA', type: 'accion' },
{ symbol: 'PAMP',  market: 'bCBA', type: 'accion' },
{ symbol: 'TGSU2', market: 'bCBA', type: 'accion' },
{ symbol: 'TRAN',  market: 'bCBA', type: 'accion' },
{ symbol: 'YPFD',  market: 'bCBA', type: 'accion' },
{ symbol: 'ALUA',  market: 'bCBA', type: 'accion' },
{ symbol: 'TXAR',  market: 'bCBA', type: 'accion' },
{ symbol: 'MIRG',  market: 'bCBA', type: 'accion' },
{ symbol: 'CRES',  market: 'bCBA', type: 'accion' },
]

---
```
CEDEARs y bonos removidos hasta contar con fuente de histórico alternativa.
Todos los activos son acciones locales del panel BYMA con histórico disponible en IOL.
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

## Repositorios (patrón obligatorio)
Cada tabla tiene su propio archivo en src/persistence/.
Los módulos de negocio nunca importan PrismaClient directamente.

- prismaClient.js            — singleton del PrismaClient
- assetRepository.js         — findAll, findBySymbolAndMarket, upsert
- priceHistoryRepository.js  — bulkUpsert, getRange, getLatest, count
- priceTickRepository.js     — insert, getLatest
- decisionRepository.js      — insert, getRecent
- orderRepository.js         — insert, updateStatus, getPending, getByAsset
- positionRepository.js      — upsert, findByAsset, findAll
- botStateRepository.js      — get, update

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
Mercado
MARKET_OPEN_HOUR=10
MARKET_CLOSE_HOUR=17
ORPHAN_ORDER_TIMEOUT_MIN=30
ORDER_POLL_INTERVAL_MS=60000
Monitoring HTTP
MONITORING_PORT=3001
Alertas email
ALERT_EMAIL_FROM=
ALERT_EMAIL_TO=
ALERT_EMAIL_PASSWORD=
ALERT_ON_ORDER=true
ALERT_DRAWDOWN_PCT=10
Dashboard
DASHBOARD_URL=

## Fase 2 — Base de datos

### Seed inicial
prisma/seed.js inserta los activos y crea la fila inicial de bot_state
con INITIAL_CAPITAL del .env. Correr con: npx prisma db seed

### Repositorios
Ver lista completa en la sección "Repositorios" arriba.
Cada repositorio importa solo prismaClient.js.

## Fase 3 — Strategy Engine

### Arquitectura
Cada estrategia extiende BaseStrategy e implementa evaluate().
Una instancia por activo. strategyEngine.runCycle() coordina todo.

### Señales válidas
- 'BUY'  → evaluada por el Risk Manager. En Fase Nueva B: dispara email, no ejecuta.
- 'SELL' → evaluada por el Risk Manager. En Fase Nueva B: se ejecuta automáticamente.
- 'HOLD' → no se persiste, no se evalúa.

### Indicadores disponibles en indicators.js
- sma(prices, period)
- ema(prices, period)
- rsi(prices, period)
- bollingerBands(prices, period, stdDev)
- macd(prices, fast, slow, signal)
Todas retornan null si no hay datos suficientes.

### Archivo reservado para estrategia personalizada
src/strategy/strategies/myStrategy.js — evaluate() retorna SIGNALS.HOLD.
Se implementará en Fase Nueva B con el algoritmo ganador del backtesting.
NUNCA modificar este archivo salvo instrucción explícita.

### STRATEGY_MAP en strategyEngine.js
Define qué estrategia usa cada activo.
Para cambiar la estrategia de un activo, solo modificar este mapa.

## Fase 4 — Risk Manager + datos históricos

### Tablas de precios (dos granularidades separadas)
price_history → OHLCV diario, cargado via backfill, para modelos y backtesting
price_ticks   → cotizaciones en tiempo real del polling, para señales inmediatas

### Script de backfill
scripts/backfill.js — idempotente (upsert por fecha), se puede correr N veces.
Carga hasta 5 años de histórico diario por activo via IOL.
Usa bulkUpsert en chunks de 100 para evitar timeouts de Prisma.

### Job diario de actualización
src/orchestrator/dailyUpdater.js — corre a las 18:00 ARG días hábiles.
Pide últimos 7 días a IOL para cada activo y hace upsert en price_history.
Se activa via node-cron en el Orchestrator.
También ejecutable manualmente: node scripts/runDailyUpdate.js

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
src/execution/orderBuilder.js     — construye el JSON de orden para IOL (puro)
src/execution/iolOrderClient.js   — wrapper Axios para endpoints de órdenes
src/execution/executionEngine.js  — coordina el ciclo completo de una orden

### Método principal
executionEngine.execute(approvedDecision)
approvedDecision = { assetId, signal, priceAtDecision, quantity, asset: { symbol, market } }
Retorna: { success: bool, orderId, status, reason }

### Estados de orden
pending          → creada en DB, no enviada
sent             → enviada a IOL
filled           → ejecutada por el mercado
partial          → ejecutada parcialmente
cancelled        → cancelada
rejected         → rechazada por IOL
dry_run          → simulada por DRY_RUN=true
pending_manual   → BUY que requiere acción manual del usuario (Fase Nueva B)

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

## Fase 6 — Orchestrator

### Responsabilidades
El Orchestrator es el único punto de entrada para la ejecución automática.
Coordina el flujo completo sin contener lógica de negocio propia.
Tres schedulers: ciclo principal, order poller, daily updater (cron 18:00 ARG).

### Ciclo principal
1. Verificar horario de mercado (10:00-17:00 ARG, lunes a viernes)
2. Obtener cotizaciones via marketDataService
3. Persistir ticks via priceTickRepository
4. Correr strategyEngine.runCycle()
5. Para cada señal BUY o SELL:
   a. riskManager.validate()
   b. Si approved: executionEngine.execute()
6. Actualizar bot_state.lastCycleAt
7. Loguear resumen del ciclo

### Prevención de solapamiento
Flag booleano isRunning. Si el ciclo anterior no terminó, el nuevo se saltea.

### Transacción al confirmar orden filled
prisma.$transaction actualiza simultáneamente orders, positions y bot_state.
Si falla: loguear y NO reintentar automáticamente.

### Detección de órdenes huérfanas
Al arrancar: buscar órdenes pending/sent de más de ORPHAN_ORDER_TIMEOUT_MIN.
Consultar estado real en IOL y actualizar en DB.

### Horario de mercado
Timezone: America/Argentina/Buenos_Aires
Apertura: MARKET_OPEN_HOUR (default 10)
Cierre: MARKET_CLOSE_HOUR (default 17)
Fuera de horario: acumular ticks, no ejecutar pipeline de señales.

## Fase 7A — Alertas por email con Nodemailer

### Módulo principal
src/monitoring/emailAlert.js — singleton Nodemailer con Gmail + app password.
Si faltan variables: isConfigured=false, advertencia en log, bot sigue.
Un error de envío NUNCA detiene el bot.

### Eventos que disparan alerta
- BOT_START: configuración activa + link al dashboard
- ORDER_FILLED: símbolo, lado, cantidad, precio, PnL
- DRAWDOWN_ALERT: drawdown actual vs límite
- CRITICAL_ERROR: mensaje + contexto
- BOT_STOP: motivo de detención
- BUY_MANUAL_REQUIRED (Fase Nueva B): aviso de oportunidad de compra
  con símbolo, precio sugerido, cantidad sugerida, y link al dashboard

### Integración con Orchestrator
emailAlert inyectado como dependencia en el constructor del Orchestrator.

## Preparación Fase Nueva A — Activos y datos históricos

### Activos activos en el sistema
16 activos definidos en src/shared/assets.js (ver sección "Lista de activos").
GGAL marcado como active=false en DB — no se procesa.

### Job diario
src/orchestrator/dailyUpdater.js actualiza price_history a las 18:00 ARG.
Ejecutable manualmente: node scripts/runDailyUpdate.js

### Backfill
scripts/backfill.js es idempotente. Correrlo cada vez que se agreguen activos nuevos.

## Fase Nueva A — Backtesting (PENDIENTE)

### Objetivo
Comparar los 5 algoritmos sobre los datos históricos de todos los activos
y determinar el ganador para implementar en myStrategy.js.

### Los 5 algoritmos a evaluar
1. RSI Mean Reversion — RSI + z-score
2. Momentum / Relative Strength — retorno acumulado en ventana temporal
3. Bollinger Bands Mean Reversion — precio vs bandas superior/inferior
4. Moving Average Crossover — cruce de medias móviles corta y larga
5. Volatility Breakout (ATR) — ruptura de rango con aumento de volatilidad

### Métricas de evaluación por algoritmo
- Retorno total %
- Win rate (operaciones ganadoras / total)
- Máximo drawdown
- Cantidad de operaciones generadas
- Sharpe ratio simplificado

### Output esperado
Tabla comparativa de los 5 algoritmos por activo y consolidada.
Declaración del algoritmo ganador con justificación numérica.
El usuario revisa y confirma el ganador antes de implementarlo.

### Script
scripts/runBacktest.js — standalone, no modifica DB, solo lee price_history.
Lee datos de todos los activos con barras suficientes (mínimo 50).
Imprime resultados en consola y genera docs/backtest_results.md.

## Fase Nueva B — Implementar algoritmo ganador (PENDIENTE)

### Qué se hace
1. Implementar el algoritmo ganador en src/strategy/strategies/myStrategy.js
2. Modificar executionEngine.js para que BUY dispare email en lugar de ejecutar
3. Agregar estado 'pending_manual' en el flujo de órdenes
4. Agregar alerta 'BUY_MANUAL_REQUIRED' en emailAlert.js

### Lógica de ejecución
SELL → executionEngine.execute() → orden real a IOL (con DRY_RUN=false en Fase 8)
BUY  → emailAlert.sendAlert('BUY_MANUAL_REQUIRED') → orden registrada como 'pending_manual'
       El usuario decide si ejecuta la compra según fondos disponibles.

## Fase 7C — Deploy en Railway (PENDIENTE)
Bot corriendo 24/7 en servidor remoto.
Variables de entorno configuradas en Railway dashboard.
Restart automático ante fallos.

## Fase 8 — Producción real (PENDIENTE)
DRY_RUN=false — NUNCA cambiar antes de esta fase.
Capital mínimo real.
Monitoreo manual las primeras semanas.
BotState actualizado con capital real antes de arrancar.

## Estado del proyecto
Ver PROGRESS.md para el detalle de cada fase completada.
Leer PROGRESS.md antes de cualquier otra cosa al iniciar una sesión.

## Backtesting v2 — Con filtros de calidad (PENDIENTE correr)

### Cambios respecto al backtesting v1
1. Fecha de inicio: 01/01/2022 (excluye pandemia 2020-2021)
2. Mínimo de operaciones: 8 trades completos por simulación
   Si un algoritmo genera menos de 8 trades en el período → descartado
3. Benchmark de dólar MEP: una estrategia debe superar la apreciación
   del dólar MEP en el mismo período para ser considerada válida
4. Benchmark calculado con el ticker GD30 (Global 2030) que IOL
   sí tiene histórico — precio en pesos / precio en dólares
   Si no está disponible, usar tipo de cambio oficial desde BCRA
   como piso mínimo del benchmark

### Métricas adicionales v2
- Retorno vs dólar: retornoEstrategia% - apreciacionDolar%
  Si negativo: la estrategia no le ganó al dólar → marcada como inválida
- Alpha: exceso de retorno sobre el benchmark dólar
- Solo algoritmos con alpha > 0 Y trades >= 8 son candidatos al ganador

### Script
scripts/runBacktestV2.js — reemplaza a runBacktest.js para la decisión final
Lee price_history desde 2022-01-01 en adelante para cada activo.
Obtiene cotización del dólar MEP del período via IOL o BCRA API.
Genera docs/backtest_v2_results.md con resultados filtrados.