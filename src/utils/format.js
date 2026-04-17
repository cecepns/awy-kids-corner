export const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID')

export const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })

/** Parse YYYY-MM-DD as local calendar date (hindari off-by-one timezone di DatePicker). */
export const parseCalendarDateInput = (value) => {
  if (!value) return null
  const dateOnly = String(value).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null
  const [y, m, d] = dateOnly.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export const formatCalendarDateInput = (date) => {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getTodayCalendarYMD = () => formatCalendarDateInput(new Date())

/** Bulan pertama untuk filter YYYY-MM (lokal). */
export const parseCalendarMonthInput = (value) => {
  if (!value) return null
  const s = String(value).trim().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(s)) return null
  const [y, m] = s.split('-').map(Number)
  if (!y || !m) return null
  return new Date(y, m - 1, 1)
}

export const formatCalendarMonthInput = (date) => {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export const formatDate = (value) => {
  if (!value) return '-'
  const s = String(value)
  const dateOnly = s.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [y, m, d] = dateOnly.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('id-ID')
  }
  return new Date(value).toLocaleDateString('id-ID')
}
