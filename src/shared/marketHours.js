import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const TZ = 'America/Argentina/Buenos_Aires'

function getOpenClose() {
  return {
    openHour:  parseInt(process.env.MARKET_OPEN_HOUR  ?? '10'),
    closeHour: parseInt(process.env.MARKET_CLOSE_HOUR ?? '17'),
  }
}

export function isMarketOpen() {
  const { openHour, closeHour } = getOpenClose()
  const zoned = toZonedTime(new Date(), TZ)
  const day   = zoned.getDay()   // 0=Dom, 1=Lun, ..., 6=Sab
  const hour  = zoned.getHours()

  if (day === 0 || day === 6) return false  // fin de semana
  if (hour < openHour)         return false  // antes de la apertura
  if (hour >= closeHour)       return false  // después del cierre
  return true
}

export function getNextOpenTime() {
  const { openHour } = getOpenClose()
  const zonedNow = toZonedTime(new Date(), TZ)

  const candidate = new Date(zonedNow)
  candidate.setHours(openHour, 0, 0, 0)

  // Si hoy es día hábil y el horario de apertura todavía no pasó
  if (candidate > zonedNow && candidate.getDay() >= 1 && candidate.getDay() <= 5) {
    return fromZonedTime(candidate, TZ)
  }

  // Avanzar un día a la vez hasta el próximo día hábil
  do {
    candidate.setDate(candidate.getDate() + 1)
    candidate.setHours(openHour, 0, 0, 0)
  } while (candidate.getDay() === 0 || candidate.getDay() === 6)

  return fromZonedTime(candidate, TZ)
}

export function formatMarketStatus() {
  if (isMarketOpen()) return 'Mercado abierto'
  const next = getNextOpenTime()
  const formatted = next.toLocaleString('es-AR', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' })
  return `Mercado cerrado — próxima apertura: ${formatted}`
}
