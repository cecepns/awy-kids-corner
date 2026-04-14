import { X } from 'lucide-react'

export default function Modal({ title, isOpen, onClose, children, maxWidth = 'max-w-3xl' }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-6">
      <div className={`w-full ${maxWidth} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <button className="rounded p-1 hover:bg-slate-100" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
