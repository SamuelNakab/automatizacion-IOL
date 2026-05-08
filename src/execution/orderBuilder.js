// Módulo puro: construye el JSON de orden para la API de IOL.
// Sin efectos secundarios, sin imports externos.

function validate(symbol, market, quantity, price) {
  if (!symbol || typeof symbol !== 'string') throw new Error('symbol debe ser string no vacío')
  if (!market || typeof market !== 'string') throw new Error('market debe ser string no vacío')
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('quantity debe ser entero positivo >= 1')
  if (typeof price !== 'number' || price <= 0) throw new Error('price debe ser número positivo')
}

export function buildBuyOrder(symbol, market, quantity, price, plazo = 't2') {
  validate(symbol, market, quantity, price)
  return { mercado: market, simbolo: symbol, cantidad: quantity, precio: price, plazo, validez: 'HOY' }
}

export function buildSellOrder(symbol, market, quantity, price, plazo = 't2') {
  validate(symbol, market, quantity, price)
  return { mercado: market, simbolo: symbol, cantidad: quantity, precio: price, plazo, validez: 'HOY' }
}
