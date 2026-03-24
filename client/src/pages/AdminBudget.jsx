import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, DollarSign, TrendingDown, TrendingUp, BarChart3 } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency } from '../hooks/useAdmin'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function AdminBudget() {
  const [tab, setTab] = useState('setup')
  const [accounts, setAccounts] = useState([])
  const [budgetAmounts, setBudgetAmounts] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reportYear, setReportYear] = useState(new Date().getFullYear())
  const [reportPeriod, setReportPeriod] = useState('year')
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1)
  const [reportQuarter, setReportQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3))
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear())
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const [acctsRes, budgetsRes] = await Promise.all([
      adminFetch('/api/accounting/accounts'),
      adminFetch(`/api/accounting/budgets?year=${budgetYear}`),
    ])
    if (acctsRes?.data) setAccounts(acctsRes.data.filter(a => a.type === 'expense' && a.isActive))
    if (budgetsRes?.data) {
      const map = {}
      for (const b of budgetsRes.data) map[b.accountId] = String(b.amount)
      setBudgetAmounts(map)
    }
    setLoading(false)
  }, [navigate, budgetYear])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchReport = useCallback(async () => {
    let qs = `year=${reportYear}&period=${reportPeriod}`
    if (reportPeriod === 'month') qs += `&month=${reportMonth}`
    if (reportPeriod === 'quarter') qs += `&quarter=${reportQuarter}`
    const res = await adminFetch(`/api/accounting/budget-vs-actual?${qs}`)
    if (res?.data) setReport(res.data)
  }, [reportYear, reportPeriod, reportMonth, reportQuarter])

  useEffect(() => { if (tab === 'report') fetchReport() }, [tab, fetchReport])

  const handleSave = async () => {
    setSaving(true)
    const items = accounts.filter(a => budgetAmounts[a.id]).map(a => ({ accountId: a.id, amount: Number(budgetAmounts[a.id]) || 0 }))
    await adminFetch('/api/accounting/budgets/bulk', { method: 'POST', body: JSON.stringify({ budgets: items, year: budgetYear }) })
    setDirty(false); setSaving(false)
  }

  const totalBudget = accounts.reduce((s, a) => s + (Number(budgetAmounts[a.id]) || 0), 0)

  return (
    <AdminLayout>
      <h2 className="font-display font-bold text-xl text-charcoal-900 mb-6">Budget</h2>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button onClick={() => setTab('setup')} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'setup' ? 'border-forest-700 text-forest-700' : 'border-transparent text-gray-500'}`}>Budget Setup</button>
        <button onClick={() => setTab('report')} className={`px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'report' ? 'border-forest-700 text-forest-700' : 'border-transparent text-gray-500'}`}>Budget vs. Actual</button>
      </div>

      {tab === 'setup' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="font-display font-bold text-base">Annual Budget by Category</h3>
              <select value={budgetYear} onChange={e => setBudgetYear(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={handleSave} disabled={saving || !dirty} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"><Save size={14} />{saving ? 'Saving...' : 'Save Budgets'}</button>
          </div>
          {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-left text-xs text-gray-500"><th className="px-4 py-2 w-20">Acct #</th><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right w-40">Annual Budget</th><th className="px-4 py-2 text-right w-32 text-gray-400">Monthly Avg</th></tr></thead>
              <tbody>
                {accounts.map(a => {
                  const amt = Number(budgetAmounts[a.id]) || 0
                  return (
                    <tr key={a.id} className="border-b border-gray-50">
                      <td className="px-4 py-2 text-gray-400 font-mono text-xs">{a.code}</td>
                      <td className="px-4 py-2 font-medium">{a.name}</td>
                      <td className="px-4 py-2 text-right"><input type="text" inputMode="decimal" className="w-32 text-right ml-auto px-2 py-1 rounded border border-gray-200 text-sm" placeholder="0.00" value={budgetAmounts[a.id] || ''} onChange={e => { setBudgetAmounts(p => ({...p, [a.id]: e.target.value.replace(/[^0-9.]/g, '')})); setDirty(true) }} /></td>
                      <td className="px-4 py-2 text-right text-gray-400 tabular-nums">{amt > 0 ? formatCurrency(amt / 12) : '—'}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 font-semibold"><td /><td className="px-4 py-2">Total</td><td className="px-4 py-2 text-right">{formatCurrency(totalBudget)}</td><td className="px-4 py-2 text-right text-gray-400">{formatCurrency(totalBudget / 12)}</td></tr>
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h3 className="font-display font-bold text-base flex items-center gap-2"><BarChart3 size={18} className="text-blue-500" />Budget vs. Actual</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={reportYear} onChange={e => setReportYear(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">{[new Date().getFullYear() - 1, new Date().getFullYear()].map(y => <option key={y} value={y}>{y}</option>)}</select>
              <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white"><option value="month">Month</option><option value="quarter">Quarter</option><option value="year">Full Year</option></select>
              {reportPeriod === 'month' && <select value={reportMonth} onChange={e => setReportMonth(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">{MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}</select>}
              {reportPeriod === 'quarter' && <select value={reportQuarter} onChange={e => setReportQuarter(Number(e.target.value))} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white">{[1,2,3,4].map(q => <option key={q} value={q}>Q{q}</option>)}</select>}
            </div>
          </div>

          {!report?.report?.length ? <p className="text-center py-12 text-gray-400 text-sm">No data found. Set budgets first.</p> : (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="border rounded-lg p-4"><div className="flex items-center gap-2 text-sm text-gray-500 mb-1"><DollarSign size={14} className="text-blue-500" />Budgeted</div><div className="font-display font-bold text-xl tabular-nums">{formatCurrency(report.totals.budgeted)}</div></div>
                <div className="border rounded-lg p-4"><div className="flex items-center gap-2 text-sm text-gray-500 mb-1">{report.totals.actual > report.totals.budgeted ? <TrendingUp size={14} className="text-red-500" /> : <TrendingDown size={14} className="text-green-500" />}Actual</div><div className={`font-display font-bold text-xl tabular-nums ${report.totals.actual > report.totals.budgeted ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(report.totals.actual)}</div></div>
                <div className="border rounded-lg p-4"><div className="flex items-center gap-2 text-sm text-gray-500 mb-1">Variance</div><div className={`font-display font-bold text-xl tabular-nums ${report.totals.variance < 0 ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(report.totals.variance)}</div></div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 text-left text-xs text-gray-500"><th className="px-4 py-2 w-20">Acct #</th><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right">Budgeted</th><th className="px-4 py-2 text-right">Actual</th><th className="px-4 py-2 text-right">Variance</th><th className="px-4 py-2 w-48">Progress</th><th className="px-4 py-2 text-right w-20">% Used</th></tr></thead>
                <tbody>
                  {report.report.map(row => {
                    const isOver = row.status === 'over'
                    const pct = Math.min(row.percentUsed, 100)
                    return (
                      <tr key={row.accountId} className="border-b border-gray-50">
                        <td className="px-4 py-2 text-gray-400 font-mono text-xs">{row.accountNumber}</td>
                        <td className="px-4 py-2 font-medium">{row.accountName}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(row.budgeted)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums font-medium ${isOver ? 'text-red-500' : 'text-green-600'}`}>{formatCurrency(row.actual)}</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${row.variance < 0 ? 'text-red-500' : 'text-green-600'}`}>{row.variance < 0 ? '-' : '+'}{formatCurrency(Math.abs(row.variance))}</td>
                        <td className="px-4 py-2"><div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden"><div className={`h-full rounded-full ${isOver ? 'bg-red-400' : pct > 80 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} /></div></td>
                        <td className="px-4 py-2 text-right"><span className={`px-2 py-0.5 rounded text-[10px] font-medium tabular-nums ${isOver ? 'bg-red-50 text-red-600' : pct > 80 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>{row.percentUsed.toFixed(1)}%</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
