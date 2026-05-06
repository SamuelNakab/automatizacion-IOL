# CLAUDE.md — Trading Bot IOL

## Contexto del proyecto
Sistema de trading algorítmico multi-activo integrado con la API de InvertirOnline (IOL).
Node.js + Express + PostgreSQL + Prisma. Operará sobre el mercado argentino de capitales.

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
execution/      # Execution Engine (envío de órdenes a IOL)
persistence/    # Repositorios de acceso a DB
orchestrator/   # Scheduler y coordinación del ciclo
monitoring/     # Métricas, alertas, dashboard
shared/         # Types, constantes, utilidades comunes
prisma/
schema.prisma
migrations/
tests/
unit/
integration/

## Reglas críticas de desarrollo

### Variables de entorno
- NUNCA hardcodear credenciales, URLs de API, o configuración sensible
- Toda config va en `.env`, el código la lee desde `process.env`
- El archivo `.env.example` debe existir siempre con las keys necesarias (sin valores)

### Autenticación con IOL
- El bearer token de IOL expira cada 15 minutos
- SIEMPRE usar el módulo `src/auth/tokenManager.js` para obtener headers autenticados
- El token manager debe renovar automáticamente sin que los llamadores lo sepan
- Nunca llamar a la API de IOL directamente sin pasar por el token manager

### Entornos
- `IOL_BASE_URL=https://api.homo.invertironline.com` → sandbox (desarrollo)
- `IOL_BASE_URL=https://api.invertironline.com` → producción
- El código debe ser idéntico; solo cambia la variable de entorno
- En Fase 1-6: SIEMPRE apuntar al sandbox

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
- Usar siempre los repositorios en `src/persistence/`, nunca Prisma Client directamente desde los módulos de negocio
- Toda escritura de decisión u orden DEBE ser persistida antes de ejecutarse
- Usar transacciones Prisma cuando hay múltiples escrituras relacionadas

### Separación de responsabilidades (CRÍTICO)
- El Strategy Engine SOLO genera señales. No ejecuta, no persiste, no llama a IOL.
- El Risk Manager SOLO valida. No ejecuta, no genera señales.
- El Execution Engine SOLO envía órdenes ya validadas. No decide nada.
- El Orchestrator coordina el flujo. No contiene lógica de negocio.

### Testing
- Cada módulo de negocio (auth, market-data, strategy, risk) debe tener tests unitarios
- Los tests NO deben hacer llamadas reales a IOL (usar mocks)
- El Risk Manager en particular debe tener cobertura exhaustiva de cada regla

## Activos iniciales (hardcodeados en Fase 1-2)
```javascript
const ASSETS = [
  { symbol: 'GGAL', market: 'bCBA', type: 'accion' },
  { symbol: 'YPFD', market: 'bCBA', type: 'accion' },
  { symbol: 'GD35', market: 'bCBA', type: 'bono' },
]
```

## Endpoints clave de IOL

### Auth

POST https://api.homo.invertironline.com/token
Content-Type: application/x-www-form-urlencoded
Body: username=X&password=Y&grant_type=password
POST https://api.homo.invertironline.com/token
Body: refresh_token=X&grant_type=refresh_token

### Market Data

GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion
GET /api/v2/{mercado}/Titulos/{simbolo}/Cotizacion/seriehistorica/{fechaDesde}/{fechaHasta}/ajustada

### Portfolio
GET /api/v2/portafolio/{pais}
GET /api/v2/estadocuenta

### Órdenes (solo sandbox hasta Fase 8)

POST /api/v2/operar/Comprar
POST /api/v2/operar/Vender
DELETE /api/v2/operaciones/{numeroOperacion}

## Estado actual del proyecto
Ver el archivo `PROGRESS.md` para saber qué fases están completas.
Al iniciar cada sesión de trabajo, leer PROGRESS.md antes de cualquier otra cosa.