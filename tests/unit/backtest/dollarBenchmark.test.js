import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios')
vi.mock('../../../src/persistence/prismaClient.js', () => ({
  default: {
    asset: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}))
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('getDollarAppreciation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('BCRA API responde correctamente → source=bcra_oficial y appreciation calculado', async () => {
    const axios = (await import('axios')).default
    axios.get = vi.fn().mockResolvedValue({
      data: {
        status: 200,
        results: [
          { fecha: '2022-01-03', valor: 100 },
          { fecha: '2022-06-01', valor: 300 },
          { fecha: '2026-05-15', valor: 1000 },
        ],
      },
    })

    const { getDollarAppreciation } = await import('../../../src/backtest/dollarBenchmark.js')
    const result = await getDollarAppreciation(new Date('2022-01-01'), new Date())

    expect(result.source).toBe('bcra_oficial')
    expect(result.appreciation).toBeCloseTo(900, 0)  // (1000-100)/100*100
    expect(result.fromRate).toBe(100)
    expect(result.toRate).toBe(1000)
  })

  it('BCRA API falla → source=fallback', async () => {
    const axios = (await import('axios')).default
    axios.get = vi.fn().mockRejectedValue(new Error('Network error'))

    const { getDollarAppreciation } = await import('../../../src/backtest/dollarBenchmark.js')
    const result = await getDollarAppreciation(new Date('2022-01-01'), new Date())

    expect(result.source).toBe('fallback')
    expect(typeof result.appreciation).toBe('number')
  })

  it('BCRA API devuelve respuesta vacía → source=fallback', async () => {
    const axios = (await import('axios')).default
    axios.get = vi.fn().mockResolvedValue({ data: { status: 200, results: [] } })

    const { getDollarAppreciation } = await import('../../../src/backtest/dollarBenchmark.js')
    const result = await getDollarAppreciation(new Date('2022-01-01'), new Date())

    expect(result.source).toBe('fallback')
    expect(typeof result.appreciation).toBe('number')
  })

  it('appreciation siempre es un número finito, nunca NaN ni undefined', async () => {
    const axios = (await import('axios')).default
    axios.get = vi.fn().mockRejectedValue(new Error('timeout'))

    const { getDollarAppreciation } = await import('../../../src/backtest/dollarBenchmark.js')
    const result = await getDollarAppreciation(new Date('2022-01-01'), new Date())

    expect(typeof result.appreciation).toBe('number')
    expect(isNaN(result.appreciation)).toBe(false)
    expect(isFinite(result.appreciation)).toBe(true)
  })
})
