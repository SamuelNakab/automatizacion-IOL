import { describe, it, expect, vi, afterEach } from 'vitest'
import { isMarketOpen } from '../../../src/shared/marketHours.js'

// Argentina es UTC-3. Para obtener 11:00 ARG pasamos 14:00 UTC.
// Fechas de referencia:
//   2024-01-15 (lunes), 2024-01-19 (viernes), 2024-01-20 (sábado), 2024-01-21 (domingo)

const ARG_OFFSET_MS = 3 * 60 * 60 * 1000 // UTC-3

function argTime(isoLocal) {
  // isoLocal = 'YYYY-MM-DDTHH:MM' en hora argentina
  return new Date(isoLocal + ':00.000Z').getTime() + ARG_OFFSET_MS
}

afterEach(() => {
  vi.useRealTimers()
  delete process.env.MARKET_OPEN_HOUR
  delete process.env.MARKET_CLOSE_HOUR
})

describe('isMarketOpen()', () => {
  it('lunes 11:00 ARG → true', () => {
    process.env.MARKET_OPEN_HOUR  = '10'
    process.env.MARKET_CLOSE_HOUR = '17'
    vi.useFakeTimers()
    vi.setSystemTime(argTime('2024-01-15T11:00'))
    expect(isMarketOpen()).toBe(true)
  })

  it('lunes 09:00 ARG → false (antes de apertura)', () => {
    process.env.MARKET_OPEN_HOUR  = '10'
    process.env.MARKET_CLOSE_HOUR = '17'
    vi.useFakeTimers()
    vi.setSystemTime(argTime('2024-01-15T09:00'))
    expect(isMarketOpen()).toBe(false)
  })

  it('sábado 11:00 ARG → false (fin de semana)', () => {
    process.env.MARKET_OPEN_HOUR  = '10'
    process.env.MARKET_CLOSE_HOUR = '17'
    vi.useFakeTimers()
    vi.setSystemTime(argTime('2024-01-20T11:00'))
    expect(isMarketOpen()).toBe(false)
  })

  it('viernes 17:01 ARG → false (después del cierre)', () => {
    process.env.MARKET_OPEN_HOUR  = '10'
    process.env.MARKET_CLOSE_HOUR = '17'
    vi.useFakeTimers()
    vi.setSystemTime(argTime('2024-01-19T17:01'))
    expect(isMarketOpen()).toBe(false)
  })

  it('domingo 11:00 ARG → false (fin de semana)', () => {
    process.env.MARKET_OPEN_HOUR  = '10'
    process.env.MARKET_CLOSE_HOUR = '17'
    vi.useFakeTimers()
    vi.setSystemTime(argTime('2024-01-21T11:00'))
    expect(isMarketOpen()).toBe(false)
  })

  it('respeta MARKET_OPEN_HOUR del env (apertura a las 11)', () => {
    process.env.MARKET_OPEN_HOUR  = '11'
    process.env.MARKET_CLOSE_HOUR = '17'
    vi.useFakeTimers()
    // Lunes 10:30 ARG → false cuando apertura es a las 11
    vi.setSystemTime(argTime('2024-01-15T10:30'))
    expect(isMarketOpen()).toBe(false)
  })
})
