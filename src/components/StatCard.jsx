export default function StatCard({ title, value, subtitle }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="mt-1 text-2xl font-bold text-slate-800">{value}</h3>
      {subtitle ? <p className="mt-2 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  )
}
