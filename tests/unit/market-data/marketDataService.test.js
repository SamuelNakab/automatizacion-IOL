import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/market-data/iolClient.js');
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('marketDataService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('getQuote', () => {
    it('normaliza correctamente los campos estándar de IOL', async () => {
      const { get } = await import('../../../src/market-data/iolClient.js');
      get.mockResolvedValueOnce({
        ultimoPrecio: 1234.56,
        apertura: 1200.0,
        maximo: 1250.0,
        minimo: 1190.0,
        volumenNominal: 500000,
        fechaHora: '2024-01-15T10:30:00',
      });

      const { getQuote } = await import('../../../src/market-data/marketDataService.js');
      const quote = await getQuote('GGAL', 'bCBA');

      expect(quote).toEqual({
        symbol: 'GGAL',
        market: 'bCBA',
        price: 1234.56,
        open: 1200.0,
        high: 1250.0,
        low: 1190.0,
        volume: 500000,
        timestamp: '2024-01-15T10:30:00',
      });
    });

    it('normaliza correctamente con nombres de campos alternativos de IOL', async () => {
      const { get } = await import('../../../src/market-data/iolClient.js');
      get.mockResolvedValueOnce({
        ultimo: 500.0,     // campo alternativo para price
        apertura: 490.0,
        maximo: 510.0,
        minimo: 488.0,
        volumen: 100000,   // campo alternativo para volume
        fecha: '2024-01-15',
      });

      const { getQuote } = await import('../../../src/market-data/marketDataService.js');
      const quote = await getQuote('YPFD', 'bCBA');

      expect(quote.symbol).toBe('YPFD');
      expect(quote.market).toBe('bCBA');
      expect(quote.price).toBe(500.0);
      expect(quote.volume).toBe(100000);
      expect(quote.timestamp).toBe('2024-01-15');
    });

    it('produce null en campos ausentes en lugar de undefined o error', async () => {
      const { get } = await import('../../../src/market-data/iolClient.js');
      get.mockResolvedValueOnce({
        ultimoPrecio: 300.0,
        // sin apertura, maximo, minimo, volumen, fechaHora
      });

      const { getQuote } = await import('../../../src/market-data/marketDataService.js');
      const quote = await getQuote('GD35', 'bCBA');

      expect(quote.price).toBe(300.0);
      expect(quote.open).toBeNull();
      expect(quote.high).toBeNull();
      expect(quote.low).toBeNull();
      expect(quote.volume).toBeNull();
      expect(quote.timestamp).toBeTruthy(); // fallback a new Date()
    });

    it('llama al endpoint correcto de IOL', async () => {
      const { get } = await import('../../../src/market-data/iolClient.js');
      get.mockResolvedValueOnce({ ultimoPrecio: 100, fechaHora: '2024-01-15T10:00:00' });

      const { getQuote } = await import('../../../src/market-data/marketDataService.js');
      await getQuote('GGAL', 'bCBA');

      expect(get).toHaveBeenCalledWith('/api/v2/bCBA/Titulos/GGAL/Cotizacion');
    });
  });

  describe('getHistoricalSeries', () => {
    it('normaliza una serie histórica recibida como array', async () => {
      const { get } = await import('../../../src/market-data/iolClient.js');
      get.mockResolvedValueOnce([
        { ultimoPrecio: 100, apertura: 98, maximo: 102, minimo: 97, volumenNominal: 10000, fechaHora: '2024-01-10T17:00:00' },
        { ultimoPrecio: 105, apertura: 101, maximo: 106, minimo: 100, volumenNominal: 12000, fechaHora: '2024-01-11T17:00:00' },
      ]);

      const { getHistoricalSeries } = await import('../../../src/market-data/marketDataService.js');
      const series = await getHistoricalSeries('GGAL', 'bCBA', '2024-01-10', '2024-01-11');

      expect(series).toHaveLength(2);
      expect(series[0]).toEqual({
        price: 100, open: 98, high: 102, low: 97, volume: 10000, timestamp: '2024-01-10T17:00:00',
      });
      expect(series[1].price).toBe(105);
    });

    it('llama al endpoint correcto de serie histórica', async () => {
      const { get } = await import('../../../src/market-data/iolClient.js');
      get.mockResolvedValueOnce([]);

      const { getHistoricalSeries } = await import('../../../src/market-data/marketDataService.js');
      await getHistoricalSeries('GGAL', 'bCBA', '2024-01-01', '2024-01-31');

      expect(get).toHaveBeenCalledWith(
        '/api/v2/bCBA/Titulos/GGAL/Cotizacion/seriehistorica/2024-01-01/2024-01-31/ajustada'
      );
    });
  });
});
