import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios');
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('tokenManager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.IOL_USERNAME = 'testuser';
    process.env.IOL_PASSWORD = 'testpass';
    process.env.IOL_BASE_URL = 'https://api.test.com';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('obtiene token en el primer llamado usando grant_type=password', async () => {
    const { default: axios } = await import('axios');
    axios.post.mockResolvedValueOnce({
      data: { access_token: 'token123', refresh_token: 'refresh123' },
    });

    const { getAuthHeaders } = await import('../../../src/auth/tokenManager.js');
    const headers = await getAuthHeaders();

    expect(headers).toEqual({ Authorization: 'Bearer token123' });
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = axios.post.mock.calls[0];
    expect(url).toBe('https://api.test.com/token');
    expect(body).toContain('grant_type=password');
    expect(body).toContain('username=testuser');
  });

  it('reutiliza el token si no expiró (no llama a /token en el segundo llamado)', async () => {
    const { default: axios } = await import('axios');
    axios.post.mockResolvedValue({
      data: { access_token: 'token123', refresh_token: 'refresh123' },
    });

    const { getAuthHeaders } = await import('../../../src/auth/tokenManager.js');
    await getAuthHeaders();
    const headers = await getAuthHeaders();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(headers).toEqual({ Authorization: 'Bearer token123' });
  });

  it('renueva usando refresh_token después de 12 minutos', async () => {
    vi.useFakeTimers();
    const startTime = Date.now();

    const { default: axios } = await import('axios');
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'token1', refresh_token: 'refresh1' } })
      .mockResolvedValueOnce({ data: { access_token: 'token2', refresh_token: 'refresh2' } });

    const { getAuthHeaders } = await import('../../../src/auth/tokenManager.js');

    await getAuthHeaders();
    expect(axios.post).toHaveBeenCalledTimes(1);

    // Avanzar 12 minutos + 1 segundo para cruzar el umbral de renovación
    vi.setSystemTime(startTime + 12 * 60 * 1000 + 1000);

    const headers = await getAuthHeaders();

    expect(headers).toEqual({ Authorization: 'Bearer token2' });
    expect(axios.post).toHaveBeenCalledTimes(2);
    const [, body] = axios.post.mock.calls[1];
    expect(body).toContain('grant_type=refresh_token');
    expect(body).toContain('refresh_token=refresh1');
  });

  it('fallback a credenciales si la renovación con refresh_token falla', async () => {
    vi.useFakeTimers();
    const startTime = Date.now();

    const { default: axios } = await import('axios');
    axios.post
      .mockResolvedValueOnce({ data: { access_token: 'token1', refresh_token: 'refresh1' } })
      .mockRejectedValueOnce(new Error('refresh inválido'))
      .mockResolvedValueOnce({ data: { access_token: 'token3', refresh_token: 'refresh3' } });

    const { getAuthHeaders } = await import('../../../src/auth/tokenManager.js');
    await getAuthHeaders();

    vi.setSystemTime(startTime + 12 * 60 * 1000 + 1000);

    const headers = await getAuthHeaders();

    expect(headers).toEqual({ Authorization: 'Bearer token3' });
    expect(axios.post).toHaveBeenCalledTimes(3);
    // Tercer llamado debe ser con grant_type=password (fallback)
    const [, body] = axios.post.mock.calls[2];
    expect(body).toContain('grant_type=password');
  });
});
