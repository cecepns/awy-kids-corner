import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import AsyncSelect from 'react-select/async'
import { apiService } from '../utils/api'
import Modal from '../components/Modal'
import ApiPagination from '../components/ApiPagination'
import { confirmToast, notifyError, notifySuccess } from '../utils/toast'
import { formatCurrency, formatDate, formatNumber } from '../utils/format'

const initialForm = {
  product_id: '',
  quantity: 1,
  purchase_price: 0,
  reference_no: '',
  notes: '',
  transaction_date: new Date().toISOString().slice(0, 10),
}

const buildProductOption = (item) => ({
  value: item.id,
  label: `${item.code} - ${item.name} (stok: ${formatNumber(item.current_stock || 0)})`,
  stock: Number(item.current_stock || 0),
})

export default function IncomingPage({ products, onChanged }) {
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
  const [selectedProduct, setSelectedProduct] = useState(null)

  const defaultProductOptions = useMemo(
    () => products.slice(0, 20).map(buildProductOption),
    [products],
  )

  const loadData = async () => {
    try {
      setLoading(true)
      const { data } = await apiService.getIncoming({ search, page, limit })
      setRows(data.data)
      setTotalPages(data.meta?.total_pages || 1)
      setTotalItems(data.meta?.total_items || 0)
      if (data.meta?.page && data.meta.page !== page) {
        setPage(data.meta.page)
      }
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil data barang masuk')
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
    setSelectedProduct(null)
    setModalOpen(false)
  }

  const loadProductOptions = async (inputValue) => {
    try {
      const { data } = await apiService.getProducts({
        search: inputValue || '',
        page: 1,
        limit: 20,
      })
      return (data.data || []).map(buildProductOption)
    } catch {
      return []
    }
  }

  const submitForm = async (event) => {
    event.preventDefault()
    if (!form.product_id) {
      notifyError('Produk wajib dipilih')
      return
    }
    try {
      if (editing) {
        await apiService.updateIncoming(editing.id, form)
        notifySuccess('Data barang masuk berhasil diperbarui')
      } else {
        await apiService.createIncoming(form)
        notifySuccess('Barang masuk berhasil ditambahkan')
      }
      resetForm()
      await loadData()
      onChanged()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menyimpan barang masuk')
    }
  }

  const handleDelete = async (row) => {
    const accepted = await confirmToast(`Hapus transaksi barang masuk ${row.product_name}?`, 'Ya, hapus')
    if (!accepted) return

    try {
      await apiService.deleteIncoming(row.id)
      notifySuccess('Data barang masuk berhasil dihapus')
      await loadData()
      onChanged()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menghapus barang masuk')
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
              setSelectedProduct(null)
              setModalOpen(true)
            }}
          >
            <Plus size={16} />
            Tambah Barang Masuk
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-emerald-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Tanggal</th>
              <th className="px-3 py-2 text-left">Kode</th>
              <th className="px-3 py-2 text-left">Nama Produk</th>
              <th className="px-3 py-2 text-right">Jumlah</th>
              <th className="px-3 py-2 text-right">Harga Beli</th>
              <th className="px-3 py-2 text-right">Total Beli</th>
              <th className="px-3 py-2 text-left">Referensi</th>
              <th className="px-3 py-2 text-left">Catatan</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={9}>
                  Memuat data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={9}>
                  Data barang masuk belum ada.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{formatDate(row.transaction_date)}</td>
                  <td className="px-3 py-2">{row.product_code}</td>
                  <td className="px-3 py-2">{row.product_name}</td>
                  <td className="px-3 py-2 text-right font-medium text-emerald-700">
                    +{formatNumber(row.quantity)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrency(row.purchase_price)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.total_purchase)}</td>
                  <td className="px-3 py-2">{row.reference_no || '-'}</td>
                  <td className="px-3 py-2">{row.notes || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded p-1 text-sky-700 hover:bg-sky-50"
                        onClick={() => {
                          setEditing(row)
                          const matchedProduct = products.find((item) => Number(item.id) === Number(row.product_id))
                          setForm({
                            product_id: row.product_id,
                            quantity: row.quantity,
                            purchase_price: Number(row.purchase_price || 0),
                            reference_no: row.reference_no || '',
                            notes: row.notes || '',
                            transaction_date: row.transaction_date?.slice(0, 10),
                          })
                          setSelectedProduct(
                            matchedProduct
                              ? buildProductOption(matchedProduct)
                              : {
                                  value: row.product_id,
                                  label: `${row.product_code} - ${row.product_name}`,
                                  stock: 0,
                                },
                          )
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
        title={editing ? 'Edit Barang Masuk' : 'Tambah Barang Masuk'}
        isOpen={modalOpen}
        onClose={resetForm}
      >
        <form className="space-y-3" onSubmit={submitForm}>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Produk</label>
            <AsyncSelect
              cacheOptions
              defaultOptions={defaultProductOptions}
              loadOptions={loadProductOptions}
              placeholder="Cari produk..."
              value={selectedProduct}
              onChange={(option) => {
                setSelectedProduct(option || null)
                setForm({ ...form, product_id: option?.value || '' })
              }}
              noOptionsMessage={() => 'Produk tidak ditemukan'}
            />
            {selectedProduct ? (
              <p className="mt-1 text-xs text-slate-500">Stok saat ini: {formatNumber(selectedProduct.stock)}</p>
            ) : null}
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
              <label className="mb-1 block text-xs text-slate-500">Harga Beli</label>
              <input
                type="number"
                className="input"
                min="0"
                value={form.purchase_price}
                onChange={(event) => setForm({ ...form, purchase_price: event.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Total Beli</label>
              <input
                type="text"
                className="input bg-slate-50"
                value={formatCurrency(Number(form.quantity || 0) * Number(form.purchase_price || 0))}
                readOnly
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
