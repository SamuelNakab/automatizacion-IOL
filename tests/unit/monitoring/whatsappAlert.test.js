import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('twilio', () => {
  const mockCreate = vi.fn()
  const mockClient = { messages: { create: mockCreate } }
  return { default: vi.fn().mockReturnValue(mockClient) }
})
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('whatsappAlert', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_WHATSAPP_FROM
    delete process.env.TWILIO_WHATSAPP_TO
  })

  it('sin variables configuradas → sendAlert retorna sin llamar Twilio', async () => {
    const twilio = (await import('twilio')).default
    const { sendAlert } = await import('../../../src/monitoring/whatsappAlert.js')

    await sendAlert('BUY_SIGNAL', { symbol: 'GGAL', price: 100, score: 7, confidence: 78, signals: [] })

    const mockClient = twilio.mock.results[0]?.value
    if (mockClient) {
      expect(mockClient.messages.create).not.toHaveBeenCalled()
    }
    // No error thrown
  })

  it('con variables y Twilio exitoso → messages.create llamado', async () => {
    process.env.TWILIO_ACCOUNT_SID   = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN    = 'token123'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
    process.env.TWILIO_WHATSAPP_TO   = 'whatsapp:+5491100000000'

    const twilio = (await import('twilio')).default
    const mockClient = { messages: { create: vi.fn().mockResolvedValue({ sid: 'SM123' }) } }
    twilio.mockReturnValue(mockClient)

    const { sendAlert } = await import('../../../src/monitoring/whatsappAlert.js')
    await sendAlert('BUY_SIGNAL', { symbol: 'GGAL', price: 100, score: 7, confidence: 78, signals: ['RSI bajo'] })

    expect(mockClient.messages.create).toHaveBeenCalledTimes(1)
    expect(mockClient.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'whatsapp:+14155238886', to: 'whatsapp:+5491100000000' })
    )
  })

  it('con Twilio fallando → NO lanza error, logger.error llamado', async () => {
    process.env.TWILIO_ACCOUNT_SID   = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN    = 'token123'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
    process.env.TWILIO_WHATSAPP_TO   = 'whatsapp:+5491100000000'

    const twilio = (await import('twilio')).default
    const mockClient = { messages: { create: vi.fn().mockRejectedValue(new Error('Twilio down')) } }
    twilio.mockReturnValue(mockClient)
    const logger = (await import('../../../src/shared/logger.js')).default

    const { sendAlert } = await import('../../../src/monitoring/whatsappAlert.js')
    await expect(sendAlert('BUY_SIGNAL', { symbol: 'GGAL', price: 100, score: 7, confidence: 78, signals: [] })).resolves.not.toThrow()
    expect(logger.error).toHaveBeenCalledWith('Error enviando WhatsApp', expect.objectContaining({ error: 'Twilio down' }))
  })

  it('BUY_SIGNAL: body contiene symbol, confidence y score', async () => {
    process.env.TWILIO_ACCOUNT_SID   = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN    = 'token123'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
    process.env.TWILIO_WHATSAPP_TO   = 'whatsapp:+5491100000000'

    const twilio = (await import('twilio')).default
    const mockCreate = vi.fn().mockResolvedValue({})
    twilio.mockReturnValue({ messages: { create: mockCreate } })

    const { sendAlert } = await import('../../../src/monitoring/whatsappAlert.js')
    await sendAlert('BUY_SIGNAL', { symbol: 'GGAL', price: 123.45, score: 7, confidence: 78, signals: ['RSI bajo', 'Bollinger'] })

    const body = mockCreate.mock.calls[0][0].body
    expect(body).toContain('GGAL')
    expect(body).toContain('78%')
    expect(body).toContain('7/9')
  })

  it('SELL_EXECUTED: body contiene gainPct con formato correcto', async () => {
    process.env.TWILIO_ACCOUNT_SID   = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN    = 'token123'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
    process.env.TWILIO_WHATSAPP_TO   = 'whatsapp:+5491100000000'

    const twilio = (await import('twilio')).default
    const mockCreate = vi.fn().mockResolvedValue({})
    twilio.mockReturnValue({ messages: { create: mockCreate } })

    const { sendAlert } = await import('../../../src/monitoring/whatsappAlert.js')
    await sendAlert('SELL_EXECUTED', { symbol: 'BBAR', sellPrice: 540, buyPrice: 500, gainPct: '8.00' })

    const body = mockCreate.mock.calls[0][0].body
    expect(body).toContain('BBAR')
    expect(body).toContain('8.00%')
    expect(body).toContain('500')
    expect(body).toContain('540')
  })
})
