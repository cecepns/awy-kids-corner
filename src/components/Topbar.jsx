import { Menu } from 'lucide-react'

const titleMap = {
  dashboard: 'Dashboard',
  products: 'Data Produk',
  suppliers: 'Manajemen Supplier',
  incoming: 'Barang Masuk',
  outgoing: 'Barang Keluar',
  bookkeeping: 'Pembukuan',
  users: 'Manajemen Users',
  activity: 'Activity',
}

export default function Topbar({ page, onOpenSidebar, currentUser, onLogout }) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button className="rounded p-1 hover:bg-slate-100 md:hidden" onClick={onOpenSidebar}>
            <Menu size={20} />
          </button>
          <h2 className="text-lg font-semibold text-slate-800">{titleMap[page]}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 sm:block">
            {currentUser?.email || 'Admin'}
          </span>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
