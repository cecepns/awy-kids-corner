/* eslint-disable react/prop-types */
const PER_PAGE_OPTIONS = [10, 20, 50, 100]

export default function ApiPagination({
  page = 1,
  totalPages = 1,
  totalItems = 0,
  limit = 20,
  loading = false,
  onPageChange,
  onLimitChange,
}) {
  const safePage = Math.max(1, Number(page) || 1)
  const safeLimit = Number(limit) || 20
  const safeTotalPages = Math.max(1, Number(totalPages) || 1)
  const safeTotalItems = Math.max(0, Number(totalItems) || 0)
  const from = safeTotalItems === 0 ? 0 : (safePage - 1) * safeLimit + 1
  const to = safeTotalItems === 0 ? 0 : Math.min(safePage * safeLimit, safeTotalItems)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <p className="text-slate-600">
          Menampilkan <span className="font-semibold">{from}</span> - <span className="font-semibold">{to}</span>{' '}
          dari <span className="font-semibold">{safeTotalItems}</span> data
        </p>
        <label className="flex items-center gap-2 text-slate-600">
          <span>Per halaman</span>
          <select
            className="input h-9 w-24"
            value={safeLimit}
            onChange={(event) => onLimitChange?.(Number(event.target.value))}
            disabled={loading}
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="btn-secondary h-9 px-3"
          onClick={() => onPageChange?.(safePage - 1)}
          disabled={loading || safePage <= 1}
        >
          Sebelumnya
        </button>
        <span className="text-slate-600">
          Halaman <span className="font-semibold">{safePage}</span> / {safeTotalPages}
        </span>
        <button
          type="button"
          className="btn-secondary h-9 px-3"
          onClick={() => onPageChange?.(safePage + 1)}
          disabled={loading || safePage >= safeTotalPages}
        >
          Selanjutnya
        </button>
      </div>
    </div>
  )
}
