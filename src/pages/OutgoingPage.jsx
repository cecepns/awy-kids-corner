import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { apiService } from '../utils/api'
import Modal from '../components/Modal'
import ApiPagination from '../components/ApiPagination'
import { confirmToast, notifyError, notifySuccess } from '../utils/toast'
import { formatCurrency, formatDate, formatNumber } from '../utils/format'

const initialForm = {
  product_id: '',
  quantity: 1,
  selling_price: 0,
  reference_no: '',
  notes: '',
  transaction_date: new Date().toISOString().slice(0, 10),
}

export default function OutgoingPage({ products, onChanged }) {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [costPreview, setCostPreview] = useState({ average_purchase_price: 0 })
  const [loadingCostPreview, setLoadingCostPreview] = useState(false)

  const summary = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.totalPurchase += Number(row.total_purchase || 0)
          acc.totalSelling += Number(row.total_selling || 0)
          return acc
        },
        { totalPurchase: 0, totalSelling: 0 },
      ),
    [rows],
  )

  const loadData = async () => {
    try {
      setLoading(true)
      const { data } = await apiService.getOutgoing({ search, page, limit })
      setRows(data.data)
      setTotalPages(data.meta?.total_pages || 1)
      setTotalItems(data.meta?.total_items || 0)
      if (data.meta?.page && data.meta.page !== page) {
        setPage(data.meta.page)
      }
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil data barang keluar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [search, page, limit])

  const resetForm = () => {
    setEditing(null)
    setForm(initialForm)
    setCostPreview({ average_purchase_price: 0 })
    setModalOpen(false)
  }

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
      notifyError(error.response?.data?.message || 'Gagal mengambil ringkasan harga modal')
      setCostPreview({ average_purchase_price: 0 })
    } finally {
      setLoadingCostPreview(false)
    }
  }

  useEffect(() => {
    if (modalOpen) {
      loadCostPreview(form.product_id)
    }
  }, [form.product_id, modalOpen])

  const submitForm = async (event) => {
    event.preventDefault()
    try {
      if (editing) {
        await apiService.updateOutgoing(editing.id, form)
        notifySuccess('Data barang keluar berhasil diperbarui')
      } else {
        await apiService.createOutgoing(form)
        notifySuccess('Barang keluar berhasil ditambahkan')
      }
      resetForm()
      await loadData()
      onChanged()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menyimpan barang keluar')
    }
  }

  const handleDelete = async (row) => {
    const accepted = await confirmToast(`Hapus transaksi barang keluar ${row.product_name}?`, 'Ya, hapus')
    if (!accepted) return

    try {
      await apiService.deleteOutgoing(row.id)
      notifySuccess('Data barang keluar berhasil dihapus')
      await loadData()
      onChanged()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menghapus barang keluar')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="input sm:w-80"
            placeholder="Cari transaksi..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null)
              setForm(initialForm)
              setCostPreview({ average_purchase_price: 0 })
              setModalOpen(true)
            }}
          >
            <Plus size={16} />
            Tambah Barang Keluar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card p-4">
          <p className="text-xs text-slate-500">Total Modal (halaman ini)</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalPurchase)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-500">Total Penjualan (halaman ini)</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(summary.totalSelling)}</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-amber-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Tanggal</th>
              <th className="px-3 py-2 text-left">Kode</th>
              <th className="px-3 py-2 text-left">Nama Produk</th>
              <th className="px-3 py-2 text-right">Jumlah</th>
              <th className="px-3 py-2 text-right">Harga Modal</th>
              <th className="px-3 py-2 text-right">Harga Jual</th>
              <th className="px-3 py-2 text-right">Total Modal</th>
              <th className="px-3 py-2 text-right">Total Jual</th>
              <th className="px-3 py-2 text-left">Referensi</th>
              <th className="px-3 py-2 text-left">Catatan</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={11}>
                  Memuat data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={11}>
                  Data barang keluar belum ada.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{formatDate(row.transaction_date)}</td>
                  <td className="px-3 py-2">{row.product_code}</td>
                  <td className="px-3 py-2">{row.product_name}</td>
                  <td className="px-3 py-2 text-right font-medium text-amber-700">
                    -{formatNumber(row.quantity)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.purchase_price)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.selling_price)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.total_purchase)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.total_selling)}</td>
                  <td className="px-3 py-2">{row.reference_no || '-'}</td>
                  <td className="px-3 py-2">{row.notes || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded p-1 text-sky-700 hover:bg-sky-50"
                        onClick={() => {
                          setEditing(row)
                          setForm({
                            product_id: row.product_id,
                            quantity: row.quantity,
                            selling_price: Number(row.selling_price || 0),
                            reference_no: row.reference_no || '',
                            notes: row.notes || '',
                            transaction_date: row.transaction_date?.slice(0, 10),
                          })
                          setModalOpen(true)
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="rounded p-1 text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDelete(row)}
                      >
                        <Trash2 size={16} />
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

      <Modal
        title={editing ? 'Edit Barang Keluar' : 'Tambah Barang Keluar'}
        isOpen={modalOpen}
        onClose={resetForm}
      >
        <form className="space-y-3" onSubmit={submitForm}>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Produk</label>
            <select
              className="input"
              value={form.product_id}
              onChange={(event) => setForm({ ...form, product_id: event.target.value })}
              required
            >
              <option value="">Pilih produk</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name} (stok: {item.current_stock})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Tanggal</label>
              <input
                type="date"
                className="input"
                value={form.transaction_date}
                onChange={(event) => setForm({ ...form, transaction_date: event.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Jumlah</label>
              <input
                type="number"
                className="input"
                min="1"
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Harga Modal (otomatis)</label>
              <input
                type="text"
                className="input bg-slate-50"
                value={
                  loadingCostPreview ? 'Menghitung...' : formatCurrency(Number(costPreview.average_purchase_price || 0))
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
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nomor Referensi / Resi</label>
            <input
              className="input"
              value={form.reference_no}
              onChange={(event) => setForm({ ...form, reference_no: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Catatan</label>
            <textarea
              className="input min-h-20"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={resetForm}>
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
