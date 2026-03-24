import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, X, TrendingUp, TrendingDown, DollarSign, Trash2, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

const INCOME_CATEGORIES = ['Service Revenue', 'Inspection Fees', 'Maintenance Contracts', 'Other Income']
const EXPENSE_CATEGORIES = ['Chemicals & Materials', 'Equipment', 'Vehicle & Fuel', 'Insurance', 'Marketing', 'Office & Admin', 'Payroll', 'Licensing & Training', 'Other Expense']

function NewTransactionModal({ onClose, onSave }) {
  const [form, setForm] = useState({ type: 'income', amount: '', description: '', category: 'Service Revenue', date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await onSave(form); setSaving(false); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">New Transaction</h3><button onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({...form, type: 'income', category: 'Service Revenue'})} className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${form.type === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}><ArrowUpRight size={16} />Income</button>
            <button type="button" onClick={() => setForm({...form, type: 'expense', category: 'Chemicals & Materials'})} className={`flex-1 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${form.type === 'expense' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}><ArrowDownRight size={16} />Expense</button>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount *</label><input type="number" step="0.01" required value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none text-lg font-medium" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Description *</label><input required value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What is this for?" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Date</label><input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" /></div>
          </div>
          <button type="submit" disabled={saving} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Saving...' : 'Add Transaction'}</button>
        </form>
      </div>
    </div>
  )
}

export default function AdminAccounting() {
  const [transactions, setTransactions] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const data = await adminFetch('/api/admin/transactions')
    if (data) setTransactions(data.transactions || [])
    setLoading(false)
  }, [navigate])

  useEffect(() => { fetchData() }, [fetchData])

  const addTransaction = async (form) => { await adminFetch('/api/admin/transactions', { method: 'POST', body: JSON.stringify(form) }); fetchData() }
  const deleteTransaction = async (id) => { await adminFetch(`/api/admin/transactions/${id}`, { method: 'DELETE' }); fetchData() }

  const income = transactions.filter(t => t.type === 'income')
  const expenses = transactions.filter(t => t.type === 'expense')
  const totalIncome = income.reduce((s, t) => s + t.amount, 0)
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0)
  const profit = totalIncome - totalExpenses

  // Monthly P&L
  const monthlyPL = {}
  transactions.forEach(t => {
    const month = t.date.substring(0, 7)
    if (!monthlyPL[month]) monthlyPL[month] = { income: 0, expense: 0 }
    monthlyPL[month][t.type] += t.amount
  })
  const months = Object.keys(monthlyPL).sort().slice(-6)
  const maxMonth = Math.max(...months.map(m => Math.max(monthlyPL[m].income, monthlyPL[m].expense)), 1)

  // Category breakdown
  const categoryTotals = {}
  transactions.forEach(t => {
    const key = `${t.type}:${t.category}`
    categoryTotals[key] = (categoryTotals[key] || 0) + t.amount
  })

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter)

  return (
    <AdminLayout>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingUp size={18} className="text-green-600" /><span className="text-sm text-gray-500">Total Income</span></div>
          <div className="font-display font-bold text-2xl text-green-600">{formatCurrency(totalIncome)}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><TrendingDown size={18} className="text-red-500" /><span className="text-sm text-gray-500">Total Expenses</span></div>
          <div className="font-display font-bold text-2xl text-red-500">{formatCurrency(totalExpenses)}</div>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><DollarSign size={18} className={profit >= 0 ? 'text-green-600' : 'text-red-500'} /><span className="text-sm text-gray-500">Net Profit</span></div>
          <div className={`font-display font-bold text-2xl ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(profit)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-display font-bold text-charcoal-900 mb-4">Monthly Profit & Loss</h3>
          {months.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet — add transactions to see the chart</p>
          ) : (
            <div className="space-y-3">
              {months.map(m => {
                const d = monthlyPL[m]
                const label = new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                const pl = d.income - d.expense
                return (
                  <div key={m} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-gray-500 shrink-0">{label}</div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2"><div className="h-5 rounded bg-green-500" style={{ width: `${(d.income / maxMonth) * 100}%`, minWidth: d.income > 0 ? '4px' : '0' }} /><span className="text-xs text-gray-600">{formatCurrency(d.income)}</span></div>
                      <div className="flex items-center gap-2"><div className="h-5 rounded bg-red-400" style={{ width: `${(d.expense / maxMonth) * 100}%`, minWidth: d.expense > 0 ? '4px' : '0' }} /><span className="text-xs text-gray-400">{formatCurrency(d.expense)}</span></div>
                    </div>
                    <div className={`text-xs font-medium w-20 text-right ${pl >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(pl)}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-display font-bold text-charcoal-900 mb-4">By Category</h3>
          {Object.keys(categoryTotals).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).map(([key, amount]) => {
                const [type, category] = key.split(':')
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${type === 'income' ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-sm text-charcoal-800">{category}</span>
                    </div>
                    <span className={`text-sm font-medium ${type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(amount)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Transactions list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex gap-2">
            {['all', 'income', 'expense'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? 'bg-forest-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{f === 'all' ? 'All' : f}</button>
            ))}
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={14} />Add</button>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No transactions</div>
          ) : filtered.map(t => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.type === 'income' ? 'bg-green-50' : 'bg-red-50'}`}>
                  {t.type === 'income' ? <ArrowUpRight size={16} className="text-green-600" /> : <ArrowDownRight size={16} className="text-red-500" />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-charcoal-900 truncate">{t.description}</div>
                  <div className="text-xs text-gray-400">{t.category} · {formatDate(t.date)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`font-display font-bold text-sm ${t.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
                <button onClick={() => { if (confirm('Delete?')) deleteTransaction(t.id) }} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showNew && <NewTransactionModal onClose={() => setShowNew(false)} onSave={addTransaction} />}
    </AdminLayout>
  )
}
