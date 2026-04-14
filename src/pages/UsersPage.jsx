import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import ApiPagination from '../components/ApiPagination'
import { apiService } from '../utils/api'
import { confirmToast, notifyError, notifySuccess } from '../utils/toast'
import { formatDate } from '../utils/format'

const initialForm = {
  name: '',
  email: '',
  password: '',
  is_active: true,
}

export default function UsersPage({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(initialForm)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const { data } = await apiService.getUsers({ page, limit })
      setUsers(data.data || [])
      setTotalPages(data.meta?.total_pages || 1)
      setTotalItems(data.meta?.total_items || 0)
      if (data.meta?.page && data.meta.page !== page) {
        setPage(data.meta.page)
      }
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil data users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [page, limit])

  const reset = () => {
    setEditing(null)
    setForm(initialForm)
    setModalOpen(false)
  }

  const submit = async (event) => {
    event.preventDefault()
    try {
      if (editing) {
        await apiService.updateUser(editing.id, form)
        notifySuccess('User berhasil diperbarui')
      } else {
        await apiService.createUser(form)
        notifySuccess('User berhasil ditambahkan')
      }
      reset()
      await loadUsers()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menyimpan user')
    }
  }

  const handleDelete = async (user) => {
    const accepted = await confirmToast(`Hapus user ${user.email}?`, 'Ya, hapus')
    if (!accepted) return
    try {
      await apiService.deleteUser(user.id)
      notifySuccess('User berhasil dihapus')
      await loadUsers()
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menghapus user')
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Login sebagai: <span className="font-semibold">{currentUser?.email}</span>
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              setEditing(null)
              setForm(initialForm)
              setModalOpen(true)
            }}
          >
            <Plus size={16} />
            Tambah Admin
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-violet-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left">Nama</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Role</th>
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
            ) : users.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={6}>
                  Belum ada user.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{user.name}</td>
                  <td className="px-3 py-2">{user.email}</td>
                  <td className="px-3 py-2 uppercase">{user.role}</td>
                  <td className="px-3 py-2">
                    {user.is_active ? (
                      <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Aktif</span>
                    ) : (
                      <span className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700">Nonaktif</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDate(user.created_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        className="rounded p-1 text-sky-700 hover:bg-sky-50"
                        onClick={() => {
                          setEditing(user)
                          setForm({
                            name: user.name,
                            email: user.email,
                            password: '',
                            is_active: Boolean(user.is_active),
                          })
                          setModalOpen(true)
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="rounded p-1 text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleDelete(user)}
                        disabled={Number(user.id) === Number(currentUser?.id)}
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
        title={editing ? 'Edit User Admin' : 'Tambah User Admin'}
        isOpen={modalOpen}
        onClose={reset}
        maxWidth="max-w-md"
      >
        <form className="space-y-3" onSubmit={submit}>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Nama</label>
            <input
              className="input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Email</label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">
              Password {editing ? '(kosongkan jika tidak diubah)' : ''}
            </label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required={!editing}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            User aktif
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
