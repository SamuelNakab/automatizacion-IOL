# PROGRESS — Trading Bot IOL

## Fase 1: Fundación e ingesta de datos — COMPLETA
**Fecha:** 2026-05-05

### Archivos creados
| Archivo | Descripción |
|---|---|
| `package.json` | ESModules, deps: axios, winston, dotenv, prisma, @prisma/client. DevDep: vitest |
| `.env.example` | Variables de entorno requeridas (sin valores) |
| `vitest.config.js` | Configuración de Vitest para Node |
| `src/shared/logger.js` | Instancia Winston con formato JSON + timestamps |
| `src/shared/assets.js` | Lista hardcodeada de los 3 activos iniciales |
| `src/auth/tokenManager.js` | Singleton: obtiene bearer token, renueva a los 12 min vía refresh_token |
| `src/market-data/iolClient.js` | Wrapper Axios con retry exponencial (3 intentos, 1s/2s/4s) |
| `src/market-data/marketDataService.js` | getQuote() y getHistoricalSeries() con normalización |
| `scripts/fetchQuotes.js` | Script de polling: cotizaciones cada POLL_INTERVAL_MS ms + persistencia |
| `tests/unit/auth/tokenManager.test.js` | 4 tests: primer token, reutilización, renovación por tiempo, fallback |
| `tests/unit/market-data/marketDataService.test.js` | 6 tests: normalización campos estándar, alternativos, nulos, endpoints |

---

## Fase 2: Persistencia y base de datos — COMPLETA
**Fecha:** 2026-05-07

### Archivos creados / modificados
| Archivo | Descripción |
|---|---|
| `prisma/schema.prisma` | Schema exacto de CLAUDE.md: Asset, Price, Decision, Order, Position, BotState |
| `prisma/migrations/20260507234845_init/` | Migración inicial aplicada en Neon PostgreSQL |
| `prisma/seed.js` | Upsert de 3 activos + creación de BotState con INITIAL_CAPITAL |
| `src/persistence/prismaClient.js` | Singleton de PrismaClient |
| `src/persistence/assetRepository.js` | findAll, findBySymbolAndMarket, upsert |
| `src/persistence/priceRepository.js` | insert (con BigInt para volume), getLatest, getRange |
| `src/persistence/decisionRepository.js` | insert, getRecent |
| `src/persistence/orderRepository.js` | insert, updateStatus, getPending, getByAsset |
| `src/persistence/positionRepository.js` | upsert, findByAsset, findAll |
| `src/persistence/botStateRepository.js` | get (lanza si no existe), update |
| `src/execution/executionEngine.js` | RESERVADO — solo comentarios + export vacío |
| `scripts/fetchQuotes.js` | Actualizado: persiste cada cotización vía priceRepository |
| `scripts/checkDb.js` | Diagnóstico: activos, precios, bot_state, última cotización por activo |
| `tests/unit/persistence/repositories.test.js` | 6 tests: price.insert, botState.get error, position.upsert, asset.findBy |
| `.env.example` | Agregadas: INITIAL_CAPITAL y DIRECT_URL (requerida por Neon + Prisma) |

### Verificaciones completadas
1. ✅ `npm test` → **16/16 tests** (4 tokenManager + 6 marketDataService + 6 repositories)
2. ✅ `node scripts/fetchQuotes.js` → 2 ciclos completos, persistencia confirmada en GGAL/YPFD/GD35
3. ✅ `node scripts/checkDb.js` → 3 activos, 6 filas en prices, BotState capital=10000
4. ✅ `src/execution/executionEngine.js` → solo comentarios reservados + `export default {}`

### Notas de infraestructura
- **Neon PostgreSQL** (serverless): requiere `DIRECT_URL` para migrations (`directUrl` en schema.prisma).
  `DIRECT_URL` = igual que `DATABASE_URL` pero sin `-pooler` en el hostname.
- `DATABASE_URL` (pooler) → queries de runtime
- `DIRECT_URL` (conexión directa) → `prisma migrate dev`

---

## Fase 3: Strategy Engine — COMPLETA
**Fecha:** 2026-05-08

### Archivos creados
| Archivo | Descripción |
|---|---|
| `src/shared/constants.js` | SIGNALS, HISTORY_LIMIT=100, STRATEGY_MAP_KEY |
| `src/strategy/indicators.js` | sma, ema, rsi, bollingerBands, macd — funciones puras sin dependencias |
| `src/strategy/baseStrategy.js` | Clase base abstracta: computeIndicators(), run(), evaluate() abstracto |
| `src/strategy/strategies/smaCrossover.js` | BUY si sma20 > sma50, SELL si sma20 < sma50 |
| `src/strategy/strategies/myStrategy.js` | RESERVADO — solo esqueleto con `return SIGNALS.HOLD` |
| `src/strategy/strategyEngine.js` | runCycle(): itera activos, ejecuta estrategia, persiste BUY/SELL |
| `scripts/runStrategy.js` | Ejecuta un ciclo y termina (no es loop) |
| `tests/unit/strategy/indicators.test.js` | 16 tests: sma, ema, rsi, bollingerBands, macd |
| `tests/unit/strategy/baseStrategy.test.js` | 6 tests: error en abstracta, señal inválida, HOLD sin datos |
| `tests/unit/strategy/smaCrossover.test.js` | 4 tests: BUY, SELL, HOLD por null, HOLD por igualdad |
| `tests/unit/strategy/strategyEngine.test.js` | 4 tests: findAll, persistencia BUY, no persiste HOLD, aislamiento por activo |
| `scripts/checkDb.js` | Actualizado: agrega conteo de decisions |

### Verificaciones completadas
1. ✅ `npm test` → **46/46 tests** (Fases 1 + 2 + 3)
2. ✅ `node scripts/runStrategy.js` → señal HOLD para GGAL, YPFD, GD35 (esperado: solo 2 precios en DB, indicadores null)
3. ✅ `node scripts/checkDb.js` → decisions=0 (correcto: HOLD no se persiste)
4. ✅ `myStrategy.js` solo contiene esqueleto + `return SIGNALS.HOLD`
5. ✅ `executionEngine.js` intacto — solo comentarios reservados + `export default {}`

### Cómo activar señales reales
Acumular ≥50 precios en DB corriendo `fetchQuotes.js` (≥25 ciclos de 30s = ~12 min).
Con suficientes datos, `smaCrossover` generará BUY o SELL reales.

### Cómo usar tu estrategia personalizada
En [src/strategy/strategyEngine.js](src/strategy/strategyEngine.js), descomentar el import de MyStrategy
y reemplazar SmaCrossover por MyStrategy en el STRATEGY_MAP.
La lógica va en `evaluate()` de [src/strategy/strategies/myStrategy.js](src/strategy/strategies/myStrategy.js).

## Fase 4: Risk Manager + datos históricos — COMPLETA
**Fecha:** 2026-05-08

### Cambios de esquema (Parte A)
- Modelo `Price` eliminado. Reemplazado por dos modelos:
  - `PriceHistory` — barras OHLCV diarias, unique por [assetId, date]
  - `PriceTick` — cotizaciones en tiempo real del polling, indexed por [assetId, capturedAt]
- Aplicado con `prisma db push` (Neon advisory lock incompatible con `migrate dev` en entorno no-interactivo; el schema queda en sync verificado por `db push --no-pending`)

### Archivos creados / modificados
| Archivo | Descripción |
|---|---|
| `prisma/schema.prisma` | Modelos PriceHistory + PriceTick, Asset actualizado |
| `src/persistence/priceHistoryRepository.js` | bulkUpsert (chunked), getRange, getLatest, count |
| `src/persistence/priceTickRepository.js` | insert, getLatest |
| `src/shared/riskConfig.js` | RISK_CONFIG: 5 parámetros leídos de env con defaults |
| `src/risk/riskManager.js` | Clase RiskManager: 5 reglas en cascada, puro (sin DB) |
| `scripts/backfill.js` | 7983 barras cargadas: GGAL 4321→1217, YPFD 3662→1217, GD35 0 |
| `scripts/runWithRisk.js` | Ciclo estrategia + validación de riesgo + resumen |
| `scripts/checkDb.js` | Actualizado: price_history count por activo + ticks totales |
| `scripts/fetchQuotes.js` | priceRepository → priceTickRepository |
| `src/strategy/strategyEngine.js` | priceRepository → priceTickRepository; runCycle() retorna decisions[] |
| `tests/unit/risk/riskManager.test.js` | 15 tests: drawdown, intervalo, capital, exposición activo, total |
| `tests/unit/persistence/repositories.test.js` | Actualizado: priceRepository → priceTickRepository |
| `tests/unit/strategy/strategyEngine.test.js` | Actualizado: priceRepository → priceTickRepository |
| `.env.example` | Agregadas variables RISK_* |
| **Eliminado** `src/persistence/priceRepository.js` | Ya no tiene uso |

### Verificaciones completadas
1. ✅ `npx prisma db push` → "The database is already in sync with the Prisma schema"
2. ✅ `node scripts/backfill.js` → 7983 barras (GGAL: 1217, YPFD: 1217, GD35: 0 sin historial en IOL)
3. ✅ `node scripts/checkDb.js` → GGAL/YPFD 1217 barras históricas, ticks acumulándose
4. ✅ `npm test` → **61/61 tests** (8 archivos de test)
5. ✅ `node scripts/runWithRisk.js` → 3 activos, señal HOLD (0 ticks activos), 0 aprobadas/rechazadas
6. ✅ `executionEngine.js` intacto — solo comentarios reservados + `export default {}`
7. ✅ `myStrategy.js` intacto — solo esqueleto + `return SIGNALS.HOLD`

### Nota: GD35 sin historial
El endpoint `seriehistorica` de IOL no retorna datos para GD35 (bono). El backfill
maneja este caso limpiamente (recibió 0 barras, continuó). Los price_ticks de GD35
se acumulan normalmente vía `fetchQuotes.js`.

### Para ver señales reales con Risk Manager
Correr `fetchQuotes.js` durante al menos 50 ciclos (≈25 min) para acumular ticks.
Luego ejecutar `node scripts/runWithRisk.js` para ver BUY/SELL validados por riesgo.

---

## Fase 5: Execution Engine — COMPLETA
**Fecha:** 2026-05-08

### Archivos creados / modificados
| Archivo | Descripción |
|---|---|
| `src/execution/orderBuilder.js` | Módulo puro: construye JSON de orden para IOL, valida inputs |
| `src/execution/iolOrderClient.js` | Wrapper Axios: sendBuyOrder, sendSellOrder, cancelOrder, getOrderStatus |
| `src/execution/executionEngine.js` | ExecutionEngine.execute(): flujo completo con guard DRY_RUN |
| `src/risk/riskManager.js` | Actualizado: validate() incluye `quantity` en retorno aprobado |
| `scripts/runPipeline.js` | Pipeline completo Data→Strategy→Risk→Execution (DRY_RUN) |
| `tests/unit/execution/orderBuilder.test.js` | 12 tests: campos correctos, validaciones de inputs |
| `tests/unit/execution/executionEngine.test.js` | 5 tests: DRY_RUN guard, dry_run status, rejected en fallo IOL |
| `docs/archivos.md` | 31 entradas: descripción de cada archivo .js del proyecto |
| `docs/funciones.md` | 47 entradas: descripción de cada función pública |

### Verificaciones completadas
1. ✅ `.env` contiene `DRY_RUN=true`
2. ✅ `npx vitest run` → **78/78 tests** (10 archivos de test)
3. ✅ `node scripts/runPipeline.js` → "=== CICLO PIPELINE [DRY_RUN] ===" en logs, 0 decisiones BUY/SELL (HOLD correcto), sin llamadas a /operar/
4. ✅ Tabla `orders` vacía (0 filas — HOLD no genera órdenes)
5. ✅ `docs/archivos.md` — 31 entradas (una por cada archivo .js)
6. ✅ `docs/funciones.md` — 47 entradas (una por cada función pública)
7. ✅ `myStrategy.js` intacto — `return SIGNALS.HOLD`

### Comportamiento DRY_RUN
- `executionEngine.execute()` verifica `process.env.DRY_RUN === 'true'` en el primer paso
- Si DRY_RUN=true: loguea "ORDEN SIMULADA [DRY_RUN]", persiste orden con status `'dry_run'`, retorna sin llamar a iolOrderClient
- `iolOrderClient.js` nunca es llamado mientras DRY_RUN=true
- `runPipeline.js` aborta con error si DRY_RUN no está activo

### Para ver órdenes dry_run en DB
Acumular ≥50 ticks corriendo `fetchQuotes.js`, luego ejecutar `node scripts/runPipeline.js`.
Con señales BUY/SELL reales (cuando hay suficientes datos), las órdenes aparecerán con status `'dry_run'`.

---

## Fase 6: Orchestrator — COMPLETA
**Fecha:** 2026-05-08

### Archivos creados / modificados
| Archivo | Descripción |
|---|---|
| `src/shared/marketHours.js` | isMarketOpen(), getNextOpenTime(), formatMarketStatus() — usa date-fns-tz |
| `src/orchestrator/positionUpdater.js` | confirmOrderFilled() (transacción atómica), updateUnrealizedPnl() |
| `src/orchestrator/orderPoller.js` | pollPendingOrders(), resolveOrphanOrders() |
| `src/orchestrator/orchestrator.js` | Clase Orchestrator: start(), stop(), runCycle() con isRunning guard |
| `scripts/startBot.js` | Entry point del bot, verifica DRY_RUN, instancia todo y llama start() |
| `src/persistence/orderRepository.js` | Agregados: getSent(), getOrphans(timeoutMin) |
| `package.json` | Agregado: `"start": "node scripts/startBot.js"` |
| `docs/archivos.md` / `docs/funciones.md` | Actualizados con nuevos módulos de Fase 6 |
| `tests/unit/orchestrator/marketHours.test.js` | 6 tests de horario con vi.useFakeTimers() |
| `tests/unit/orchestrator/positionUpdater.test.js` | 5 tests: BUY sin pos, BUY con pos (avgCost), SELL, SELL a 0, fallo de tx |
| `tests/unit/orchestrator/orchestrator.test.js` | 3 tests: isRunning guard, mercado cerrado, error→isRunning=false |

### Verificaciones completadas
1. ✅ `npx vitest run` → **92/92 tests** (13 archivos de test)
2. ✅ `npm start` → bot arranca, loguea config (sin credenciales), "Mercado cerrado — próxima apertura: 8/5/26, 11:00 a. m." en cada ciclo de 30s, order poller 0 órdenes, detenido limpiamente
3. ✅ `DRY_RUN=true` en .env — `startBot.js` aborta si no está
4. ✅ `myStrategy.js` intacto
5. ✅ `docs/archivos.md` y `docs/funciones.md` actualizados

### Comportamiento del Orchestrator
- `npm start` → arranca el bot completo y automatizado
- Cada 30s (POLL_INTERVAL_MS): ciclo completo si mercado abierto (Lu-Vi 11:00-17:00 ARG)
- Fuera de horario: loguea "Mercado cerrado" y espera el próximo tick
- Cada 60s (ORDER_POLL_INTERVAL_MS): consulta estado de órdenes 'sent' en IOL
- Al arrancar: resuelve órdenes huérfanas (> ORPHAN_ORDER_TIMEOUT_MIN minutos)
- SIGINT/SIGTERM → detención limpia con "Bot detenido limpiamente."

---

## Fase 7A: Alertas por email (Nodemailer) — COMPLETA
**Fecha:** 2026-05-08

### Archivos creados / modificados
| Archivo | Descripción |
|---|---|
| `src/monitoring/emailAlert.js` | Singleton Nodemailer + Gmail. isConfigured=false si faltan vars. sendAlert() nunca detiene el bot |
| `scripts/testEmail.js` | Envía email de prueba BOT_START para verificar credenciales |
| `src/orchestrator/orchestrator.js` | Integración: emailAlert como dep inyectada; BOT_START en start(), BOT_STOP en stop(), ORDER_FILLED + DRAWDOWN_ALERT + CRITICAL_ERROR en runCycle() |
| `scripts/startBot.js` | Importa emailAlert y lo pasa al constructor del Orchestrator |
| `tests/unit/monitoring/emailAlert.test.js` | 8 tests: sin env, con env, sendMail exitoso, error silenciado, DASHBOARD_URL, ORDER_FILLED, DRAWDOWN_ALERT |
| `docs/archivos.md` / `docs/funciones.md` | Actualizados con emailAlert.js y testEmail.js |

### Verificaciones completadas
1. ✅ `npx vitest run` → **100/100 tests** (14 archivos de test)
2. ✅ `node scripts/testEmail.js` → email BOT_START entregado a samuelnakab@gmail.com sin errores
3. ✅ `npm start` → loguea config, envía email BOT_START, obtiene token IOL, ciclos cada 30s
4. ✅ Un fallo de email NO detiene el bot (error silenciado con logger.error)
5. ✅ `DRY_RUN=true` en .env
6. ✅ `myStrategy.js` intacto

### Eventos de alerta configurados
| Evento | Cuándo se dispara |
|---|---|
| BOT_START | Al arrancar el bot (`orchestrator.start()`) |
| BOT_STOP | Al detener el bot con SIGINT/SIGTERM |
| ORDER_FILLED | Si se ejecuta una orden Y `ALERT_ON_ORDER=true` |
| DRAWDOWN_ALERT | Si drawdown >= ALERT_DRAWDOWN_PCT (default: 10%) |
| CRITICAL_ERROR | Ante cualquier excepción en `runCycle()` |

### Variables de entorno (Fase 7A)
```
ALERT_EMAIL_FROM=     # Cuenta Gmail remitente
ALERT_EMAIL_TO=       # Destinatario de las alertas
ALERT_EMAIL_PASSWORD= # App password de Google (no la contraseña real)
ALERT_ON_ORDER=true   # Activar alertas por orden ejecutada
ALERT_DRAWDOWN_PCT=10 # Umbral de drawdown para alerta (%)
DASHBOARD_URL=        # Opcional — se incluye en todos los mails
```

---

## Fase Nueva A — Backtesting V1 — COMPLETA
**Fecha:** 2026-05-16

### Archivos creados
| Archivo | Descripción |
|---|---|
| `src/backtest/indicators.js` | Funciones puras: sma, ema, rsi, bollingerBands, atr (standalone, sin deps cruzadas) |
| `src/backtest/algorithms.js` | 5 algoritmos puros: rsiMeanReversion, momentum, bollingerReversion, maCrossover, atrBreakout |
| `src/backtest/simulator.js` | simulate() + calcMetrics(): simula PnL sobre señales y calcula métricas |
| `scripts/runBacktest.js` | Script standalone: corre los 5 algoritmos sobre price_history, imprime tabla, elige ganador |
| `scripts/backfill.js` | Actualizado para 6 activos (GGAL, BBAR, PAMP, TGSU2, TRAN, YPFD) |
| `src/shared/assets.js` | Reducido a 6 acciones locales con historial en IOL |
| `docs/backtest_results.md` | Resultados del backtest V1 |
| `tests/unit/backtest/algorithms.test.js` | 6 tests de los 5 algoritmos |
| `tests/unit/backtest/simulator.test.js` | 5 tests de simulate() y calcMetrics() |

### Verificaciones completadas
1. ✅ `npx vitest run` → **114/114 tests** (17 archivos de test)
2. ✅ `node scripts/runBacktest.js` → tabla completa por activo y consolidada
3. ✅ Ganador V1: **RSI Mean Reversion** (Sharpe 2.376, WinRate 91.67%, Drawdown -1.5%)
4. ✅ `docs/backtest_results.md` generado
5. ✅ `myStrategy.js` intacto
6. ✅ `DRY_RUN=true`

### Activos definitivos (6)
GGAL, BBAR, PAMP, TGSU2, TRAN, YPFD — todos acciones del mercado local bCBA con 1218-1224 barras históricas desde 2021.

---

## Backtesting V2 — COMPLETA
**Fecha:** 2026-05-16

### Archivos creados
| Archivo | Descripción |
|---|---|
| `src/backtest/dollarBenchmark.js` | Obtiene apreciación del dólar en cascada: GD30 DB → BCRA API → fallback hardcodeado |
| `src/backtest/backtestV2Runner.js` | Lógica V2: filtros MIN_TRADES=8 + superar dólar. evaluateValidity(), buildConsolidatedTable(), declareWinner() |
| `scripts/runBacktestV2.js` | Script ejecutable con columna "vs Dólar" y algoritmos descalificados |
| `docs/backtest_v2_results.md` | Resultados del backtest V2 |
| `tests/unit/backtest/dollarBenchmark.test.js` | 4 tests: BCRA ok, BCRA falla, respuesta vacía, appreciation siempre número |
| `tests/unit/backtest/backtestV2Runner.test.js` | 8 tests: evaluateValidity, declareWinner, buildConsolidatedTable, integración |

### Verificaciones completadas
1. ✅ `npx vitest run` → **126/126 tests** (19 archivos de test)
2. ✅ `node scripts/runBacktestV2.js` → benchmark dólar fallback +1042.86%, tablas con columna "vs Dólar"
3. ✅ Ganador V2: **Momentum** (único que supera el dólar en ≥3/6 activos con ≥8 trades)
4. ✅ RSI/Bollinger/ATR descalificados (no superan el dólar con datos reales 2022-2026)
5. ✅ `docs/backtest_v2_results.md` generado
6. ✅ `myStrategy.js` intacto
7. ✅ `DRY_RUN=true`

### Resultado del benchmark
- Benchmark: dólar fallback +1042.86% (105 → 1200 ARS/USD, 2022-2026)
- Solo Momentum y MA Crossover superan el dólar en activos específicos
- Ganador con filtros estrictos: **Momentum** (Sharpe 0.52, Return +1452%, vs Dólar +410%)

---

## Fase Nueva B — Estrategias de corto plazo + WhatsApp — COMPLETA
**Fecha:** 2026-05-17

### Archivos creados / modificados
| Archivo | Descripción |
|---|---|
| `src/monitoring/whatsappAlert.js` | Singleton Twilio. Eventos: BUY_SIGNAL, SELL_EXECUTED, CRITICAL_ERROR. Fallo silenciado |
| `src/strategy/buyScoreCalculator.js` | Función pura: scoring de compra (0-9 pts). Filtro duro SMA50. z-score, RSI, Bollinger, volumen |
| `src/strategy/strategies/buyScoreStrategy.js` | Estrategia BUY: score ≥ threshold + confirmación intradiaria + dedup diario. NUNCA llama executionEngine |
| `src/strategy/strategies/sellTakeProfitStrategy.js` | Estrategia SELL: take profit vs avgCost de position. NUNCA opera activos sin posición |
| `src/strategy/baseStrategy.js` | `run()` actualizado a `await this.evaluate()` para soportar evaluate() async |
| `src/strategy/strategyEngine.js` | Reemplazado SmaCrossover por sellTakeProfit (prioridad alta) + buyScore. decisions[] incluye strategyInstance |
| `src/orchestrator/orchestrator.js` | Inyecta whatsappAlert. SELL → executionEngine + alerts. BUY → pending_manual + WhatsApp |
| `scripts/startBot.js` | Importa e inyecta whatsappAlert al Orchestrator |
| `scripts/runPipeline.js` | BUY crea pending_manual en lugar de llamar executionEngine |
| `tests/unit/strategy/buyScoreCalculator.test.js` | 7 tests: insuficiente, SMA50 filtro, z-score, RSI, Bollinger, confidence, details |
| `tests/unit/strategy/sellTakeProfitStrategy.test.js` | 5 tests: sin posición, precio bajo, precio exacto, precio alto, logger.debug |
| `tests/unit/monitoring/whatsappAlert.test.js` | 5 tests: sin config, con Twilio ok, Twilio falla, BUY body, SELL body |
| `tests/unit/strategy/strategyEngine.test.js` | Actualizado para mocks de SellTakeProfitStrategy y BuyScoreStrategy |

### Verificaciones completadas
1. ✅ `npx vitest run` → **143/143 tests** (22 archivos de test)
2. ✅ `node scripts/runPipeline.js` → 6 activos, cada uno pasa por sellTakeProfit (HOLD, sin posición) luego buyScore (HOLD, ticks insuficientes). Sin errores.
3. ✅ WhatsApp BUY_SIGNAL entregado a whatsapp:+5491125365163 — confirmado en logs
4. ✅ sellTakeProfitStrategy NUNCA genera SELL para activos sin posición en positions
5. ✅ `DRY_RUN=true` en .env
6. ✅ `POLL_INTERVAL_MS=300000` en .env
7. ✅ `myStrategy.js` intacto — NO aparece en STRATEGY_MAP

### Flujo de señales en producción
- **SELL aprobado** → executionEngine.execute() [DRY_RUN] → whatsappAlert SELL_EXECUTED + emailAlert ORDER_FILLED
- **BUY aprobado** → orderRepository.insert(pending_manual) → whatsappAlert BUY_SIGNAL → usuario ejecuta manualmente
- **HOLD** → ninguna acción
