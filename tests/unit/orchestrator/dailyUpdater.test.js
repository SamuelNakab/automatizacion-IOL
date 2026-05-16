import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/persistence/assetRepository.js')
vi.mock('../../../src/persistence/priceHistoryRepository.js')
vi.mock('../../../src/market-data/marketDataService.js')
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const MOCK_ASSETS = [
  { id: 1, symbol: 'AAPL', market: 'bCBA' },
  { id: 2, symbol: 'MSFT', market: 'bCBA' },
  { id: 3, symbol: 'NVDA', market: 'bCBA' },
]

const MOCK_SERIES = [
  { price: 100, open: 98, high: 102, low: 97, volume: 1000, timestamp: '2026-05-10T00:00:00Z' },
  { price: 105, open: 100, high: 106, low: 99, volume: 1500, timestamp: '2026-05-11T00:00:00Z' },
]

describe('runDailyUpdate()', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('llama a getHistoricalSeries para cada activo activo', async () => {
    const { findAll }            = await import('../../../src/persistence/assetRepository.js')
    const { getHistoricalSeries } = await import('../../../src/market-data/marketDataService.js')
    const { bulkUpsert }         = await import('../../../src/persistence/priceHistoryRepository.js')

    findAll.mockResolvedValue(MOCK_ASSETS)
    getHistoricalSeries.mockResolvedValue(MOCK_SERIES)
    bulkUpsert.mockResolvedValue(2)

    const { runDailyUpdate } = await import('../../../src/orchestrator/dailyUpdater.js')
    await runDailyUpdate()

    expect(getHistoricalSeries).toHaveBeenCalledTimes(3)
    expect(getHistoricalSeries).toHaveBeenCalledWith('AAPL', 'bCBA', expect.any(String), expect.any(String))
    expect(getHistoricalSeries).toHaveBeenCalledWith('MSFT', 'bCBA', expect.any(String), expect.any(String))
    expect(getHistoricalSeries).toHaveBeenCalledWith('NVDA', 'bCBA', expect.any(String), expect.any(String))
  })

  it('si un activo falla, los demás se siguen procesando', async () => {
    const { findAll }            = await import('../../../src/persistence/assetRepository.js')
    const { getHistoricalSeries } = await import('../../../src/market-data/marketDataService.js')
    const { bulkUpsert }         = await import('../../../src/persistence/priceHistoryRepository.js')
    const logger                 = (await import('../../../src/shared/logger.js')).default

    findAll.mockResolvedValue(MOCK_ASSETS)
    getHistoricalSeries
      .mockRejectedValueOnce(new Error('IOL timeout'))
      .mockResolvedValue(MOCK_SERIES)
    bulkUpsert.mockResolvedValue(2)

    const { runDailyUpdate } = await import('../../../src/orchestrator/dailyUpdater.js')
    await runDailyUpdate()

    // AAPL falla, MSFT y NVDA se procesan igual
    expect(bulkUpsert).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenCalledWith(
      'Daily update falló para activo',
      expect.objectContaining({ symbol: 'AAPL', error: 'IOL timeout' }),
    )
  })

  it('bulkUpsert es llamado con las barras normalizadas correctamente', async () => {
    const { findAll }            = await import('../../../src/persistence/assetRepository.js')
    const { getHistoricalSeries } = await import('../../../src/market-data/marketDataService.js')
    const { bulkUpsert }         = await import('../../../src/persistence/priceHistoryRepository.js')

    findAll.mockResolvedValue([MOCK_ASSETS[0]])
    getHistoricalSeries.mockResolvedValue(MOCK_SERIES)
    bulkUpsert.mockResolvedValue(2)

    const { runDailyUpdate } = await import('../../../src/orchestrator/dailyUpdater.js')
    await runDailyUpdate()

    expect(bulkUpsert).toHaveBeenCalledTimes(1)
    const [assetId, bars] = bulkUpsert.mock.calls[0]
    expect(assetId).toBe(1)
    expect(bars).toHaveLength(2)
    expect(bars[0]).toMatchObject({
      date:  '2026-05-10',
      open:  98,
      high:  102,
      low:   97,
      close: 100,
    })
    expect(bars[1]).toMatchObject({
      date:  '2026-05-11',
      close: 105,
    })
  })
})
