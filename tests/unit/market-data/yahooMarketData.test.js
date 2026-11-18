import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => ({ default: { get: vi.fn() } }))
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const CHART = {
  chart: { result: [{
    meta: { regularMarketPrice: 4857.5, regularMarketDayHigh: 4900, regularMarketDayLow: 4677.5,
            regularMarketVolume: 2965907, regularMarketTime: 1794949194, gmtoffset: -10800 },
    timestamp: [1794834000, 1794920400],
    indicators: { quote: [{ open: [4800, 4742], high: [4900, 4900], low: [4700, 4677], close: [4742, null], volume: [100, 200] }] },
  }] },
}

describe('yahooMarketData', () => {
  beforeEach(() => { vi.resetModules(); vi.clearAllMocks() })

  it('pide el ticker con sufijo .BA y normaliza la cotización', async () => {
    const axios = (await import('axios')).default
    axios.get.mockResolvedValue({ data: CHART })
    const { getQuote } = await import('../../../src/market-data/yahooMarketData.js')
    const q = await getQuote('GGAL', 'bCBA')
    expect(axios.get.mock.calls[0][0]).toContain('GGAL.BA')
    expect(q).toMatchObject({ symbol: 'GGAL', market: 'bCBA', price: 4857.5, high: 4900, low: 4677.5, open: 4742 })
  })

  it('devuelve la serie histórica con fecha local y descarta cierres nulos', async () => {
    const axios = (await import('axios')).default
    axios.get.mockResolvedValue({ data: CHART })
    const { getHistoricalSeries } = await import('../../../src/market-data/yahooMarketData.js')
    const s = await getHistoricalSeries('GGAL', 'bCBA', '2026-11-15', '2026-11-17')
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ price: 4742, open: 4800, timestamp: '2026-11-16' })
  })
})
