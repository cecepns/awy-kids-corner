import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import ApiPagination from '../components/ApiPagination'
import { apiService } from '../utils/api'
import { confirmToast, notifyError, notifySuccess } from '../utils/toast'
import { formatDate } from '../utils/format'

const initialForm = {
  name: '',
  phone: '',
  address: '',
  notes: '',
  is_active: true,
}

export default function SuppliersPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(initialForm)

  const loadData = async () => {
    try {
      setLoading(true)
      const { data } = await apiService.getSuppliers({ search, page, limit })
      setRows(data.data || [])
      setTotalPages(data.meta?.total_pages || 1)
      setTotalItems(data.meta?.total_items || 0)
      if (data.meta?.page && data.meta.page !== page) {
        setPage(data.meta.page)
      }
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil data supplier')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [search, page, limit])

  const reset = () => {
    setEditing(null)
    setForm(initialForm)
    setModalOpen(false)
  }

  const submit = async (event) => {
    event.preventDefault()
    try {
      if (editing) {
        await apiService.updateSupplier(editing.id, form)
        notifySuccess('Supplier berhasil diperbarui')
      } else {
        await apiService.createSupplier(form)
        notifySuccess('Supplier berhasil ditambahkan')
      }
      reset()
      await loadData()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menyimpan supplier')
    }
  }

  const handleDelete = async (item) => {
    const accepted = await confirmToast(`Hapus supplier ${item.name}?`, 'Ya, hapus')
    if (!accepted) return

    try {
      await apiService.deleteSupplier(item.id)
      notifySuccess('Supplier berhasil dihapus')
      await loadData()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menghapus supplier')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="input sm:w-80"
            placeholder="Cari nama / telepon / alamat supplier..."
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
              setModalOpen(true)
            }}
          >
            <Plus size={16} />
            Tambah Supplier
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-cyan-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Nama Supplier</th>
              <th className="px-3 py-2 text-left">Telepon</th>
              <th className="px-3 py-2 text-left">Alamat</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Dibuat</th>
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
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                  Data supplier belum ada.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.phone || '-'}</td>
                  <td className="px-3 py-2">{row.address || '-'}</td>
                  <td className="px-3 py-2">
                    {row.is_active ? (
                      <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Aktif</span>
                    ) : (
                      <span className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700">Nonaktif</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded p-1 text-sky-700 hover:bg-sky-50"
                        onClick={() => {
                          setEditing(row)
                          setForm({
                            name: row.name || '',
                            phone: row.phone || '',
                            address: row.address || '',
                            notes: row.notes || '',
                            is_active: Boolean(row.is_active),
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
        title={editing ? 'Edit Supplier' : 'Tambah Supplier'}
        isOpen={modalOpen}
        onClose={reset}
        maxWidth="max-w-lg"
      >
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nama Supplier</label>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Telepon</label>
            <input
              className="input"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Alamat</label>
            <textarea
              className="input min-h-20"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
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
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            Supplier aktif
          </label>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={reset}>
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
