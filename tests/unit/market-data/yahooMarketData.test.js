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

  it('devuelve la serie histórica con fecha local y completa la última sesión con regularMarketPrice', async () => {
    const axios = (await import('axios')).default
    axios.get.mockResolvedValue({ data: CHART })
    const { getHistoricalSeries } = await import('../../../src/market-data/yahooMarketData.js')
    const s = await getHistoricalSeries('GGAL', 'bCBA', '2026-11-15', '2026-11-17')
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ price: 4742, open: 4800, timestamp: '2026-11-16' })
    expect(s[1]).toMatchObject({ price: 4857.5, open: 4742, timestamp: '2026-11-17' })
  })

  it('descarta cierres nulos de días que no son la última sesión', async () => {
    const axios = (await import('axios')).default
    const chart = structuredClone(CHART)
    chart.chart.result[0].indicators.quote[0].close = [null, 4800]
    axios.get.mockResolvedValue({ data: chart })
    const { getHistoricalSeries } = await import('../../../src/market-data/yahooMarketData.js')
    const s = await getHistoricalSeries('GGAL', 'bCBA', '2026-11-15', '2026-11-17')
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ price: 4800, timestamp: '2026-11-17' })
  })
})
