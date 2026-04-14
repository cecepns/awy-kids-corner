import {
  LayoutDashboard,
  Boxes,
  ArrowDownCircle,
  ArrowUpCircle,
  ReceiptText,
  Truck,
  History,
  Users,
  X,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const menus = [
  { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'products', path: '/products', label: 'Data Produk', icon: Boxes },
  { key: 'suppliers', path: '/suppliers', label: 'Manajemen Supplier', icon: Truck },
  { key: 'incoming', path: '/incoming', label: 'Barang Masuk', icon: ArrowDownCircle },
  { key: 'outgoing', path: '/outgoing', label: 'Barang Keluar', icon: ArrowUpCircle },
  { key: 'bookkeeping', path: '/bookkeeping', label: 'Pembukuan', icon: ReceiptText },
  { key: 'users', path: '/users', label: 'Manajemen Users', icon: Users },
  { key: 'activity', path: '/activity', label: 'Activity', icon: History },
]

export default function Sidebar({ page, open, setOpen }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-900/30 transition md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-72 border-r border-slate-200 bg-white transition-transform md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Stock App</p>
            <h1 className="text-lg font-bold text-slate-800">Awy Kids Corner</h1>
          </div>
          <button className="rounded p-1 hover:bg-slate-100 md:hidden" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="space-y-1 p-3">
          {menus.map((menu) => {
            const Icon = menu.icon
            const active = page === menu.key
            return (
              <NavLink
                key={menu.key}
                to={menu.path}
                onClick={() => setOpen(false)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon size={18} />
                {menu.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
