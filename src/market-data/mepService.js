import axios from 'axios'

function todayDDMMYYYY() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export async function fetchMepToday() {
  try {
    const hoy = todayDDMMYYYY()
    const url = `https://mercados.ambito.com/dolar/mep/historico-general/${hoy}/${hoy}`
    const { data } = await axios.get(url, { timeout: 10000 })

    const rows = Array.isArray(data) ? data : []
    if (rows.length === 0) return null

    // Cada elemento es [fecha, valorStr]; omitir el encabezado si data[0][0] === 'Fecha'
    const dataRows = rows[0][0] === 'Fecha' ? rows.slice(1) : rows
    if (dataRows.length === 0) return null

    const valorStr = dataRows[0][1]
    if (!valorStr) return null

    const parsed = parseFloat(String(valorStr).replace(/\./g, '').replace(',', '.'))
    return isNaN(parsed) ? null : parsed
  } catch {
    return null
  }
}
