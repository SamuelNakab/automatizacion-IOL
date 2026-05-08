# Referencia de funciones

---

## src/auth/tokenManager.js

### getAuthHeaders()
**Qué hace:** Retorna los headers HTTP de autenticación con el bearer token de IOL. Si el token no existe o tiene más de 12 minutos, lo renueva automáticamente via refresh_token (o con credenciales completas si el refresh falla) antes de retornar.
**Parámetros:** ninguno
**Retorna:** `{ Authorization: 'Bearer <token>' }`
**Efectos secundarios:** puede hacer POST a `/token` de IOL para obtener o renovar el token; actualiza el estado interno del singleton
**Llamada desde:** `src/market-data/iolClient.js`, `src/execution/iolOrderClient.js`

---

## src/market-data/iolClient.js

### get(endpoint)
**Qué hace:** Realiza un GET autenticado a la API de IOL con retry exponencial (3 intentos). Loguea cada error con número de intento, status HTTP y endpoint.
**Parámetros:** `endpoint` — string con la ruta relativa (ej. `/api/v2/bCBA/Titulos/GGAL/Cotizacion`)
**Retorna:** `response.data` (el body JSON de la respuesta)
**Efectos secundarios:** puede llamar hasta 3 veces al endpoint; loguea errores
**Llamada desde:** `src/market-data/marketDataService.js`

---

## src/market-data/marketDataService.js

### getQuote(symbol, market)
**Qué hace:** Obtiene la cotización actual de un activo desde IOL y la normaliza al formato estándar del bot. Si IOL devuelve campos con nombres alternativos, los mapea igualmente.
**Parámetros:** `symbol` — código del activo (ej. `'GGAL'`); `market` — mercado (ej. `'bCBA'`)
**Retorna:** `{ symbol, market, price, open, high, low, volume, timestamp }`
**Efectos secundarios:** llama a `iolClient.get()`; loguea el raw response en debug
**Llamada desde:** `scripts/fetchQuotes.js`

### getHistoricalSeries(symbol, market, fromDate, toDate)
**Qué hace:** Obtiene la serie histórica ajustada de un activo para un rango de fechas y normaliza cada barra al formato estándar.
**Parámetros:** `symbol`, `market`, `fromDate` — string `YYYY-MM-DD`, `toDate` — string `YYYY-MM-DD`
**Retorna:** array de `{ price, open, high, low, volume, timestamp }`
**Efectos secundarios:** llama a `iolClient.get()`
**Llamada desde:** `scripts/backfill.js`

---

## src/strategy/indicators.js

### sma(prices, period)
**Qué hace:** Calcula el Simple Moving Average de los últimos `period` valores del array.
**Parámetros:** `prices` — array de números (cierres); `period` — entero positivo
**Retorna:** número (promedio) o `null` si `prices.length < period`
**Efectos secundarios:** ninguno
**Llamada desde:** `src/strategy/baseStrategy.js`

### ema(prices, period)
**Qué hace:** Calcula la Exponential Moving Average usando suavizado estándar (`k = 2 / (period + 1)`). Inicializa con SMA de los primeros `period` valores.
**Parámetros:** `prices` — array de números; `period` — entero positivo
**Retorna:** número o `null` si `prices.length < period`
**Efectos secundarios:** ninguno
**Llamada desde:** `src/strategy/baseStrategy.js`

### rsi(prices, period)
**Qué hace:** Calcula el Relative Strength Index usando el método de suavizado de Wilder. Necesita `period + 1` precios mínimo para calcular `period` variaciones.
**Parámetros:** `prices` — array de números; `period` — entero positivo (típico: 14)
**Retorna:** número entre 0 y 100, o `null` si datos insuficientes
**Efectos secundarios:** ninguno
**Llamada desde:** `src/strategy/baseStrategy.js`

### bollingerBands(prices, period, stdDevMult?)
**Qué hace:** Calcula las bandas de Bollinger: middle = SMA(period), upper = middle + stdDevMult × σ, lower = middle − stdDevMult × σ.
**Parámetros:** `prices` — array de números; `period` — entero; `stdDevMult` — multiplicador (default: 2)
**Retorna:** `{ upper, middle, lower }` o `null` si datos insuficientes
**Efectos secundarios:** ninguno
**Llamada desde:** `src/strategy/baseStrategy.js`

### macd(prices, fast?, slow?, signalPeriod?)
**Qué hace:** Calcula la línea MACD (EMA_fast − EMA_slow), la línea de señal (EMA del MACD), y el histograma. Requiere al menos `slow + signalPeriod − 1` precios (default: 34).
**Parámetros:** `prices` — array de números; `fast` — default 12; `slow` — default 26; `signalPeriod` — default 9
**Retorna:** `{ macd, signal, histogram }` o `null` si datos insuficientes
**Efectos secundarios:** ninguno
**Llamada desde:** `src/strategy/baseStrategy.js`

---

## src/strategy/baseStrategy.js

### computeIndicators(prices)
**Qué hace:** Calcula los 6 indicadores estándar sobre el array de precios y los retorna como objeto. Los indicadores pueden ser `null` si no hay datos suficientes.
**Parámetros:** `prices` — array de objetos `{ price, ... }` ordenados de más viejo a más nuevo
**Retorna:** `{ sma20, sma50, ema20, rsi14, bb20, macd }`
**Efectos secundarios:** ninguno
**Llamada desde:** `run()` (método de la misma clase)

### evaluate(prices, indicators)  *(abstracto)*
**Qué hace:** Método abstracto que cada estrategia implementa. Recibe precios e indicadores calculados y decide la señal.
**Parámetros:** `prices` — array de objetos precio; `indicators` — resultado de `computeIndicators()`
**Retorna:** `'BUY'`, `'SELL'` o `'HOLD'`
**Efectos secundarios:** ninguno (debe ser puro)
**Llamada desde:** `run()`

### run(prices)  *(async)*
**Qué hace:** Orquesta el análisis: verifica que hay al menos 2 precios, calcula indicadores, llama a `evaluate()`, valida que la señal sea una de las 3 válidas. No debe sobreescribirse en subclases.
**Parámetros:** `prices` — array de objetos precio (más viejo primero)
**Retorna:** `Promise<'BUY' | 'SELL' | 'HOLD'>`
**Efectos secundarios:** ninguno
**Llamada desde:** `src/strategy/strategyEngine.js`

---

## src/strategy/strategyEngine.js

### runCycle()  *(async)*
**Qué hace:** Ejecuta el ciclo de análisis completo para todos los activos activos. Para cada activo: obtiene los últimos `HISTORY_LIMIT` ticks, ejecuta la estrategia configurada en `STRATEGY_MAP`, persiste en `decisions` si la señal es BUY/SELL. Un error en un activo no interrumpe los demás.
**Parámetros:** ninguno
**Retorna:** `{ BUY, SELL, HOLD, decisions[] }` — conteos por señal y array de decisiones BUY/SELL con `asset.symbol` adjunto
**Efectos secundarios:** lee de `price_ticks`, escribe en `decisions`
**Llamada desde:** `scripts/runStrategy.js`, `scripts/runWithRisk.js`, `scripts/runPipeline.js`

---

## src/strategy/strategies/smaCrossover.js

### evaluate(prices, indicators)
**Qué hace:** Compara SMA20 vs SMA50. Si sma20 > sma50 → BUY, si sma20 < sma50 → SELL. HOLD si alguno es null (datos insuficientes) o son iguales.
**Parámetros:** `prices`, `indicators` — igual que `BaseStrategy.evaluate()`
**Retorna:** `'BUY'`, `'SELL'` o `'HOLD'`
**Efectos secundarios:** ninguno
**Llamada desde:** `BaseStrategy.run()`

---

## src/strategy/strategies/myStrategy.js

### evaluate(prices, indicators)
**Qué hace:** RESERVADO — actualmente retorna `SIGNALS.HOLD`. El usuario implementa aquí su lógica de trading usando los indicadores disponibles en el parámetro `indicators`.
**Parámetros:** `prices`, `indicators` — igual que `BaseStrategy.evaluate()`
**Retorna:** `'BUY'`, `'SELL'` o `'HOLD'`
**Efectos secundarios:** ninguno (en la implementación actual)
**Llamada desde:** `BaseStrategy.run()`

---

## src/risk/riskManager.js

### validate(decision, botState, positions, lastOrderByAsset)
**Qué hace:** Valida una decisión contra 5 reglas de riesgo en cascada. La primera regla que falla rechaza la decisión. Cuando aprueba, incluye la `quantity` calculada según MAX_CAPITAL_PER_TRADE_PCT.
**Parámetros:**
- `decision` — `{ assetId, signal, priceAtDecision, asset: { symbol } }`
- `botState` — objeto completo de `botStateRepository.get()`
- `positions` — array de todas las posiciones abiertas
- `lastOrderByAsset` — `Map<assetId, Date>` con el timestamp de la última orden por activo
**Retorna:** `{ approved: true, reason: 'OK', quantity: N }` o `{ approved: false, reason: string }`
**Efectos secundarios:** ninguno (módulo puro)
**Llamada desde:** `scripts/runWithRisk.js`, `scripts/runPipeline.js`

---

## src/execution/orderBuilder.js

### buildBuyOrder(symbol, market, quantity, price, plazo?)
**Qué hace:** Construye el objeto JSON de orden de compra en el formato que acepta la API de IOL. Valida todos los parámetros y lanza Error si alguno es inválido.
**Parámetros:** `symbol` — string; `market` — string; `quantity` — entero ≥ 1; `price` — número > 0; `plazo` — `'t0'`|`'t1'`|`'t2'` (default: `'t2'`)
**Retorna:** `{ mercado, simbolo, cantidad, precio, plazo, validez: 'HOY' }`
**Efectos secundarios:** ninguno
**Llamada desde:** `src/execution/executionEngine.js`

### buildSellOrder(symbol, market, quantity, price, plazo?)
**Qué hace:** Igual que `buildBuyOrder` pero para órdenes de venta. Mismas validaciones.
**Parámetros:** mismo que `buildBuyOrder`
**Retorna:** `{ mercado, simbolo, cantidad, precio, plazo, validez: 'HOY' }`
**Efectos secundarios:** ninguno
**Llamada desde:** `src/execution/executionEngine.js`

---

## src/execution/iolOrderClient.js

### sendBuyOrder(orderPayload)
**Qué hace:** Envía una orden de compra a IOL via POST /api/v2/operar/Comprar con retry exponencial. NUNCA debe llamarse con DRY_RUN=true.
**Parámetros:** `orderPayload` — objeto construido por `buildBuyOrder()`
**Retorna:** respuesta JSON de IOL (incluye `numero` con el ID de la orden)
**Efectos secundarios:** POST real a IOL; puede enviar una orden al mercado
**Llamada desde:** `src/execution/executionEngine.js` (solo si DRY_RUN=false)

### sendSellOrder(orderPayload)
**Qué hace:** Envía una orden de venta a IOL via POST /api/v2/operar/Vender con retry exponencial. NUNCA debe llamarse con DRY_RUN=true.
**Parámetros:** `orderPayload` — objeto construido por `buildSellOrder()`
**Retorna:** respuesta JSON de IOL
**Efectos secundarios:** POST real a IOL; puede vender una posición en el mercado
**Llamada desde:** `src/execution/executionEngine.js` (solo si DRY_RUN=false)

### cancelOrder(iolOrderId)
**Qué hace:** Cancela una orden pendiente en IOL via DELETE /api/v2/operaciones/:id.
**Parámetros:** `iolOrderId` — string con el ID de la orden en IOL
**Retorna:** respuesta JSON de IOL
**Efectos secundarios:** DELETE real a IOL
**Llamada desde:** (disponible para uso del Orchestrator en Fase 6)

### getOrderStatus(iolOrderId)
**Qué hace:** Consulta el estado actual de una orden en IOL via GET /api/v2/operaciones/:id.
**Parámetros:** `iolOrderId` — string con el ID de la orden en IOL
**Retorna:** objeto JSON con el estado de la orden en IOL
**Efectos secundarios:** GET a IOL
**Llamada desde:** (disponible para polling del Orchestrator en Fase 6)

---

## src/execution/executionEngine.js

### execute(approvedDecision)  *(async)*
**Qué hace:** Ejecuta el ciclo completo de una orden aprobada por el Risk Manager. Con DRY_RUN=true: persiste la orden con status 'dry_run' y retorna sin llamar a IOL. Con DRY_RUN=false: construye la orden, la persiste como 'pending', la envía a IOL, y actualiza el status a 'sent' o 'rejected'.
**Parámetros:** `approvedDecision` — `{ assetId, signal, priceAtDecision, quantity, asset: { symbol, market }, id? }`
**Retorna:** `{ success: boolean, orderId: number, status: string, reason?: string }`
**Efectos secundarios:** escribe en tabla `orders`; si DRY_RUN=false puede llamar a `iolOrderClient`
**Llamada desde:** `scripts/runPipeline.js`

---

## src/persistence/assetRepository.js

### findAll()
**Qué hace:** Retorna todos los activos con `active = true`.
**Retorna:** array de objetos Asset
**Llamada desde:** `src/strategy/strategyEngine.js`, scripts de pipeline

### findBySymbolAndMarket(symbol, market)
**Qué hace:** Busca un activo por su constraint único [symbol, market].
**Retorna:** objeto Asset o `null`
**Llamada desde:** `scripts/fetchQuotes.js`, `scripts/backfill.js`

### upsert(symbol, market, type)
**Qué hace:** Crea el activo si no existe, o actualiza `type` si ya existe.
**Retorna:** objeto Asset creado/actualizado
**Llamada desde:** `prisma/seed.js`

---

## src/persistence/priceHistoryRepository.js

### bulkUpsert(assetId, bars)
**Qué hace:** Inserta o actualiza (idempotente) un array de barras OHLCV diarias en chunks de 100 usando `prisma.$transaction`. Si una barra para esa [assetId, date] ya existe, no la sobreescribe.
**Parámetros:** `assetId` — entero; `bars` — array de `{ date, open, high, low, close, volume }`
**Retorna:** cantidad de barras procesadas (igual a `bars.length`)
**Llamada desde:** `scripts/backfill.js`

### getRange(assetId, from, to)
**Qué hace:** Retorna barras históricas en un rango de fechas, ordenadas por fecha ascendente.
**Retorna:** array de objetos PriceHistory
**Llamada desde:** (disponible para backtesting en fases futuras)

### getLatest(assetId, limit)
**Qué hace:** Retorna las últimas N barras históricas ordenadas por fecha descendente.
**Retorna:** array de objetos PriceHistory
**Llamada desde:** `scripts/checkDb.js`

### count(assetId)
**Qué hace:** Cuenta el total de barras históricas para un activo.
**Retorna:** número entero
**Llamada desde:** `scripts/checkDb.js`

---

## src/persistence/priceTickRepository.js

### insert(assetId, tickData)
**Qué hace:** Inserta un nuevo tick de precio en tiempo real. `capturedAt` se setea automáticamente por Prisma.
**Parámetros:** `assetId`; `tickData` — `{ price, open, high, low, volume }`
**Retorna:** objeto PriceTick creado
**Llamada desde:** `scripts/fetchQuotes.js`

### getLatest(assetId, limit)
**Qué hace:** Retorna los últimos N ticks ordenados por `capturedAt` descendente (más nuevo primero).
**Retorna:** array de objetos PriceTick
**Llamada desde:** `src/strategy/strategyEngine.js`

---

## src/persistence/decisionRepository.js

### insert(assetId, signal, strategy, priceAtDecision, metadata)
**Qué hace:** Crea una nueva decisión en la tabla `decisions`.
**Retorna:** objeto Decision creado (incluye `id`, `createdAt`)
**Llamada desde:** `src/strategy/strategyEngine.js`

### getRecent(assetId, limit)
**Qué hace:** Retorna las últimas N decisiones de un activo, ordenadas por `createdAt` descendente.
**Retorna:** array de objetos Decision
**Llamada desde:** (disponible para el Orchestrator en Fase 6)

---

## src/persistence/orderRepository.js

### insert(data)
**Qué hace:** Crea una nueva orden con los datos recibidos.
**Parámetros:** `data` — campos del modelo Order (assetId, side, quantity, price, status, ...)
**Retorna:** objeto Order creado (incluye `id`)
**Llamada desde:** `src/execution/executionEngine.js`

### updateStatus(id, status, iolResponse)
**Qué hace:** Actualiza el status de una orden y guarda la respuesta cruda de IOL.
**Retorna:** objeto Order actualizado
**Llamada desde:** `src/execution/executionEngine.js`

### getPending()
**Qué hace:** Retorna todas las órdenes con status `'pending'`.
**Retorna:** array de objetos Order
**Llamada desde:** (disponible para el Orchestrator en Fase 6)

### getByAsset(assetId)
**Qué hace:** Retorna todas las órdenes de un activo, ordenadas por defecto.
**Retorna:** array de objetos Order
**Llamada desde:** `scripts/runWithRisk.js`, `scripts/runPipeline.js`

---

## src/persistence/positionRepository.js

### upsert(assetId, data)
**Qué hace:** Crea o actualiza la posición de un activo. Constraint único por `assetId`.
**Retorna:** objeto Position creado/actualizado
**Llamada desde:** (Orchestrator en Fase 6)

### findByAsset(assetId)
**Qué hace:** Retorna la posición abierta de un activo o `null` si no existe.
**Retorna:** objeto Position o `null`
**Llamada desde:** (disponible para el Risk Manager vía scripts)

### findAll()
**Qué hace:** Retorna todas las posiciones abiertas.
**Retorna:** array de objetos Position
**Llamada desde:** `scripts/runWithRisk.js`, `scripts/runPipeline.js`

---

## src/persistence/botStateRepository.js

### get()
**Qué hace:** Retorna el estado global del bot (fila id=1). Lanza `Error('BotState no inicializado')` si la fila no existe — nunca retorna null.
**Retorna:** objeto BotState
**Llamada desde:** `scripts/checkDb.js`, `scripts/runWithRisk.js`, `scripts/runPipeline.js`

### update(data)
**Qué hace:** Actualiza los campos del bot_state con los datos recibidos.
**Parámetros:** `data` — campos parciales del modelo BotState
**Retorna:** objeto BotState actualizado
**Llamada desde:** (Orchestrator en Fase 6)

---

## src/shared/

### assets.js — ASSETS
Constante: array de los 3 activos iniciales. No es una función.

### constants.js — SIGNALS, HISTORY_LIMIT, STRATEGY_MAP_KEY(symbol, market)
`STRATEGY_MAP_KEY` genera la clave del mapa de estrategias: `"GGAL:bCBA"`.

### logger.js — (instancia de Winston, no función)
Se importa como `import logger from './logger.js'` y se usa con `logger.info(...)`, etc.

### riskConfig.js — RISK_CONFIG
Constante objeto. No es una función.
