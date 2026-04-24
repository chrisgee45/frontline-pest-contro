import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { DollarSign, TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronRight, Plus, X, Ban, Search, Info } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency, formatDate } from '../hooks/useAdmin'

const PRESETS = [
  { key: 'this_month', label: 'This Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year', label: 'This Year' },
  { key: 'last_year', label: 'Last Year' },
]

function getDateRange(preset) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  switch (preset) {
    case 'this_month': return { start: `${y}-${String(m+1).padStart(2,'0')}-01`, end: `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}` }
    case 'this_quarter': { const qs = Math.floor(m/3)*3; return { start: `${y}-${String(qs+1).padStart(2,'0')}-01`, end: `${y}-${String(qs+3).padStart(2,'0')}-${new Date(y,qs+3,0).getDate()}` } }
    case 'this_year': return { start: `${y}-01-01`, end: `${y}-12-31` }
    case 'last_year': return { start: `${y-1}-01-01`, end: `${y-1}-12-31` }
    default: return { start: `${y}-01-01`, end: `${y}-12-31` }
  }
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        {icon}
      </div>
      <div className={`font-display font-bold text-2xl ${color}`}>{formatCurrency(value)}</div>
    </div>
  )
}

function ReportTable({ title, color, items, totalLabel, total }) {
  if (!items || items.length === 0) return (
    <div className="text-center py-6 text-gray-400 text-sm">No {title.toLowerCase()} recorded</div>
  )
  return (
    <div>
      <h4 className={`font-semibold text-sm mb-2 ${color}`}>{title}</h4>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
            <span className="text-charcoal-800">{item.name}</span>
            <span className="tabular-nums font-medium">{formatCurrency(Math.abs(item.balance))}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-semibold pt-2 mt-1 border-t border-gray-200">
        <span>{totalLabel}</span>
        <span className={color}>{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

export default function AdminFinancials() {
  const [preset, setPreset] = useState('this_year')
  const [tab, setTab] = useState('pl')
  const [income, setIncome] = useState(null)
  const [balance, setBalance] = useState(null)
  const [cashFlow, setCashFlow] = useState(null)
  const [journal, setJournal] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [showRevDialog, setShowRevDialog] = useState(false)
  const [showExpDialog, setShowExpDialog] = useState(false)
  const [showDrawDialog, setShowDrawDialog] = useState(false)
  const [accounts, setAccounts] = useState([])
  const navigate = useNavigate()
  const { start, end } = getDateRange(preset)

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    setLoading(true)
    const [incRes, balRes, cfRes, jrnRes, acctRes] = await Promise.all([
      adminFetch(`/api/accounting/income-statement?start=${start}&end=${end}`),
      adminFetch(`/api/accounting/balance-sheet?asOf=${end}`),
      adminFetch(`/api/accounting/cash-flow?start=${start}&end=${end}`),
      adminFetch(`/api/accounting/journal-entries?start=${start}&end=${end}`),
      adminFetch('/api/accounting/accounts'),
    ])
    if (incRes?.data) setIncome(incRes.data)
    if (balRes?.data) setBalance(balRes.data)
    if (cfRes?.data) setCashFlow(cfRes.data)
    if (jrnRes?.data) setJournal(jrnRes.data)
    if (acctRes?.data) setAccounts(acctRes.data)
    setLoading(false)
  }, [start, end, navigate])

  useEffect(() => { fetchData() }, [fetchData])

  const revenueAccounts = accounts.filter(a => a.type === 'revenue')
  const expenseAccounts = accounts.filter(a => a.type === 'expense')

  const totalRevenue = income?.totalRevenue || 0
  const totalExpenses = income?.totalExpenses || 0
  const netIncome = income?.netIncome || 0
  const cashBalance = cashFlow?.netCashFlow || 0

  const filteredJournal = useMemo(() => {
    if (!searchTerm) return journal
    const lower = searchTerm.toLowerCase()
    return journal.filter(e => (e.memo || '').toLowerCase().includes(lower) || (e.sourceType || '').toLowerCase().includes(lower))
  }, [journal, searchTerm])

  const handleVoid = async (id) => {
    if (!confirm('Void this journal entry? A reversing entry will be created.')) return
    await adminFetch(`/api/accounting/journal-entries/${id}/void`, { method: 'POST' })
    fetchData()
  }

  const tabs = [
    { key: 'pl', label: 'Income Statement' },
    { key: 'bs', label: 'Balance Sheet' },
    { key: 'cf', label: 'Cash Flow' },
    { key: 'gl', label: 'General Ledger' },
  ]

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-bold text-xl text-charcoal-900">Financials</h2>
          <p className="text-sm text-gray-500">{formatDate(start)} — {formatDate(end)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => setPreset(p.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${preset === p.key ? 'bg-forest-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'}`}>{p.label}</button>
          ))}
          <button onClick={() => setShowRevDialog(true)} className="btn-primary text-xs py-1.5 px-3"><Plus size={14} />Revenue</button>
          <button onClick={() => setShowExpDialog(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-1"><Plus size={14} />Expense</button>
          <button onClick={() => setShowDrawDialog(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-1">Draw</button>
        </div>
      </div>

      {/* Accounting basis banner — these reports are accrual-basis
          (include bills owed and revenue earned regardless of whether
          cash has moved). The Dashboard's Total Revenue/Expenses tiles
          are cash-basis (money actually received or paid). For a
          service business where most invoices are paid immediately
          the two will usually match closely. */}
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 flex items-start gap-3 text-xs text-blue-900">
        <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <strong>Accrual basis</strong> — these reports include everything posted to the ledger: paid, unpaid, and accrued.
          Revenue is recognized when payment is recorded; expenses are recognized when bills are entered (not when paid).
          The Dashboard tiles use <strong>cash basis</strong> (actual money movement) and may differ when there are open bills or unrecorded payments.
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Revenue" value={totalRevenue} icon={<DollarSign size={18} className="text-green-500" />} color="text-green-600" />
        <StatCard label="Total Expenses" value={totalExpenses} icon={<TrendingDown size={18} className="text-red-400" />} color="text-red-500" />
        <StatCard label="Net Income" value={netIncome} icon={<TrendingUp size={18} className="text-blue-500" />} color={netIncome >= 0 ? 'text-green-600' : 'text-red-500'} />
        <StatCard label="Cash Balance" value={cashBalance} icon={<Wallet size={18} className="text-blue-500" />} color={cashBalance >= 0 ? 'text-green-600' : 'text-red-500'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.key ? 'border-forest-700 text-forest-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t.label}</button>
        ))}
      </div>

      {loading ? <div className="text-center py-20 text-gray-400">Loading...</div> : (
        <>
          {/* Income Statement */}
          {tab === 'pl' && income && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-display font-bold text-base text-charcoal-900 mb-4">Profit & Loss Statement</h3>
                <ReportTable title="Revenue" color="text-green-600" items={income.revenue} totalLabel="Total Revenue" total={income.totalRevenue} />
                <div className="mt-6">
                  <ReportTable title="Expenses" color="text-red-500" items={income.expenses} totalLabel="Total Expenses" total={income.totalExpenses} />
                </div>
                <div className="flex justify-between items-center mt-6 pt-4 border-t-2 border-forest-600">
                  <span className="font-display font-bold text-lg">Net Income</span>
                  <span className={`font-display font-bold text-xl ${income.netIncome >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(income.netIncome)}</span>
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-display font-bold text-base text-charcoal-900 mb-4">Revenue vs Expenses</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Revenue</span><span className="font-medium text-green-600">{formatCurrency(totalRevenue)}</span></div>
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min(100, totalRevenue > 0 ? 100 : 0)}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Expenses</span><span className="font-medium text-red-500">{formatCurrency(totalExpenses)}</span></div>
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{ width: `${totalRevenue > 0 ? Math.min(100, (totalExpenses / totalRevenue) * 100) : (totalExpenses > 0 ? 100 : 0)}%` }} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Net Income</span><span className={`font-medium ${netIncome >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(netIncome)}</span></div>
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${netIncome >= 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${totalRevenue > 0 ? Math.min(100, Math.abs(netIncome / totalRevenue) * 100) : 0}%` }} /></div>
                  </div>
                </div>
                {income.expenses.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-charcoal-900 mb-3">Expense Breakdown</h4>
                    <div className="space-y-2">
                      {income.expenses.sort((a, b) => b.balance - a.balance).slice(0, 8).map((e, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600 truncate">{e.name}</span><span className="text-gray-800 font-medium">{formatCurrency(e.balance)}</span></div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-red-400 rounded-full" style={{ width: `${(e.balance / totalExpenses) * 100}%` }} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Balance Sheet */}
          {tab === 'bs' && balance && (
            <div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm mb-6">
                <div className="flex items-center justify-center gap-4 flex-wrap text-sm">
                  <div className="text-center"><span className="text-gray-500 block text-xs">Assets</span><span className="font-display font-bold text-lg">{formatCurrency(balance.totalAssets)}</span></div>
                  <span className="text-gray-400 text-lg">=</span>
                  <div className="text-center"><span className="text-gray-500 block text-xs">Liabilities</span><span className="font-display font-bold text-lg">{formatCurrency(balance.totalLiabilities)}</span></div>
                  <span className="text-gray-400 text-lg">+</span>
                  <div className="text-center"><span className="text-gray-500 block text-xs">Equity</span><span className="font-display font-bold text-lg">{formatCurrency(balance.totalEquity)}</span></div>
                </div>
              </div>
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <ReportTable title="Assets" color="text-green-600" items={balance.assets} totalLabel="Total Assets" total={balance.totalAssets} />
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <ReportTable title="Liabilities" color="text-red-500" items={balance.liabilities} totalLabel="Total Liabilities" total={balance.totalLiabilities} />
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <ReportTable title="Equity" color="text-blue-600" items={balance.equity} totalLabel="Total Equity" total={balance.totalEquity} />
                </div>
              </div>
            </div>
          )}

          {/* Cash Flow */}
          {tab === 'cf' && cashFlow && (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="font-semibold text-green-600 mb-3">Cash Inflows</h3>
                  {cashFlow.inflows.length === 0 ? <p className="text-sm text-gray-400">No inflows</p> : (
                    <div className="space-y-1.5">
                      {cashFlow.inflows.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50">
                          <span className="text-charcoal-800 truncate mr-3">{item.description}</span>
                          <span className="text-green-600 font-medium tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-sm pt-2 border-t border-gray-200">
                        <span>Total Inflows</span><span className="text-green-600">{formatCurrency(cashFlow.inflows.reduce((s, i) => s + i.amount, 0))}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <h3 className="font-semibold text-red-500 mb-3">Cash Outflows</h3>
                  {cashFlow.outflows.length === 0 ? <p className="text-sm text-gray-400">No outflows</p> : (
                    <div className="space-y-1.5">
                      {cashFlow.outflows.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-50">
                          <span className="text-charcoal-800 truncate mr-3">{item.description}</span>
                          <span className="text-red-500 font-medium tabular-nums shrink-0">{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-semibold text-sm pt-2 border-t border-gray-200">
                        <span>Total Outflows</span><span className="text-red-500">{formatCurrency(cashFlow.outflows.reduce((s, i) => s + i.amount, 0))}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-display font-bold text-base mb-4">Net Cash Flow</h3>
                <div className={`text-4xl font-display font-bold text-center py-12 ${cashFlow.netCashFlow >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatCurrency(cashFlow.netCashFlow)}
                </div>
              </div>
            </div>
          )}

          {/* General Ledger */}
          {tab === 'gl' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <h3 className="font-display font-bold text-base">Journal Entries</h3>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search entries..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-left text-xs text-gray-500"><th className="px-4 py-2 w-8" /><th className="px-4 py-2">Date</th><th className="px-4 py-2">Memo</th><th className="px-4 py-2">Source</th><th className="px-4 py-2 text-right">Debits</th><th className="px-4 py-2 text-right">Credits</th><th className="px-4 py-2 w-10" /></tr></thead>
                  <tbody>
                    {filteredJournal.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-400">No journal entries found</td></tr>
                    ) : filteredJournal.map(entry => {
                      const totalD = entry.lines.reduce((s, l) => s + l.debit, 0)
                      const totalC = entry.lines.reduce((s, l) => s + l.credit, 0)
                      const expanded = expandedId === entry.id
                      return (
                        <Fragment key={entry.id}>
                          <tr className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 ${entry.isVoid ? 'opacity-40 line-through' : ''}`} onClick={() => setExpandedId(expanded ? null : entry.id)}>
                            <td className="px-4 py-2.5">{expanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}</td>
                            <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{formatDate(entry.date)}</td>
                            <td className="px-4 py-2.5 truncate max-w-[200px]">{entry.memo || '—'}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                                entry.sourceType === 'reversal' ? 'bg-red-50 text-red-700' :
                                entry.sourceType === 'expense' ? 'bg-amber-50 text-amber-700' :
                                entry.sourceType === 'revenue' ? 'bg-green-50 text-green-700' :
                                'bg-gray-50 text-gray-600'
                              }`}>{entry.sourceType}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totalD)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totalC)}</td>
                            <td className="px-4 py-2.5">
                              {!entry.isVoid && entry.sourceType !== 'reversal' && (
                                <button onClick={e => { e.stopPropagation(); handleVoid(entry.id) }} className="text-gray-300 hover:text-red-500" title="Void entry"><Ban size={14} /></button>
                              )}
                            </td>
                          </tr>
                          {expanded && entry.lines && (
                            <tr><td colSpan={7} className="bg-gray-50/50 px-8 py-3">
                              <table className="w-full text-xs">
                                <thead><tr className="text-gray-500"><th className="text-left py-1">Account</th><th className="text-right py-1">Debit</th><th className="text-right py-1">Credit</th></tr></thead>
                                <tbody>
                                  {entry.lines.map((line, i) => {
                                    const acct = accounts.find(a => a.id === line.accountId)
                                    return (
                                      <tr key={i} className="border-b border-gray-100 last:border-0">
                                        <td className="py-1.5">{acct?.name || line.accountId}</td>
                                        <td className="py-1.5 text-right tabular-nums">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                                        <td className="py-1.5 text-right tabular-nums">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </td></tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">{filteredJournal.length} entries</div>
            </div>
          )}
        </>
      )}

      {/* Revenue Dialog */}
      {showRevDialog && <QuickEntryDialog title="Record Revenue" type="revenue" accounts={revenueAccounts} onClose={() => setShowRevDialog(false)} onSave={async (data) => { await adminFetch('/api/accounting/revenue', { method: 'POST', body: JSON.stringify(data) }); fetchData(); setShowRevDialog(false) }} />}
      {showExpDialog && <QuickEntryDialog title="Record Expense" type="expense" accounts={expenseAccounts} onClose={() => setShowExpDialog(false)} onSave={async (data) => { await adminFetch('/api/accounting/expense', { method: 'POST', body: JSON.stringify(data) }); fetchData(); setShowExpDialog(false) }} />}
      {showDrawDialog && <DrawDialog onClose={() => setShowDrawDialog(false)} onSave={async (data) => { await adminFetch('/api/accounting/owner-draw', { method: 'POST', body: JSON.stringify(data) }); fetchData(); setShowDrawDialog(false) }} />}
    </AdminLayout>
  )
}

function Fragment({ children }) { return <>{children}</> }

function QuickEntryDialog({ title, type, accounts, onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    const key = type === 'revenue' ? 'revenueAccountId' : 'expenseAccountId'
    await onSave({ amount: parseFloat(amount), [key]: accountId, paymentMethod, memo })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">{title}</h3><button onClick={onClose}><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label><input type="number" step="0.01" min="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none text-lg font-medium" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select required value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none">
              <option value="">Select category</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
            <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:border-forest-500 outline-none">
              <option value="cash">Cash / Debit</option>
              <option value="check">Check</option>
              <option value="credit_card">Credit Card</option>
              <option value="stripe">Stripe</option>
            </select>
          </div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Memo</label><textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="Description..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none" /></div>
          <button type="submit" disabled={saving || !amount || !accountId} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Posting...' : 'Post to Ledger'}</button>
        </form>
      </div>
    </div>
  )
}

function DrawDialog({ onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b"><h3 className="font-display font-bold text-lg">Owner's Draw</h3><button onClick={onClose}><X size={20} /></button></div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500">Record a personal withdrawal. This reduces Cash and Equity — it does not affect your P&L.</p>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Amount ($)</label><input type="number" step="0.01" min="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none text-lg font-medium" /></div>
          <div><label className="block text-xs font-medium text-gray-700 mb-1">Memo (optional)</label><textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="e.g. Transfer to personal checking" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-forest-500 outline-none resize-none" /></div>
          <button onClick={async () => { setSaving(true); await onSave({ amount: parseFloat(amount), memo }); setSaving(false) }} disabled={saving || !amount} className="w-full btn-primary py-2.5 disabled:opacity-50">{saving ? 'Posting...' : 'Post to Ledger'}</button>
        </div>
      </div>
    </div>
  )
}
