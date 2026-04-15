import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Upload } from 'lucide-react'
import { apiService } from '../utils/api'
import Modal from '../components/Modal'
import ApiPagination from '../components/ApiPagination'
import { confirmToast, notifyError, notifySuccess } from '../utils/toast'
import { formatNumber } from '../utils/format'

const initialForm = {
  code: '',
  name: '',
  initial_stock: 0,
  category: '',
}

const createBulkRow = () => ({
  code: '',
  name: '',
  initial_stock: 0,
  category: '',
})

export default function ProductsPage({ onChanged }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [bulkRows, setBulkRows] = useState([createBulkRow()])
  const [form, setForm] = useState(initialForm)

  const loadProducts = async () => {
    try {
      setLoading(true)
      const { data } = await apiService.getProducts({ search, page, limit })
      setProducts(data.data)
      setTotalPages(data.meta?.total_pages || 1)
      setTotalItems(data.meta?.total_items || 0)
      if (data.meta?.page && data.meta.page !== page) {
        setPage(data.meta.page)
      }
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil data produk')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [search, page, limit])

  const resetForm = () => {
    setForm(initialForm)
    setEditing(null)
    setModalOpen(false)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      code: item.code,
      name: item.name,
      initial_stock: item.initial_stock,
      category: item.category,
    })
    setModalOpen(true)
  }

  const normalizeInitialStock = (value) => {
    if (value === '' || value === null || value === undefined) return 0
    const n = Number(value)
    return Number.isFinite(n) ? n : 0
  }

  const submitForm = async (event) => {
    event.preventDefault()
    try {
      const payload = { ...form, initial_stock: normalizeInitialStock(form.initial_stock) }
      if (editing) {
        await apiService.updateProduct(editing.id, payload)
        notifySuccess('Produk berhasil diperbarui')
      } else {
        await apiService.createProduct(payload)
        notifySuccess('Produk berhasil ditambahkan')
      }
      resetForm()
      await loadProducts()
      onChanged()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menyimpan data produk')
    }
  }

  const handleDelete = async (item) => {
    const accepted = await confirmToast(`Hapus produk ${item.name}?`, 'Ya, hapus')
    if (!accepted) return

    try {
      await apiService.deleteProduct(item.id)
      notifySuccess('Produk berhasil dihapus')
      await loadProducts()
      onChanged()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menghapus produk')
    }
  }

  const submitBulk = async () => {
    const filledRows = bulkRows.filter((row) => row.code || row.name)
    if (!filledRows.length) {
      notifyError('Isi minimal 1 data produk untuk bulk insert')
      return
    }

    const productsPayload = filledRows.map((row) => ({
      ...row,
      initial_stock: normalizeInitialStock(row.initial_stock),
    }))

    try {
      await apiService.bulkInsertProducts({ products: productsPayload })
      notifySuccess(`Bulk insert berhasil (${filledRows.length} data)`)
      setBulkOpen(false)
      setBulkRows([createBulkRow()])
      await loadProducts()
      onChanged()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Bulk insert gagal')
    }
  }

  const totalInitialValue = useMemo(
    () => products.reduce((total, item) => total + Number(item.initial_stock || 0), 0),
    [products],
  )

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="input sm:w-80"
            placeholder="Cari kode / nama produk..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                setBulkRows([createBulkRow()])
                setBulkOpen(true)
              }}
            >
              <Upload size={16} />
              Bulk Insert Form
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null)
                setForm(initialForm)
                setModalOpen(true)
              }}
            >
              <Plus size={16} />
              Tambah Produk
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-sky-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Kode</th>
              <th className="px-3 py-2 text-left">Nama Produk</th>
              <th className="px-3 py-2 text-right">Stok Awal</th>
              <th className="px-3 py-2 text-right">Stok Saat Ini</th>
              <th className="px-3 py-2 text-left">Kategori</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                  Memuat data...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                  Data produk belum ada.
                </td>
              </tr>
            ) : (
              products.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{item.code}</td>
                  <td className="px-3 py-2">{item.name}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(item.initial_stock)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatNumber(item.current_stock)}</td>
                  <td className="px-3 py-2">{item.category || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button className="rounded p-1 text-sky-700 hover:bg-sky-50" onClick={() => openEdit(item)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        className="rounded p-1 text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDelete(item)}
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

      <div className="card p-4">
        <p className="text-sm text-slate-600">
          Total stok awal: <span className="font-semibold">{formatNumber(totalInitialValue)}</span>
        </p>
      </div>

      <Modal
        title={editing ? 'Edit Produk' : 'Tambah Produk'}
        isOpen={modalOpen}
        onClose={resetForm}
        maxWidth="max-w-2xl"
      >
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submitForm}>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Kode Produk</label>
            <input
              className="input"
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nama Produk</label>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Kategori</label>
            <input
              className="input"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Stok Awal</label>
            <input
              type="number"
              className="input"
              min="0"
              value={form.initial_stock}
              onChange={(event) =>
                setForm({
                  ...form,
                  initial_stock: event.target.value === '' ? '' : Number(event.target.value),
                })
              }
            />
          </div>
          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Batal
            </button>
            <button className="btn-primary" type="submit">
              Simpan
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        title="Bulk Insert Produk"
        isOpen={bulkOpen}
        onClose={() => {
          setBulkOpen(false)
          setBulkRows([createBulkRow()])
        }}
        maxWidth="max-w-6xl"
      >
        <div className="space-y-3">
          {bulkRows.map((row, index) => (
            <div key={index} className="rounded border border-slate-200 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">Produk #{index + 1}</p>
                <button
                  className="btn-secondary"
                  onClick={() => setBulkRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                  disabled={bulkRows.length === 1}
                >
                  <Trash2 size={16} />
                  Hapus
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Kode Produk</label>
                  <input
                    className="input"
                    value={row.code}
                    onChange={(event) =>
                      setBulkRows((prev) =>
                        prev.map((item, rowIndex) =>
                          rowIndex === index ? { ...item, code: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Nama Produk</label>
                  <input
                    className="input"
                    value={row.name}
                    onChange={(event) =>
                      setBulkRows((prev) =>
                        prev.map((item, rowIndex) =>
                          rowIndex === index ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Stok Awal</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    value={row.initial_stock}
                    onChange={(event) =>
                      setBulkRows((prev) =>
                        prev.map((item, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...item,
                                initial_stock: event.target.value === '' ? '' : Number(event.target.value),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Kategori</label>
                  <input
                    className="input"
                    value={row.category}
                    onChange={(event) =>
                      setBulkRows((prev) =>
                        prev.map((item, rowIndex) =>
                          rowIndex === index ? { ...item, category: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <button className="btn-secondary" onClick={() => setBulkRows((prev) => [...prev, createBulkRow()])}>
            <Plus size={16} />
            Tambah Baris Produk
          </button>
          <div className="flex justify-end gap-2">
            <button
              className="btn-secondary"
              onClick={() => {
                setBulkOpen(false)
                setBulkRows([createBulkRow()])
              }}
            >
              Batal
            </button>
            <button className="btn-primary" onClick={submitBulk}>
              Proses Bulk Insert
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
