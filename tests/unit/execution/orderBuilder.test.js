import { describe, it, expect } from 'vitest'
import { buildBuyOrder, buildSellOrder } from '../../../src/execution/orderBuilder.js'

describe('buildBuyOrder', () => {
  it('retorna objeto con todos los campos correctos para datos válidos', () => {
    const order = buildBuyOrder('GGAL', 'bCBA', 10, 1250.50)
    expect(order).toEqual({
      mercado: 'bCBA',
      simbolo: 'GGAL',
      cantidad: 10,
      precio:   1250.50,
      plazo:    't2',
      validez:  'HOY',
    })
  })

  it('acepta plazo personalizado', () => {
    const order = buildBuyOrder('GGAL', 'bCBA', 5, 100, 't0')
    expect(order.plazo).toBe('t0')
  })

  it('lanza Error si quantity es 0', () => {
    expect(() => buildBuyOrder('GGAL', 'bCBA', 0, 100)).toThrow()
  })

  it('lanza Error si quantity es negativo', () => {
    expect(() => buildBuyOrder('GGAL', 'bCBA', -1, 100)).toThrow()
  })

  it('lanza Error si quantity no es entero', () => {
    expect(() => buildBuyOrder('GGAL', 'bCBA', 1.5, 100)).toThrow()
  })

  it('lanza Error si price es negativo', () => {
    expect(() => buildBuyOrder('GGAL', 'bCBA', 1, -50)).toThrow()
  })

  it('lanza Error si price es 0', () => {
    expect(() => buildBuyOrder('GGAL', 'bCBA', 1, 0)).toThrow()
  })

  it('lanza Error si symbol es vacío', () => {
    expect(() => buildBuyOrder('', 'bCBA', 1, 100)).toThrow()
  })

  it('lanza Error si market es vacío', () => {
    expect(() => buildBuyOrder('GGAL', '', 1, 100)).toThrow()
  })
})

describe('buildSellOrder', () => {
  it('retorna objeto con todos los campos correctos para datos válidos', () => {
    const order = buildSellOrder('YPFD', 'bCBA', 5, 63500)
    expect(order).toEqual({
      mercado: 'bCBA',
      simbolo: 'YPFD',
      cantidad: 5,
      precio:   63500,
      plazo:    't2',
      validez:  'HOY',
    })
  })

  it('lanza Error si quantity es 0', () => {
    expect(() => buildSellOrder('YPFD', 'bCBA', 0, 100)).toThrow()
  })

  it('lanza Error si price es negativo', () => {
    expect(() => buildSellOrder('YPFD', 'bCBA', 1, -100)).toThrow()
  })
})
