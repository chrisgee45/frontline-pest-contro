import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, Save, DollarSign, FileText, Calendar, CheckCircle, AlertTriangle, Clock, Download, UserCheck } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken, formatCurrency } from '../hooks/useAdmin'

const SCHEDULE_C_LINES = {
  '1': 'Gross Receipts', '8': 'Advertising', '9': 'Car/Truck Expenses', '10': 'Commissions',
  '11': 'Contract Labor', '13': 'Depreciation', '15': 'Insurance', '17': 'Legal/Professional',
  '18': 'Office Expense', '20b': 'Rent', '22': 'Supplies', '24a': 'Travel/Meals',
  '25': 'Utilities', '27a': 'Other Expenses',
}

const QUARTER_DATES = [
  { q: 1, label: 'Q1', month: 3, day: 15 },
  { q: 2, label: 'Q2', month: 5, day: 15 },
  { q: 3, label: 'Q3', month: 8, day: 15 },
  { q: 4, label: 'Q4', month: 0, day: 15, nextYear: true },
]

export default function AdminTax() {
  const [settings, setSettings] = useState({ federalRate: '22', stateRate: '5', stateName: 'Oklahoma', filingType: 'sole_prop', selfEmploymentRate: '15.3', qbiDeduction: true, taxpayerName: 'Jimmy Manharth', taxpayerSSN: '', spouseName: '', spouseSSN: '', address: '', city: 'Edmond', taxState: 'OK', zip: '' })
  const [income, setIncome] = useState(null)
  const [payments, setPayments] = useState([])
  const [report1099, setReport1099] = useState(null)
  const [report1099Year, setReport1099Year] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()
  const year = new Date().getFullYear()

  const fetchData = useCallback(async () => {
    if (!getToken()) { navigate('/admin'); return }
    const [settingsRes, incomeRes, paymentsRes, report1099Res] = await Promise.all([
      adminFetch('/api/accounting/tax-settings'),
      adminFetch(`/api/accounting/income-statement?start=${year}-01-01&end=${year}-12-31`),
      adminFetch(`/api/accounting/quarterly-payments/${year}`),
      adminFetch(`/api/accounting/1099-report?year=${report1099Year}`),
    ])
    if (settingsRes?.data) setSettings(settingsRes.data)
    if (incomeRes?.data) setIncome(incomeRes.data)
    if (paymentsRes?.data) setPayments(paymentsRes.data)
    if (report1099Res?.data) setReport1099(report1099Res.data)
    setLoading(false)
  }, [navigate, year, report1099Year])

  useEffect(() => { fetchData() }, [fetchData])

  const saveSettings = async () => {
    setSaving(true)
    await adminFetch('/api/accounting/tax-settings', { method: 'PUT', body: JSON.stringify(settings) })
    setSaving(false)
  }

  const savePayment = async (data) => {
    await adminFetch('/api/accounting/quarterly-payments', { method: 'PUT', body: JSON.stringify(data) })
    fetchData()
  }

  const taxCalc = useMemo(() => {
    const grossIncome = income?.totalRevenue || 0
    const totalDeductions = income?.totalExpenses || 0
    const netProfit = grossIncome - totalDeductions
    const fedRate = parseFloat(settings.federalRate) / 100 || 0
    const stRate = parseFloat(settings.stateRate) / 100 || 0
    const seRate = parseFloat(settings.selfEmploymentRate) / 100 || 0
    const selfEmploymentTax = netProfit > 0 ? netProfit * 0.9235 * seRate : 0
    const incomeTaxEstimate = netProfit > 0 ? netProfit * (fedRate + stRate) : 0
    const qbiDeduction = settings.qbiDeduction && netProfit > 0 ? netProfit * 0.2 : 0
    const totalTax = Math.max(0, selfEmploymentTax + incomeTaxEstimate - (settings.qbiDeduction ? qbiDeduction * (fedRate + stRate) : 0))
    const effectiveRate = netProfit > 0 ? (totalTax / netProfit) * 100 : 0
    return { grossIncome, totalDeductions, netProfit, selfEmploymentTax, incomeTaxEstimate, qbiDeduction, totalTax, effectiveRate }
  }, [income, settings])

  const scheduleCData = useMemo(() => {
    if (!income) return []
    const lineMap = {}
    // Revenue
    for (const r of income.revenue || []) {
      if (r.scheduleCLine) lineMap[r.scheduleCLine] = (lineMap[r.scheduleCLine] || 0) + Math.abs(r.balance)
    }
    // Expenses
    for (const e of income.expenses || []) {
      if (e.scheduleCLine) lineMap[e.scheduleCLine] = (lineMap[e.scheduleCLine] || 0) + Math.abs(e.balance)
    }
    return Object.entries(SCHEDULE_C_LINES).map(([line, desc]) => ({ line, description: desc, amount: lineMap[line] || 0 }))
  }, [income])

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-400">Loading...</div></AdminLayout>

  return (
    <AdminLayout>
      <h2 className="font-display font-bold text-xl text-charcoal-900 mb-6">Tax Center</h2>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Settings */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-base flex items-center gap-2"><Calculator size={18} className="text-forest-700" />Tax Settings</h3>
            <button onClick={saveSettings} disabled={saving} className="btn-primary text-xs py-1.5 px-3"><Save size={14} />{saving ? 'Saving...' : 'Save'}</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-gray-500 mb-1">Federal Rate (%)</label><input type="number" step="0.1" value={settings.federalRate} onChange={e => setSettings({...settings, federalRate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">State Rate (%)</label><input type="number" step="0.1" value={settings.stateRate} onChange={e => setSettings({...settings, stateRate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">State</label><input value={settings.stateName} onChange={e => setSettings({...settings, stateName: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div><label className="block text-xs text-gray-500 mb-1">Filing Type</label>
              <select value={settings.filingType} onChange={e => setSettings({...settings, filingType: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                <option value="sole_prop">Sole Proprietor</option><option value="llc">LLC</option><option value="s_corp">S-Corp</option>
              </select>
            </div>
            <div><label className="block text-xs text-gray-500 mb-1">SE Tax Rate (%)</label><input type="number" step="0.1" value={settings.selfEmploymentRate} onChange={e => setSettings({...settings, selfEmploymentRate: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            <div className="flex items-center gap-2 pt-5"><input type="checkbox" checked={settings.qbiDeduction} onChange={e => setSettings({...settings, qbiDeduction: e.target.checked})} className="rounded" /><label className="text-sm">QBI Deduction (20%)</label></div>
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Taxpayer Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-gray-500 mb-1">Name</label><input value={settings.taxpayerName} onChange={e => setSettings({...settings, taxpayerName: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">SSN</label><input value={settings.taxpayerSSN} onChange={e => setSettings({...settings, taxpayerSSN: e.target.value})} placeholder="XXX-XX-XXXX" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">City</label><input value={settings.city} onChange={e => setSettings({...settings, city: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
              <div><label className="block text-xs text-gray-500 mb-1">State / ZIP</label><div className="flex gap-2"><input value={settings.taxState} onChange={e => setSettings({...settings, taxState: e.target.value})} placeholder="OK" maxLength={2} className="w-16 px-3 py-2 rounded-lg border border-gray-200 text-sm" /><input value={settings.zip} onChange={e => setSettings({...settings, zip: e.target.value})} placeholder="ZIP" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div></div>
            </div>
          </div>
        </div>

        {/* Tax Summary */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-display font-bold text-base flex items-center gap-2 mb-4"><DollarSign size={18} className="text-green-600" />Tax Summary ({year})</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Gross Income</span><span className="tabular-nums">{formatCurrency(taxCalc.grossIncome)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total Deductions</span><span className="tabular-nums text-gray-500">({formatCurrency(taxCalc.totalDeductions)})</span></div>
            <div className="flex justify-between font-semibold pt-2 border-t"><span>Net Profit</span><span className="tabular-nums">{formatCurrency(taxCalc.netProfit)}</span></div>
            <div className="flex justify-between pt-2 border-t"><span className="text-gray-500">Self-Employment Tax</span><span className="tabular-nums">{formatCurrency(taxCalc.selfEmploymentTax)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Income Tax Estimate</span><span className="tabular-nums">{formatCurrency(taxCalc.incomeTaxEstimate)}</span></div>
            {settings.qbiDeduction && <div className="flex justify-between"><span className="text-gray-500">QBI Deduction (20%)</span><span className="tabular-nums text-gray-500">({formatCurrency(taxCalc.qbiDeduction)})</span></div>}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-forest-600"><span>Total Tax Liability</span><span className={`tabular-nums ${taxCalc.totalTax > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(taxCalc.totalTax)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Effective Rate</span><span className="tabular-nums">{taxCalc.effectiveRate.toFixed(1)}%</span></div>
          </div>
        </div>
      </div>

      {/* Schedule C Preview */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mb-6">
        <h3 className="font-display font-bold text-base flex items-center gap-2 mb-4"><FileText size={18} className="text-forest-700" />Schedule C Preview</h3>
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left text-xs text-gray-500"><th className="px-4 py-2 w-24">Line</th><th className="px-4 py-2">Description</th><th className="px-4 py-2 text-right w-36">Amount</th></tr></thead>
          <tbody>
            {scheduleCData.map(row => (
              <tr key={row.line} className="border-b border-gray-50"><td className="px-4 py-2 font-mono text-xs text-gray-400">Line {row.line}</td><td className="px-4 py-2">{row.description}</td><td className="px-4 py-2 text-right tabular-nums">{row.amount > 0 ? formatCurrency(row.amount) : '—'}</td></tr>
            ))}
            <tr className="font-semibold border-t-2"><td /><td className="px-4 py-2">Total</td><td className="px-4 py-2 text-right tabular-nums">{formatCurrency(scheduleCData.reduce((s, r) => s + r.amount, 0))}</td></tr>
          </tbody>
        </table>
      </div>

      {/* 1099 Contractors (NEC) — required filing by Jan 31 of the
          following year for any vendor paid $600+ in reportable methods. */}
      {report1099 && (
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mb-6">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <div>
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <UserCheck size={18} className="text-forest-700" />1099-NEC Contractors
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Vendors flagged as 1099 contractors, with year-to-date totals.
                Payments of <strong>$600+</strong> in cash/check/ACH/transfer trigger a 1099-NEC filing by Jan 31.
                Credit card + Stripe payments are reported by the processor on 1099-K, not here.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={report1099Year}
                onChange={e => setReport1099Year(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm bg-white"
              >
                {[year + 1, year, year - 1, year - 2, year - 3].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <a
                href={`/api/accounting/1099-report/csv?year=${report1099Year}`}
                download
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1"
                title="Download the full report as CSV to hand to your CPA"
              >
                <Download size={14} />Export CSV
              </a>
            </div>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">1099 Vendors</div>
              <div className="text-xl font-display font-bold text-charcoal-900 mt-0.5">{report1099.summary.vendors1099}</div>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Need 1099-NEC</div>
              <div className="text-xl font-display font-bold text-amber-700 mt-0.5">{report1099.summary.needing1099}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">threshold ${report1099.summary.threshold}</div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Reportable Paid</div>
              <div className="text-xl font-display font-bold text-charcoal-900 mt-0.5 tabular-nums">{formatCurrency(report1099.summary.totalReportable)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">goes on 1099-NEC</div>
            </div>
            <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Non-Reportable</div>
              <div className="text-xl font-display font-bold text-gray-700 mt-0.5 tabular-nums">{formatCurrency(report1099.summary.totalNonReportable)}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">card/Stripe</div>
            </div>
          </div>

          {/* Missing info warning */}
          {report1099.summary.missingInfo > 0 && (
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>{report1099.summary.missingInfo} vendor{report1099.summary.missingInfo === 1 ? '' : 's'} missing info.</strong>{' '}
                You need a Tax ID (SSN or EIN) and a mailing address for every 1099-NEC filing.
                Update the vendor records under Expenses → Add Vendor, or click a row below.
              </div>
            </div>
          )}

          {/* Vendor table */}
          {report1099.vendors.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 bg-gray-50 rounded-lg">
              No 1099-flagged vendors yet, and no payments on record for {report1099.summary.year}.
              <div className="text-xs text-gray-400 mt-1">Flag a vendor as 1099 under Expenses → Add Vendor or edit an existing one.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-left text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="px-3 py-2 font-semibold">Vendor</th>
                    <th className="px-3 py-2 font-semibold">Tax ID</th>
                    <th className="px-3 py-2 font-semibold text-right">Reportable</th>
                    <th className="px-3 py-2 font-semibold text-right hidden md:table-cell">Non-Reportable</th>
                    <th className="px-3 py-2 font-semibold text-right">Total</th>
                    <th className="px-3 py-2 font-semibold">1099?</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report1099.vendors.map(v => (
                    <tr key={v.id} className={v.needs1099 ? 'bg-amber-50/30' : ''}>
                      <td className="px-3 py-2">
                        <div className="font-medium text-charcoal-900">{v.name}</div>
                        {v.is1099 && !v.needs1099 && (
                          <div className="text-[10px] text-gray-400">1099-flagged</div>
                        )}
                        {!v.address && v.needs1099 && (
                          <div className="text-[10px] text-amber-700">⚠ Missing address</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 font-mono">
                        {v.taxId || (v.needs1099
                          ? <span className="text-amber-700">⚠ Missing</span>
                          : <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(v.totals.reportable)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">{formatCurrency(v.totals.nonReportable)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(v.totals.total)}</td>
                      <td className="px-3 py-2">
                        {v.needs1099 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                            <AlertTriangle size={10} />File 1099-NEC
                          </span>
                        ) : v.is1099 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">
                            Under threshold
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">N/A (not 1099)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-gray-400 mt-3 italic">
            Note: this report aggregates payments across the direct expenses feed AND bill payments (AP). Voided payments are excluded. Consult your CPA for edge cases like attorney fees (always reportable regardless of amount or entity type) or payments to incorporated vendors.
          </p>
        </div>
      )}

      {/* Quarterly Payments */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <h3 className="font-display font-bold text-base flex items-center gap-2 mb-4"><Calendar size={18} className="text-forest-700" />Quarterly Estimated Payments ({year})</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {QUARTER_DATES.map(q => {
            const dueYear = q.nextYear ? year + 1 : year
            const dueDate = new Date(dueYear, q.month, q.day)
            const estimated = taxCalc.totalTax / 4
            const existing = payments.find(p => p.quarter === q.q)
            const paidAmt = existing ? parseFloat(existing.paidAmount || '0') : 0
            const remaining = Math.max(0, estimated - paidAmt)
            const isPastDue = new Date() > dueDate
            const status = paidAmt >= estimated && estimated > 0 ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid'

            return <QuarterCard key={q.q} quarter={q.q} label={q.label} dueDate={dueDate} estimated={estimated} paidAmount={paidAmt} remaining={remaining} status={status} isPastDue={isPastDue} year={year} onSave={savePayment} />
          })}
        </div>
      </div>
    </AdminLayout>
  )
}

function QuarterCard({ quarter, label, dueDate, estimated, paidAmount, remaining, status, isPastDue, year, onSave }) {
  const [editPaid, setEditPaid] = useState(String(paidAmount || ''))
  const [editDate, setEditDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setEditPaid(String(paidAmount || '')) }, [paidAmount])

  const borderColor = status === 'paid' ? 'border-green-300' : status === 'partial' ? 'border-amber-300' : isPastDue ? 'border-red-300' : 'border-gray-200'
  const StatusIcon = status === 'paid' ? CheckCircle : status === 'partial' ? Clock : isPastDue ? AlertTriangle : Clock
  const statusColor = status === 'paid' ? 'text-green-600' : status === 'partial' ? 'text-amber-600' : isPastDue ? 'text-red-600' : 'text-gray-400'

  return (
    <div className={`rounded-xl border-2 ${borderColor} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><StatusIcon size={16} className={statusColor} /><span className="font-semibold text-sm">{label}</span></div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status === 'paid' ? 'bg-green-50 text-green-700' : status === 'partial' ? 'bg-amber-50 text-amber-700' : isPastDue ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600'}`}>{status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : isPastDue ? 'Past Due' : 'Upcoming'}</span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Due</span><span className="tabular-nums">{dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Estimated</span><span className="tabular-nums">{formatCurrency(estimated)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Remaining</span><span className={`tabular-nums font-medium ${remaining > 0 ? 'text-amber-600' : 'text-green-600'}`}>{formatCurrency(remaining)}</span></div>
      </div>
      <div className="pt-2 border-t space-y-2">
        <div><label className="text-[10px] text-gray-500">Paid Amount</label><input type="number" step="0.01" value={editPaid} onChange={e => setEditPaid(e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm" /></div>
        <div><label className="text-[10px] text-gray-500">Paid Date</label><input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full px-2 py-1.5 rounded border border-gray-200 text-sm" /></div>
        <button onClick={async () => { setSaving(true); await onSave({ year, quarter, dueDate: dueDate.toISOString(), estimatedAmount: estimated.toFixed(2), paidAmount: editPaid || '0', paidDate: editDate || null }); setSaving(false) }} disabled={saving} className="w-full px-3 py-1.5 rounded-lg text-xs font-medium bg-forest-700 hover:bg-forest-800 text-white disabled:opacity-50">
          <Save size={12} className="inline mr-1" />{saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
