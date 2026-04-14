import { useEffect, useState } from 'react'
import { Plus, Save, Trash2, RotateCcw } from 'lucide-react'
import { apiService } from '../utils/api'
import { confirmToast, notifyError, notifySuccess } from '../utils/toast'

export default function NotesPage() {
  const [columns, setColumns] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const { data } = await apiService.getNotes()
      const nextColumns = Array.isArray(data.data?.columns) && data.data.columns.length ? data.data.columns : ['Data']
      const sourceRows = Array.isArray(data.data?.rows) ? data.data.rows : []
      const normalizedRows = sourceRows.map((row) => {
        const nextRow = {}
        nextColumns.forEach((column) => {
          nextRow[column] = String(row?.[column] ?? '')
        })
        return nextRow
      })
      setColumns(nextColumns)
      setRows(normalizedRows)
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal mengambil data catatan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const ensureUniqueColumnName = (baseName) => {
    let candidate = baseName
    let counter = 2
    while (columns.includes(candidate)) {
      candidate = `${baseName} ${counter}`
      counter += 1
    }
    return candidate
  }

  const addColumn = () => {
    const newColumn = ensureUniqueColumnName('Kolom Baru')
    setColumns((prev) => [...prev, newColumn])
    setRows((prev) => prev.map((row) => ({ ...row, [newColumn]: '' })))
  }

  const renameColumn = (index, value) => {
    const currentName = columns[index]
    const nextName = value.trim()
    if (!nextName || nextName === currentName) return
    if (columns.includes(nextName)) {
      notifyError('Nama kolom sudah dipakai')
      return
    }

    const nextColumns = [...columns]
    nextColumns[index] = nextName
    setColumns(nextColumns)
    setRows((prev) =>
      prev.map((row) => {
        const nextRow = { ...row }
        nextRow[nextName] = nextRow[currentName] ?? ''
        delete nextRow[currentName]
        return nextRow
      }),
    )
  }

  const removeColumn = async (index) => {
    if (columns.length <= 1) {
      notifyError('Minimal harus ada 1 kolom')
      return
    }
    const accepted = await confirmToast(`Hapus kolom ${columns[index]}?`, 'Ya, hapus kolom')
    if (!accepted) return

    const target = columns[index]
    const nextColumns = columns.filter((_, idx) => idx !== index)
    setColumns(nextColumns)
    setRows((prev) =>
      prev.map((row) => {
        const nextRow = { ...row }
        delete nextRow[target]
        return nextRow
      }),
    )
  }

  const addRow = () => {
    const row = {}
    columns.forEach((column) => {
      row[column] = ''
    })
    setRows((prev) => [...prev, row])
  }

  const removeRow = async (rowIndex) => {
    const accepted = await confirmToast(`Hapus baris #${rowIndex + 1}?`, 'Ya, hapus baris')
    if (!accepted) return
    setRows((prev) => prev.filter((_, index) => index !== rowIndex))
  }

  const updateCell = (rowIndex, column, value) => {
    setRows((prev) => prev.map((row, index) => (index === rowIndex ? { ...row, [column]: value } : row)))
  }

  const saveSheet = async () => {
    try {
      setSaving(true)
      await apiService.saveNotes({ columns, rows })
      notifySuccess('Catatan berhasil disimpan')
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal menyimpan catatan')
    } finally {
      setSaving(false)
    }
  }

  const resetSheet = async () => {
    const accepted = await confirmToast('Reset catatan ke template default?', 'Ya, reset')
    if (!accepted) return
    try {
      setSaving(true)
      await apiService.resetNotes()
      await loadData()
      notifySuccess('Catatan berhasil direset')
    } catch (error) {
      notifyError(error.response?.data?.message || 'Gagal reset catatan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Mode seperti Excel sederhana: header kolom dinamis dan isi per cell bisa langsung diedit.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={addColumn} disabled={loading || saving}>
              <Plus size={16} />
              Tambah Kolom
            </button>
            <button className="btn-secondary" onClick={addRow} disabled={loading || saving}>
              <Plus size={16} />
              Tambah Baris
            </button>
            <button className="btn-secondary" onClick={resetSheet} disabled={loading || saving}>
              <RotateCcw size={16} />
              Reset
            </button>
            <button className="btn-primary" onClick={saveSheet} disabled={loading || saving}>
              <Save size={16} />
              Simpan Catatan
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-700 text-white">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              {columns.map((column, index) => (
                <th key={`${column}-${index}`} className="px-2 py-2 text-left">
                  <div className="flex items-center gap-2">
                    <input
                      className="input h-8 min-w-36 bg-white text-slate-700"
                      defaultValue={column}
                      onBlur={(event) => renameColumn(index, event.target.value)}
                    />
                    <button
                      className="rounded p-1 text-rose-700 hover:bg-rose-100"
                      onClick={() => removeColumn(index)}
                      type="button"
                      title="Hapus kolom"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={columns.length + 2}>
                  Memuat data...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={columns.length + 2}>
                  Belum ada data catatan.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{rowIndex + 1}</td>
                  {columns.map((column) => (
                    <td key={`${column}-${rowIndex}`} className="px-2 py-2">
                      <input
                        className="input h-8 min-w-36"
                        value={row[column] ?? ''}
                        onChange={(event) => updateCell(rowIndex, column, event.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="flex justify-end">
                      <button className="rounded p-1 text-rose-700 hover:bg-rose-50" onClick={() => removeRow(rowIndex)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
