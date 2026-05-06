# PROGRESS — Trading Bot IOL

## Fase 1: Fundación e ingesta de datos — COMPLETA
**Fecha:** 2026-05-05

### Archivos creados
| Archivo | Descripción |
|---|---|
| `package.json` | ESModules, dependencias: axios, winston, dotenv, prisma, @prisma/client. DevDep: vitest |
| `.env.example` | Variables de entorno requeridas (sin valores) |
| `vitest.config.js` | Configuración de Vitest para Node |
| `src/shared/logger.js` | Instancia Winston con formato JSON + timestamps |
| `src/shared/assets.js` | Lista hardcodeada de los 3 activos iniciales |
| `src/auth/tokenManager.js` | Singleton: obtiene bearer token, renueva a los 12 min vía refresh_token |
| `src/market-data/iolClient.js` | Wrapper Axios con retry exponencial (3 intentos, 1s/2s/4s) |
| `src/market-data/marketDataService.js` | getQuote() y getHistoricalSeries() con normalización |
| `scripts/fetchQuotes.js` | Script de polling: cotizaciones cada POLL_INTERVAL_MS ms |
| `tests/unit/auth/tokenManager.test.js` | Tests: primer token, reutilización, renovación por tiempo |
| `tests/unit/market-data/marketDataService.test.js` | Tests: normalización de campos estándar y alternativos |

### Directorios vacíos (con .gitkeep, para fases futuras)
- `src/strategy/` — Strategy Engine (Fase 2)
- `src/risk/` — Risk Manager (Fase 3)
- `src/execution/` — Execution Engine (Fase 4)
- `src/persistence/` — Repositorios DB (Fase 2)
- `src/orchestrator/` — Scheduler (Fase 3)
- `src/monitoring/` — Métricas y alertas (Fase 5)
- `prisma/migrations/` — Migraciones de DB (Fase 2)
- `tests/integration/` — Tests de integración (Fase 2+)

### Cómo verificar manualmente

**1. Instalar dependencias:**
```bash
npm install
```

**2. Crear `.env` a partir de `.env.example` y completar credenciales del sandbox IOL:**
```
IOL_USERNAME=tu_usuario
IOL_PASSWORD=tu_password
IOL_BASE_URL=https://api.homo.invertironline.com
POLL_INTERVAL_MS=30000
```

**3. Ejecutar el script de cotizaciones:**
```bash
node scripts/fetchQuotes.js
```
Debe mostrar logs JSON con cotizaciones de GGAL, YPFD y GD35 actualizándose cada 30 segundos.
Ctrl+C imprime "Bot detenido" y sale limpiamente.

**4. Ejecutar los tests:**
```bash
npm test
```
Todos los tests deben pasar sin llamadas reales a IOL.

---

## Fase 2: Pendiente
Persistencia en PostgreSQL (Prisma schema, repositorios, migraciones).

## Fase 3: Pendiente
Strategy Engine + Risk Manager.

## Fase 4: Pendiente
Execution Engine (órdenes reales en sandbox).

## Fase 5: Pendiente
Monitoring y alertas.
