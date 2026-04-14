export const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID')

export const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  })

export const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID')
}
