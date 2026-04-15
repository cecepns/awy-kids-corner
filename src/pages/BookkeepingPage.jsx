import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { apiService } from '../utils/api'
import Modal from '../components/Modal'
import ApiPagination from '../components/ApiPagination'
import { notifyError, notifySuccess } from '../utils/toast'
import { formatCurrency, formatDate, formatNumber } from '../utils/format'

const initialForm = {
  outgoing_id: '',
  product_id: '',
  selling_price: 0,
  discount: 0,
}

export default function BookkeepingPage({ onChanged }) {
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [costPreview, setCostPreview] = useState({ average_purchase_price: 0 })
  const [loadingCostPreview, setLoadingCostPreview] = useState(false)

  const loadCostPreview = async (productId) => {
    if (!productId) {
      setCostPreview({ average_purchase_price: 0 })
      return
    }
    try {
      setLoadingCostPreview(true)
      const { data } = await apiService.getProductCost(productId)
      setCostPreview(data)
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil ringkasan harga beli')
      setCostPreview({ average_purchase_price: 0 })
    } finally {
      setLoadingCostPreview(false)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const { data } = await apiService.getBookkeeping({ page, limit })
      setRows(data.data)
      setStats(data.stats)
      setTotalPages(data.meta?.total_pages || 1)
      setTotalItems(data.meta?.total_items || 0)
      if (data.meta?.page && data.meta.page !== page) {
        setPage(data.meta.page)
      }
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil data pembukuan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, limit])

  useEffect(() => {
    if (modalOpen && form.product_id) {
      loadCostPreview(form.product_id)
    }
  }, [modalOpen, form.product_id])

  const closeModal = () => {
    setModalOpen(false)
    setForm(initialForm)
    setCostPreview({ average_purchase_price: 0 })
  }

  const submitUpdate = async (event) => {
    event.preventDefault()
    try {
      await apiService.updateBookkeeping({
        outgoing_id: form.outgoing_id,
        selling_price: form.selling_price,
        discount: form.discount,
      })
      notifySuccess('Pembukuan berhasil diperbarui')
      closeModal()
      await loadData()
      onChanged()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal memperbarui pembukuan')
    }
  }

  return (
    <div className="space-y-4">
      {stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <p className="text-xs text-slate-500">Total Transaksi</p>
            <p className="text-xl font-bold text-slate-800">{formatNumber(stats.total_transactions)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Total Omzet</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.total_revenue)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Total Margin</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(stats.total_margin)}</p>
          </div>
        </div>
      ) : null}

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-indigo-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Tanggal</th>
              <th className="px-3 py-2 text-left">Produk</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Harga Beli</th>
              <th className="px-3 py-2 text-right">Harga Jual</th>
              <th className="px-3 py-2 text-right">Diskon</th>
              <th className="px-3 py-2 text-right">Margin</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={8}>
                  Memuat data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={8}>
                  Belum ada data pembukuan.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{formatDate(row.transaction_date)}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{row.product_name}</p>
                    <p className="text-xs text-slate-500">{row.product_code}</p>
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(row.quantity)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.purchase_price)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.selling_price)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.discount)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.margin)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <button
                        className="rounded p-1 text-sky-700 hover:bg-sky-50"
                        onClick={() => {
                          setForm({
                            outgoing_id: row.id,
                            product_id: row.product_id,
                            selling_price: row.selling_price || 0,
                            discount: row.discount || 0,
                          })
                          setCostPreview({ average_purchase_price: 0 })
                          setModalOpen(true)
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
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

      <Modal title="Edit Pembukuan" isOpen={modalOpen} onClose={closeModal} maxWidth="max-w-md">
        <form className="space-y-3" onSubmit={submitUpdate}>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Harga Beli (otomatis)</label>
            <input
              type="text"
              className="input bg-slate-50"
              value={
                loadingCostPreview
                  ? 'Menghitung...'
                  : formatCurrency(Number(costPreview.average_purchase_price || 0))
              }
              readOnly
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Harga Jual</label>
            <input
              type="number"
              className="input"
              min="0"
              value={form.selling_price}
              onChange={(event) => setForm({ ...form, selling_price: Number(event.target.value) })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Diskon per Item</label>
            <input
              type="number"
              className="input"
              min="0"
              value={form.discount}
              onChange={(event) => setForm({ ...form, discount: Number(event.target.value) })}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Batal
            </button>
            <button className="btn-primary" type="submit">
              Simpan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
