import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import ApiPagination from '../components/ApiPagination'
import { apiService } from '../utils/api'
import { confirmToast, notifyError, notifySuccess } from '../utils/toast'
import { formatNumber } from '../utils/format'

const initialForm = {
  data_name: '',
  hutang: 0,
  total: 0,
  dead: '',
}

export default function NotesPage() {
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
      const { data } = await apiService.getNotes({ search, page, limit })
      setRows(data.data || [])
      setTotalPages(data.meta?.total_pages || 1)
      setTotalItems(data.meta?.total_items || 0)
      if (data.meta?.page && data.meta.page !== page) {
        setPage(data.meta.page)
      }
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil data catatan')
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
    setModalOpen(false)
  }

  const submitForm = async (event) => {
    event.preventDefault()
    try {
      if (editing) {
        await apiService.updateNote(editing.id, form)
        notifySuccess('Catatan berhasil diperbarui')
      } else {
        await apiService.createNote(form)
        notifySuccess('Catatan berhasil ditambahkan')
      }
      resetForm()
      await loadData()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menyimpan catatan')
    }
  }

  const handleDelete = async (item) => {
    const accepted = await confirmToast(`Hapus catatan ${item.data_name}?`, 'Ya, hapus')
    if (!accepted) return

    try {
      await apiService.deleteNote(item.id)
      notifySuccess('Catatan berhasil dihapus')
      await loadData()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menghapus catatan')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="input sm:w-80"
            placeholder="Cari data / dead..."
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
            Tambah Catatan
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-right">Hutang</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Dead</th>
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                  Memuat data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                  Belum ada data catatan.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.data_name}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(row.hutang)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{formatNumber(row.total)}</td>
                  <td className="px-3 py-2">{row.dead || '-'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded p-1 text-sky-700 hover:bg-sky-50"
                        onClick={() => {
                          setEditing(row)
                          setForm({
                            data_name: row.data_name || '',
                            hutang: Number(row.hutang || 0),
                            total: Number(row.total || 0),
                            dead: row.dead || '',
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

      <Modal title={editing ? 'Edit Catatan' : 'Tambah Catatan'} isOpen={modalOpen} onClose={resetForm} maxWidth="max-w-lg">
        <form className="space-y-3" onSubmit={submitForm}>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Data</label>
            <input
              className="input"
              value={form.data_name}
              onChange={(event) => setForm({ ...form, data_name: event.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Hutang</label>
              <input
                type="number"
                className="input"
                min="0"
                value={form.hutang}
                onChange={(event) => setForm({ ...form, hutang: Number(event.target.value) })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Total</label>
              <input
                type="number"
                className="input"
                min="0"
                value={form.total}
                onChange={(event) => setForm({ ...form, total: Number(event.target.value) })}
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Dead</label>
            <input
              className="input"
              value={form.dead}
              onChange={(event) => setForm({ ...form, dead: event.target.value })}
              placeholder="Contoh: 14 Apr / lunas / follow up"
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
