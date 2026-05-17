# Mapa de archivos del proyecto

---

## src/backtest/ (Fase Nueva A)

### indicators.js
**Propósito:** Funciones puras de cálculo técnico para el backtesting. Copia standalone de las funciones de `src/strategy/indicators.js`, más `atr()`. Sin dependencias externas ni efectos secundarios.
**Exporta:** `sma`, `ema`, `rsi`, `bollingerBands`, `atr` (named exports)
**Usado por:** `src/backtest/algorithms.js`
**Depende de:** (ninguno)

### algorithms.js
**Propósito:** Los 5 algoritmos de backtesting como funciones puras. Cada uno recibe `bars[]` y `params{}`, retorna `signals[]` con acciones BUY/SELL. Garantiza que no haya dos BUY ni dos SELL consecutivos.
**Exporta:** `rsiMeanReversion`, `momentum`, `bollingerReversion`, `maCrossover`, `atrBreakout` (named exports)
**Usado por:** `scripts/runBacktest.js`, `src/backtest/backtestV2Runner.js`
**Depende de:** `src/backtest/indicators.js`

### simulator.js
**Propósito:** Simula el PnL de un array de señales sobre datos históricos reales. Usa 95% del capital disponible por operación. Cierra posición abierta al final al último precio.
**Exporta:** `simulate(signals, bars, initialCapital)`, `calcMetrics(trades, initialCapital, finalCapital)` (named exports)
**Usado por:** `scripts/runBacktest.js`, `src/backtest/backtestV2Runner.js`
**Depende de:** (ninguno)

### dollarBenchmark.js
**Propósito:** Obtiene la apreciación del dólar MEP/oficial en el período de backtesting. Cascada de 3 fuentes: GD30 en DB → API BCRA → fallback hardcodeado (~1043%). Nunca lanza excepción — siempre retorna un resultado.
**Exporta:** `getDollarAppreciation(fromDate, toDate)` (named export, async)
**Usado por:** `src/backtest/backtestV2Runner.js`
**Depende de:** `axios`, `src/persistence/prismaClient.js`, `src/shared/logger.js`

### backtestV2Runner.js
**Propósito:** Lógica del backtesting V2. Aplica dos filtros de calidad: mínimo MIN_TRADES=8 operaciones y retorno superior al dólar (alpha > 0). Exporta funciones puras `evaluateValidity`, `buildConsolidatedTable` y `declareWinner` para ser testeables independientemente.
**Exporta:** `runBacktestV2()`, `buildConsolidatedTable(results)`, `declareWinner(consolidatedResults)`, `evaluateValidity(totalTrades, totalReturn, dollarAppreciation)`, `ALGORITHMS`, `BACKTEST_FROM_DATE`, `MIN_TRADES` (named exports)
**Usado por:** `scripts/runBacktestV2.js`
**Depende de:** `src/persistence/assetRepository.js`, `src/persistence/priceHistoryRepository.js`, `src/backtest/dollarBenchmark.js`, `src/backtest/algorithms.js`, `src/backtest/simulator.js`, `src/shared/logger.js`

---

## scripts/ (Fase Nueva A)

### runBacktest.js
**Propósito:** Script standalone de backtesting V1. Lee price_history de todos los activos activos, corre los 5 algoritmos con parámetros default, muestra tabla comparativa en consola y genera `docs/backtest_results.md`. No modifica DB ni llama a IOL.
**Exporta:** (script, no exporta)
**Depende de:** `src/backtest/algorithms.js`, `src/backtest/simulator.js`, `src/persistence/assetRepository.js`, `src/persistence/priceHistoryRepository.js`, `src/persistence/prismaClient.js`, `dotenv/config`

### runBacktestV2.js
**Propósito:** Script standalone de backtesting V2. Extiende V1 con benchmark de dólar y filtros: mínimo 8 trades y superar la apreciación del dólar. Muestra columna "vs Dólar" en tablas y lista algoritmos descalificados. Genera `docs/backtest_v2_results.md`.
**Exporta:** (script, no exporta)
**Depende de:** `src/backtest/backtestV2Runner.js`, `src/persistence/prismaClient.js`, `dotenv/config`

---

## src/monitoring/ (Fase 7A + Fase Nueva B)

### whatsappAlert.js
**Propósito:** Singleton de alertas por WhatsApp via Twilio. Se auto-configura al importar con las 4 variables TWILIO_*. Si alguna falta, desactiva alertas silenciosamente. Un fallo de envío se loguea y se ignora — nunca detiene el bot.
**Exporta:** `sendAlert(type, data)` (named export, async)
**Usado por:** `src/orchestrator/orchestrator.js`, `scripts/startBot.js`
**Depende de:** `twilio`, `src/shared/logger.js`, `process.env`

---

## src/strategy/ (Fase Nueva B)

### buyScoreCalculator.js
**Propósito:** Función pura de scoring de oportunidades de compra. Aplica 4 criterios: z-score (3 pts), RSI (2-3 pts), Bollinger Bands (1-2 pts), volumen (1 pt). Filtro duro: si precio > SMA50 retorna score=0 bloqueado. Máximo posible: 9 puntos.
**Exporta:** `calculateBuyScore(bars, currentPrice)`, `stdDev(arr)` (named exports)
**Usado por:** `src/strategy/strategies/buyScoreStrategy.js`
**Depende de:** `src/strategy/indicators.js`

### strategies/buyScoreStrategy.js
**Propósito:** Estrategia de detección de oportunidades de compra. Combina el scoring diario de buyScoreCalculator con confirmación intradiaria (precio no bajando) y deduplicación por día. NUNCA llama a executionEngine — genera BUY solo como alerta.
**Exporta:** `default class BuyScoreStrategy extends BaseStrategy`
**Usado por:** `src/strategy/strategyEngine.js`
**Depende de:** `src/strategy/baseStrategy.js`, `src/strategy/buyScoreCalculator.js`, `src/persistence/priceHistoryRepository.js`, `src/shared/constants.js`, `src/shared/logger.js`

### strategies/sellTakeProfitStrategy.js
**Propósito:** Estrategia de venta automática por take profit. Compara precio actual vs avgCost de la posición abierta. Si precioActual >= avgCost × (1 + TAKE_PROFIT_PCT/100) → SELL. Si no hay posición: siempre HOLD. NUNCA compara contra precio anterior o velas.
**Exporta:** `default class SellTakeProfitStrategy extends BaseStrategy`
**Usado por:** `src/strategy/strategyEngine.js`
**Depende de:** `src/strategy/baseStrategy.js`, `src/persistence/positionRepository.js`, `src/shared/constants.js`, `src/shared/logger.js`

---

## src/monitoring/ (Fase 7A)

### emailAlert.js
**Propósito:** Singleton de alertas por email via Nodemailer + Gmail app password. Se auto-configura al importar: si ALERT_EMAIL_FROM/TO/PASSWORD están presentes crea el transporter; de lo contrario loguea advertencia y desactiva alertas. Un fallo de envío nunca detiene el bot — se loguea y se ignora. Soporta 5 tipos de evento: BOT_START, ORDER_FILLED, DRAWDOWN_ALERT, CRITICAL_ERROR, BOT_STOP.
**Exporta:** `sendAlert(type, data)` (named export, async)
**Usado por:** `src/orchestrator/orchestrator.js`, `scripts/testEmail.js`
**Depende de:** `nodemailer`, `src/shared/logger.js`, `process.env`

---

## scripts/ (nuevos en Fase 7A)

### testEmail.js
**Propósito:** Script de verificación manual. Envía un email de prueba BOT_START a la dirección configurada en ALERT_EMAIL_TO. Ejecutar una vez antes de arrancar el bot para confirmar que las credenciales Gmail son correctas.
**Exporta:** (script, no exporta)
**Depende de:** `src/monitoring/emailAlert.js`, `src/shared/logger.js`, `dotenv/config`

---

## src/shared/ (nuevos en Fase 6)

### marketHours.js
**Propósito:** Módulo puro para verificar horario del mercado argentino usando `date-fns-tz`. Determina si es momento hábil para operar (lunes-viernes, entre MARKET_OPEN_HOUR y MARKET_CLOSE_HOUR en America/Argentina/Buenos_Aires).
**Exporta:** `isMarketOpen()`, `getNextOpenTime()`, `formatMarketStatus()` (named exports)
**Usado por:** `src/orchestrator/orchestrator.js`
**Depende de:** `date-fns-tz`, `process.env`

---

## src/orchestrator/

### positionUpdater.js
**Propósito:** Actualiza positions y bot_state cuando una orden es confirmada como filled. Usa `prisma.$transaction` para garantizar atomicidad. También recalcula unrealizedPnl en tiempo real (sin transacción).
**Exporta:** `confirmOrderFilled(order, filledQty, filledPrice)`, `updateUnrealizedPnl(currentPrices)` (named exports)
**Usado por:** `src/orchestrator/orderPoller.js`, `src/orchestrator/orchestrator.js`
**Depende de:** `src/persistence/prismaClient.js`, `src/persistence/positionRepository.js`, `src/persistence/botStateRepository.js`, `src/shared/logger.js`

### orderPoller.js
**Propósito:** Consulta el estado de órdenes enviadas a IOL. Resuelve órdenes en status 'sent' que ya fueron ejecutadas/canceladas. También detecta y resuelve órdenes huérfanas al arrancar el bot.
**Exporta:** `pollPendingOrders()`, `resolveOrphanOrders()` (named exports)
**Usado por:** `src/orchestrator/orchestrator.js`
**Depende de:** `src/persistence/orderRepository.js`, `src/execution/iolOrderClient.js`, `src/orchestrator/positionUpdater.js`, `src/shared/logger.js`

### orchestrator.js
**Propósito:** Punto de entrada de la automatización. Coordina el ciclo completo: cotizaciones → strategy → risk → execution. Maneja el scheduler con `setInterval`, previene solapamiento de ciclos con `isRunning`, y gestiona el order poller. No contiene lógica de negocio propia.
**Exporta:** `default class Orchestrator`
**Usado por:** `scripts/startBot.js`
**Depende de:** todas las capas (market-data, strategy, risk, execution, persistence, orchestrator sub-módulos)

---

## scripts/ (nuevos en Fase 6)

### startBot.js
**Propósito:** Punto de entrada principal del bot. Verifica DRY_RUN=true (aborta si no está), loguea la configuración activa (sin credenciales), instancia el Orchestrator con todas sus dependencias, y llama `orchestrator.start()`. Ejecutar con `npm start`.
**Exporta:** (script, no exporta)
**Depende de:** `src/orchestrator/orchestrator.js` y todas sus dependencias, `dotenv/config`

---

## src/auth/

### tokenManager.js
**Propósito:** Singleton que gestiona el ciclo de vida del bearer token de IOL. Obtiene un token nuevo con credenciales y lo renueva automáticamente via refresh_token cada 12 minutos (antes de que expire a los 15).
**Exporta:** `getAuthHeaders()` (named export)
**Usado por:** `src/market-data/iolClient.js`, `src/execution/iolOrderClient.js`
**Depende de:** `axios`, `src/shared/logger.js`, `process.env`

---

## src/market-data/

### iolClient.js
**Propósito:** Wrapper de Axios para peticiones GET a la API de IOL. Implementa retry con backoff exponencial (3 intentos: 1s, 2s, 4s). Toda comunicación de lectura con IOL pasa por aquí.
**Exporta:** `get(endpoint)` (named export)
**Usado por:** `src/market-data/marketDataService.js`
**Depende de:** `axios`, `src/auth/tokenManager.js`, `src/shared/logger.js`, `process.env`

### marketDataService.js
**Propósito:** Servicio de alto nivel para obtener cotizaciones e historial de IOL. Normaliza la respuesta a un formato estándar `{ symbol, market, price, open, high, low, volume, timestamp }` independientemente del formato que devuelva IOL.
**Exporta:** `getQuote(symbol, market)`, `getHistoricalSeries(symbol, market, fromDate, toDate)` (named exports)
**Usado por:** `scripts/fetchQuotes.js`, `scripts/backfill.js`
**Depende de:** `src/market-data/iolClient.js`, `src/shared/logger.js`

---

## src/strategy/

### indicators.js
**Propósito:** Librería de indicadores técnicos como funciones puras. No tiene efectos secundarios ni dependencias externas. Retorna `null` cuando el array de precios es insuficiente para el período requerido.
**Exporta:** `sma`, `ema`, `rsi`, `bollingerBands`, `macd` (named exports)
**Usado por:** `src/strategy/baseStrategy.js`
**Depende de:** (ninguno)

### baseStrategy.js
**Propósito:** Clase base abstracta para todas las estrategias. Implementa `computeIndicators()` y `run()` (el flujo de orquestación). Define `evaluate()` como método abstracto que cada subclase debe implementar.
**Exporta:** `default class BaseStrategy`
**Usado por:** `src/strategy/strategies/smaCrossover.js`, `src/strategy/strategies/myStrategy.js`
**Depende de:** `src/strategy/indicators.js`, `src/shared/constants.js`

### strategyEngine.js
**Propósito:** Coordinador del ciclo de estrategia. Mantiene un STRATEGY_MAP que define qué estrategia usa cada activo, cachea instancias por activo, y ejecuta `runCycle()` sobre todos los activos activos en DB. Persiste señales BUY/SELL en `decisions`.
**Exporta:** `runCycle()` (named export)
**Usado por:** `scripts/runStrategy.js`, `scripts/runWithRisk.js`, `scripts/runPipeline.js`
**Depende de:** `src/persistence/assetRepository.js`, `src/persistence/priceTickRepository.js`, `src/persistence/decisionRepository.js`, `src/shared/logger.js`, `src/shared/constants.js`, `src/strategy/strategies/smaCrossover.js`

### strategies/smaCrossover.js
**Propósito:** Estrategia de cruce de medias móviles (SMA20 vs SMA50). BUY cuando sma20 > sma50, SELL cuando sma20 < sma50, HOLD si los indicadores son null (datos insuficientes) o iguales.
**Exporta:** `default class SmaCrossover extends BaseStrategy`
**Usado por:** `src/strategy/strategyEngine.js`
**Depende de:** `src/strategy/baseStrategy.js`, `src/shared/constants.js`

### strategies/myStrategy.js
**Propósito:** Archivo reservado para la estrategia personalizada del usuario. Contiene solo el esqueleto con `evaluate()` retornando `SIGNALS.HOLD`. El usuario implementa su lógica únicamente en `evaluate()`.
**Exporta:** `default class MyStrategy extends BaseStrategy`
**Usado por:** `src/strategy/strategyEngine.js` (cuando se configura en STRATEGY_MAP)
**Depende de:** `src/strategy/baseStrategy.js`, `src/shared/constants.js`

---

## src/risk/

### riskManager.js
**Propósito:** Clase pura que valida decisiones contra 5 reglas de riesgo en cascada. No hace queries a DB ni llama a IOL — recibe todo como parámetros. Esto lo hace 100% testeable sin mocks de Prisma.
**Exporta:** `default class RiskManager`
**Usado por:** `scripts/runWithRisk.js`, `scripts/runPipeline.js`
**Depende de:** `src/shared/riskConfig.js`

---

## src/execution/

### orderBuilder.js
**Propósito:** Módulo puro que construye el objeto de orden en el formato que espera la API de IOL. Valida los inputs y lanza Error si alguno es inválido. Sin efectos secundarios.
**Exporta:** `buildBuyOrder(symbol, market, quantity, price, plazo?)`, `buildSellOrder(symbol, market, quantity, price, plazo?)` (named exports)
**Usado por:** `src/execution/executionEngine.js`
**Depende de:** (ninguno)

### iolOrderClient.js
**Propósito:** Wrapper de Axios para los endpoints de órdenes de IOL (POST /operar/Comprar, POST /operar/Vender, DELETE /operaciones/:id, GET /operaciones/:id). Implementa retry con backoff exponencial para envíos. NUNCA es llamado cuando DRY_RUN=true.
**Exporta:** `sendBuyOrder`, `sendSellOrder`, `cancelOrder`, `getOrderStatus` (named exports)
**Usado por:** `src/execution/executionEngine.js` (solo cuando DRY_RUN=false)
**Depende de:** `axios`, `src/auth/tokenManager.js`, `src/shared/logger.js`, `process.env`

### executionEngine.js
**Propósito:** Coordina el ciclo completo de envío de una orden: verifica DRY_RUN → construye la orden → persiste como 'pending' → envía a IOL → actualiza status. Si DRY_RUN=true, simula la orden con status 'dry_run' sin hacer ninguna llamada HTTP.
**Exporta:** `default class ExecutionEngine`
**Usado por:** `scripts/runPipeline.js`
**Depende de:** `src/execution/orderBuilder.js`, `src/execution/iolOrderClient.js`, `src/persistence/orderRepository.js`, `src/shared/logger.js`, `src/shared/constants.js`

---

## src/persistence/

### prismaClient.js
**Propósito:** Singleton del PrismaClient. Es el único lugar del proyecto que instancia PrismaClient. Todos los repositorios lo importan de aquí.
**Exporta:** `default prisma` (PrismaClient instance)
**Usado por:** todos los repositorios, `scripts/checkDb.js`, `scripts/runStrategy.js`, `scripts/runWithRisk.js`, `scripts/runPipeline.js`, `prisma/seed.js`
**Depende de:** `@prisma/client`

### assetRepository.js
**Propósito:** Repositorio para la tabla `assets`. Provee acceso a los activos configurados en el sistema.
**Exporta:** `findAll()`, `findBySymbolAndMarket(symbol, market)`, `upsert(symbol, market, type)` (named exports)
**Usado por:** `src/strategy/strategyEngine.js`, `scripts/fetchQuotes.js`, `scripts/backfill.js`, `scripts/runWithRisk.js`, `scripts/runPipeline.js`, `prisma/seed.js`
**Depende de:** `src/persistence/prismaClient.js`

### priceHistoryRepository.js
**Propósito:** Repositorio para la tabla `price_history`. Maneja barras OHLCV diarias cargadas via backfill. Usa `bulkUpsert` en chunks de 100 para evitar timeouts. Idempotente (upsert por [assetId, date]).
**Exporta:** `bulkUpsert(assetId, bars)`, `getRange(assetId, from, to)`, `getLatest(assetId, limit)`, `count(assetId)` (named exports)
**Usado por:** `scripts/backfill.js`, `scripts/checkDb.js`
**Depende de:** `src/persistence/prismaClient.js`

### priceTickRepository.js
**Propósito:** Repositorio para la tabla `price_ticks`. Maneja cotizaciones en tiempo real del polling de `fetchQuotes.js`. Se leen las últimas N filas para alimentar el Strategy Engine.
**Exporta:** `insert(assetId, tickData)`, `getLatest(assetId, limit)` (named exports)
**Usado por:** `scripts/fetchQuotes.js`, `src/strategy/strategyEngine.js`, `scripts/checkDb.js`
**Depende de:** `src/persistence/prismaClient.js`

### decisionRepository.js
**Propósito:** Repositorio para la tabla `decisions`. Persiste las señales BUY/SELL generadas por el Strategy Engine.
**Exporta:** `insert(assetId, signal, strategy, priceAtDecision, metadata)`, `getRecent(assetId, limit)` (named exports)
**Usado por:** `src/strategy/strategyEngine.js`
**Depende de:** `src/persistence/prismaClient.js`

### orderRepository.js
**Propósito:** Repositorio para la tabla `orders`. Gestiona el ciclo de vida de las órdenes: pending → sent/dry_run → filled/rejected.
**Exporta:** `insert(data)`, `updateStatus(id, status, iolResponse)`, `getPending()`, `getByAsset(assetId)` (named exports)
**Usado por:** `src/execution/executionEngine.js`, `scripts/runWithRisk.js`, `scripts/runPipeline.js`
**Depende de:** `src/persistence/prismaClient.js`

### positionRepository.js
**Propósito:** Repositorio para la tabla `positions`. Gestiona las posiciones abiertas del bot por activo.
**Exporta:** `upsert(assetId, data)`, `findByAsset(assetId)`, `findAll()` (named exports)
**Usado por:** `scripts/runWithRisk.js`, `scripts/runPipeline.js`
**Depende de:** `src/persistence/prismaClient.js`

### botStateRepository.js
**Propósito:** Repositorio para la tabla `bot_state`. Gestiona el estado global del bot (capital, PnL, drawdown). Siempre lee/escribe la fila con id=1.
**Exporta:** `get()`, `update(data)` (named exports)
**Usado por:** `scripts/checkDb.js`, `scripts/runWithRisk.js`, `scripts/runPipeline.js`
**Depende de:** `src/persistence/prismaClient.js`

---

## src/shared/

### assets.js
**Propósito:** Lista hardcodeada de los 3 activos iniciales del bot. Fuente de verdad para los scripts de entrada que no usan la DB.
**Exporta:** `ASSETS` (array, named export)
**Usado por:** `scripts/fetchQuotes.js`, `prisma/seed.js`
**Depende de:** (ninguno)

### constants.js
**Propósito:** Constantes compartidas entre módulos. Define las señales válidas, el límite de historial para estrategias, y la función generadora de claves del STRATEGY_MAP.
**Exporta:** `SIGNALS`, `HISTORY_LIMIT`, `STRATEGY_MAP_KEY` (named exports)
**Usado por:** `src/strategy/baseStrategy.js`, `src/strategy/strategyEngine.js`, `src/strategy/strategies/smaCrossover.js`, `src/strategy/strategies/myStrategy.js`, `src/execution/executionEngine.js`
**Depende de:** (ninguno)

### logger.js
**Propósito:** Instancia singleton de Winston configurada con formato JSON y timestamps. Todos los módulos importan el logger de aquí para garantizar formato consistente.
**Exporta:** `default logger` (Winston Logger instance)
**Usado por:** prácticamente todos los módulos de src/ y scripts/
**Depende de:** `winston`, `process.env`

### riskConfig.js
**Propósito:** Configuración de los límites del Risk Manager. Lee de variables de entorno con valores por defecto razonables. Permite ajustar parámetros de riesgo sin modificar código.
**Exporta:** `RISK_CONFIG` (objeto, named export)
**Usado por:** `src/risk/riskManager.js`
**Depende de:** `process.env`

---

## scripts/

### fetchQuotes.js
**Propósito:** Script de polling continuo. Cada `POLL_INTERVAL_MS` ms obtiene cotizaciones de GGAL, YPFD y GD35 via IOL y las persiste como price_ticks en DB. Maneja SIGINT limpiamente. Es el principal productor de datos para el Strategy Engine.
**Exporta:** (script, no exporta)
**Depende de:** `src/market-data/marketDataService.js`, `src/persistence/assetRepository.js`, `src/persistence/priceTickRepository.js`, `src/shared/logger.js`, `dotenv/config`

### backfill.js
**Propósito:** Script de ejecución única. Carga hasta 5 años de datos históricos OHLCV diarios para cada activo via el endpoint `seriehistorica` de IOL y los persiste en `price_history`. Idempotente por el upsert de `priceHistoryRepository`.
**Exporta:** (script, no exporta)
**Depende de:** `src/market-data/marketDataService.js`, `src/persistence/assetRepository.js`, `src/persistence/priceHistoryRepository.js`, `src/persistence/prismaClient.js`, `src/shared/logger.js`, `dotenv/config`

### checkDb.js
**Propósito:** Script de diagnóstico que muestra el estado de la DB: activos, conteo de ticks y barras históricas por activo, total de decisiones, y bot_state completo.
**Exporta:** (script, no exporta)
**Depende de:** múltiples repositorios, `src/persistence/prismaClient.js`, `src/shared/logger.js`, `dotenv/config`

### runStrategy.js
**Propósito:** Ejecuta un ciclo completo del Strategy Engine y termina. No hace loop. Útil para probar estrategias sin el Risk Manager ni Execution Engine.
**Exporta:** (script, no exporta)
**Depende de:** `src/strategy/strategyEngine.js`, `src/persistence/prismaClient.js`, `src/shared/logger.js`, `dotenv/config`

### runWithRisk.js
**Propósito:** Ejecuta un ciclo de estrategia y valida cada señal BUY/SELL con el Risk Manager. Loguea qué decisiones serían aprobadas o rechazadas sin ejecutar órdenes.
**Exporta:** (script, no exporta)
**Depende de:** `src/strategy/strategyEngine.js`, `src/risk/riskManager.js`, repositorios, `src/persistence/prismaClient.js`, `src/shared/logger.js`, `dotenv/config`

### runPipeline.js
**Propósito:** Pipeline completo: Strategy → Risk → Execution. Requiere DRY_RUN=true (aborta si no está). Ejecuta un ciclo y procesa cada decisión BUY/SELL a través del Risk Manager y ExecutionEngine (en modo simulado con DRY_RUN=true).
**Exporta:** (script, no exporta)
**Depende de:** `src/strategy/strategyEngine.js`, `src/risk/riskManager.js`, `src/execution/executionEngine.js`, repositorios, `src/persistence/prismaClient.js`, `src/shared/logger.js`, `dotenv/config`

---

## prisma/

### seed.js
**Propósito:** Seed inicial de la base de datos. Hace upsert de los 3 activos (GGAL, YPFD, GD35) y crea la fila de `bot_state` con `INITIAL_CAPITAL` del .env si no existe. Ejecutar con `npx prisma db seed`.
**Exporta:** (script, no exporta)
**Depende de:** `src/shared/assets.js`, `src/persistence/prismaClient.js`, `src/shared/logger.js`, `dotenv/config`
