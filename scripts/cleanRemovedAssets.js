import 'dotenv/config'
import prisma  from '../src/persistence/prismaClient.js'
import logger  from '../src/shared/logger.js'

const SYMBOLS_TO_REMOVE = ['ALUA','CRES','MIRG','TXAR']

async function main() {
  const symbolList = SYMBOLS_TO_REMOVE.map(s => `'${s}'`).join(',')

  const [phRows, ptRows, decRows, ordRows, posRows, assetRows] = await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `DELETE FROM price_history WHERE asset_id IN (SELECT id FROM assets WHERE symbol IN (${symbolList}))`
    ),
    prisma.$executeRawUnsafe(
      `DELETE FROM price_ticks WHERE asset_id IN (SELECT id FROM assets WHERE symbol IN (${symbolList}))`
    ),
    prisma.$executeRawUnsafe(
      `DELETE FROM decisions WHERE asset_id IN (SELECT id FROM assets WHERE symbol IN (${symbolList}))`
    ),
    prisma.$executeRawUnsafe(
      `DELETE FROM orders WHERE asset_id IN (SELECT id FROM assets WHERE symbol IN (${symbolList}))`
    ),
    prisma.$executeRawUnsafe(
      `DELETE FROM positions WHERE asset_id IN (SELECT id FROM assets WHERE symbol IN (${symbolList}))`
    ),
    prisma.$executeRawUnsafe(
      `DELETE FROM assets WHERE symbol IN (${symbolList})`
    ),
  ])

  logger.info('Limpieza completada', {
    price_history: phRows,
    price_ticks:   ptRows,
    decisions:     decRows,
    orders:        ordRows,
    positions:     posRows,
    assets:        assetRows,
  })
}

main()
  .catch(err => { logger.error('Error en limpieza', { error: err.message }); process.exit(1) })
  .finally(() => prisma.$disconnect())
