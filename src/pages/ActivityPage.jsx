import { useEffect, useState } from 'react'
import { apiService } from '../utils/api'
import { notifyError } from '../utils/toast'
import { formatDate } from '../utils/format'
import ApiPagination from '../components/ApiPagination'

export default function ActivityPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const loadData = async () => {
    try {
      setLoading(true)
      const { data } = await apiService.getActivity({ page, limit })
      setRows(data.data)
      setTotalPages(data.meta?.total_pages || 1)
      setTotalItems(data.meta?.total_items || 0)
      if (data.meta?.page && data.meta.page !== page) {
        setPage(data.meta.page)
      }
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil activity')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, limit])

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-700 text-white">
          <tr>
            <th className="px-3 py-2 text-left">Waktu</th>
            <th className="px-3 py-2 text-left">Aksi</th>
            <th className="px-3 py-2 text-left">Detail</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
                Memuat data...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-center text-slate-500" colSpan={3}>
                Belum ada activity.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                <td className="px-3 py-2">
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium">{row.action}</span>
                </td>
                <td className="px-3 py-2">{row.details}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <ApiPagination
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        limit={limit}
        loading={loading}
        onPageChange={(nextPage) => setPage(nextPage)}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit)
          setPage(1)
        }}
      />
    </div>
  )
}
