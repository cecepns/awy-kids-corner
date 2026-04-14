import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

export default function LoginPage({ onSubmit, loading }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
  })

  const submit = (event) => {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-primary-100 p-2 text-primary-700">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Awy Kids Corner</h1>
            <p className="text-xs text-slate-500">Login admin untuk masuk dashboard</p>
          </div>
        </div>

        <form className="space-y-3" onSubmit={submit}>
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
            <label className="mb-1 block text-xs text-slate-500">Password</label>
            <input
              type="password"
              className="input"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </div>
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
