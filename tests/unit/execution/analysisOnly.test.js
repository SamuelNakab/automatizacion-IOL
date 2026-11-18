import { describe, it, expect, vi } from 'vitest'

vi.mock('axios', () => ({ default: { post: vi.fn(), get: vi.fn(), delete: vi.fn() } }))
vi.mock('../../../src/auth/tokenManager.js', () => ({ getAuthHeaders: vi.fn().mockResolvedValue({}) }))
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('Modo SOLO ANÁLISIS', () => {
  it('ANALYSIS_ONLY está activado', async () => {
    const { ANALYSIS_ONLY } = await import('../../../src/shared/constants.js')
    expect(ANALYSIS_ONLY).toBe(true)
  })

  it('nunca envía órdenes de compra, venta ni cancelaciones a IOL', async () => {
    const axios = (await import('axios')).default
    const client = await import('../../../src/execution/iolOrderClient.js')
    await expect(client.sendBuyOrder({})).rejects.toThrow(/solo análisis/)
    await expect(client.sendSellOrder({})).rejects.toThrow(/solo análisis/)
    await expect(client.cancelOrder('1')).rejects.toThrow(/solo análisis/)
    expect(axios.post).not.toHaveBeenCalled()
    expect(axios.delete).not.toHaveBeenCalled()
  })
})
