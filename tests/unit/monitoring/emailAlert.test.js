import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn() },
}))
vi.mock('../../../src/shared/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const ENV_KEYS = ['ALERT_EMAIL_FROM', 'ALERT_EMAIL_TO', 'ALERT_EMAIL_PASSWORD', 'DASHBOARD_URL']

function setEmailEnv() {
  process.env.ALERT_EMAIL_FROM     = 'from@test.com'
  process.env.ALERT_EMAIL_TO       = 'to@test.com'
  process.env.ALERT_EMAIL_PASSWORD = 'testpassword'
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  ENV_KEYS.forEach(k => delete process.env[k])
})

afterEach(() => {
  ENV_KEYS.forEach(k => delete process.env[k])
})

describe('emailAlert — sin variables de entorno', () => {
  it('sendAlert() retorna sin llamar a createTransport ni sendMail', async () => {
    // No se setean variables de entorno
    const nodemailer = await import('nodemailer')
    nodemailer.default.createTransport.mockReturnValue({ sendMail: vi.fn() })

    const { sendAlert } = await import('../../../src/monitoring/emailAlert.js')
    await sendAlert('BOT_START', { dryRun: true, pollInterval: 30000, capital: 10000 })

    expect(nodemailer.default.createTransport).not.toHaveBeenCalled()
  })

  it('logger.warn es llamado indicando que las alertas están desactivadas', async () => {
    const { default: logger } = await import('../../../src/shared/logger.js')
    await import('../../../src/monitoring/emailAlert.js')

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('alertas desactivadas')
    )
  })
})

describe('emailAlert — con variables configuradas', () => {
  it('BOT_START llama a sendMail con subject que contiene "Bot iniciado"', async () => {
    setEmailEnv()
    const mockSendMail = vi.fn().mockResolvedValue({})
    const nodemailer   = await import('nodemailer')
    nodemailer.default.createTransport.mockReturnValue({ sendMail: mockSendMail })

    const { sendAlert } = await import('../../../src/monitoring/emailAlert.js')
    await sendAlert('BOT_START', { dryRun: true, pollInterval: 30000, capital: 10000 })

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Bot iniciado'),
        html:    expect.stringContaining('10000'),
      })
    )
  })

  it('ORDER_FILLED incluye symbol y side en subject, y precio y cantidad en html', async () => {
    setEmailEnv()
    const mockSendMail = vi.fn().mockResolvedValue({})
    const nodemailer   = await import('nodemailer')
    nodemailer.default.createTransport.mockReturnValue({ sendMail: mockSendMail })

    const { sendAlert } = await import('../../../src/monitoring/emailAlert.js')
    await sendAlert('ORDER_FILLED', { symbol: 'GGAL', side: 'compra', quantity: 10, price: 6300, pnl: 500 })

    const call = mockSendMail.mock.calls[0][0]
    expect(call.subject).toContain('GGAL')
    expect(call.subject).toContain('compra')
    expect(call.html).toContain('6300')
    expect(call.html).toContain('10')
  })

  it('DRAWDOWN_ALERT incluye porcentaje actual en subject y limit en html', async () => {
    setEmailEnv()
    const mockSendMail = vi.fn().mockResolvedValue({})
    const nodemailer   = await import('nodemailer')
    nodemailer.default.createTransport.mockReturnValue({ sendMail: mockSendMail })

    const { sendAlert } = await import('../../../src/monitoring/emailAlert.js')
    await sendAlert('DRAWDOWN_ALERT', { current: '18.50', limit: 15 })

    const call = mockSendMail.mock.calls[0][0]
    expect(call.subject).toContain('18.50')
    expect(call.html).toContain('18.50')
    expect(call.html).toContain('15')
  })

  it('cuando sendMail lanza error: NO relanza el error (lo silencia)', async () => {
    setEmailEnv()
    const mockSendMail = vi.fn().mockRejectedValue(new Error('SMTP auth failed'))
    const nodemailer   = await import('nodemailer')
    nodemailer.default.createTransport.mockReturnValue({ sendMail: mockSendMail })

    const { sendAlert } = await import('../../../src/monitoring/emailAlert.js')
    // No debe lanzar
    await expect(sendAlert('BOT_STOP', { reason: 'test' })).resolves.toBeUndefined()
  })

  it('cuando sendMail lanza error: logger.error es llamado con el mensaje', async () => {
    setEmailEnv()
    const mockSendMail = vi.fn().mockRejectedValue(new Error('connection timeout'))
    const nodemailer   = await import('nodemailer')
    nodemailer.default.createTransport.mockReturnValue({ sendMail: mockSendMail })

    const { default: logger } = await import('../../../src/shared/logger.js')
    const { sendAlert }       = await import('../../../src/monitoring/emailAlert.js')
    await sendAlert('CRITICAL_ERROR', { message: 'boom', context: 'runCycle' })

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('email alert'),
      expect.objectContaining({ error: 'connection timeout' })
    )
  })

  it('con DASHBOARD_URL seteado: el html incluye el link al dashboard', async () => {
    setEmailEnv()
    process.env.DASHBOARD_URL = 'https://mi-dashboard.vercel.app'

    const mockSendMail = vi.fn().mockResolvedValue({})
    const nodemailer   = await import('nodemailer')
    nodemailer.default.createTransport.mockReturnValue({ sendMail: mockSendMail })

    const { sendAlert } = await import('../../../src/monitoring/emailAlert.js')
    await sendAlert('BOT_START', { dryRun: true, pollInterval: 30000, capital: 50000 })

    const call = mockSendMail.mock.calls[0][0]
    expect(call.html).toContain('https://mi-dashboard.vercel.app')
  })
})
