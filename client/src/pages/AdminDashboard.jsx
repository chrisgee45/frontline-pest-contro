import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Kanban, FileText, DollarSign, TrendingUp, TrendingDown, Clock, ArrowUpRight, UserPlus, Briefcase, Receipt, Calculator } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, formatCurrency, timeAgo, getToken } from '../hooks/useAdmin'

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <div className="font-display font-bold text-2xl text-charcoal-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

const activityIcons = {
  lead: UserPlus,
  job: Briefcase,
  invoice: Receipt,
  accounting: Calculator,
}

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!getToken()) { navigate('/admin'); return }
    adminFetch('/api/admin/dashboard').then(d => { setData(d); setLoading(false) })
  }, [navigate])

  if (loading) return <AdminLayout><div className="text-center py-20 text-gray-500">Loading...</div></AdminLayout>

  const d = data
  const maxBar = Math.max(...d.monthlyRevenue.map(m => Math.max(m.income, m.expense)), 1)

  return (
    <AdminLayout>
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="New Leads" value={d.leads.new} sub={`${d.leads.total} total`} color="bg-blue-600" />
        <StatCard icon={Kanban} label="Active Jobs" value={d.jobs.scheduled + d.jobs.inProgress} sub={`${d.jobs.completed} completed`} color="bg-amber-500" />
        <StatCard icon={DollarSign} label="Month Revenue" value={formatCurrency(d.revenue.monthRevenue)} sub={`${formatCurrency(d.revenue.monthProfit)} profit`} color="bg-green-600" />
        <StatCard icon={FileText} label="Outstanding" value={formatCurrency(d.invoices.outstandingAmount)} sub={`${d.invoices.sent} unpaid invoices`} color="bg-red-500" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-display font-bold text-charcoal-900 mb-4">Revenue Overview</h3>
          <div className="space-y-3">
            {d.monthlyRevenue.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-16 text-xs text-gray-500 shrink-0">{m.month}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-5 rounded bg-forest-600 transition-all" style={{ width: `${(m.income / maxBar) * 100}%`, minWidth: m.income > 0 ? '4px' : '0' }} />
                    <span className="text-xs text-gray-600 shrink-0">{formatCurrency(m.income)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-5 rounded bg-red-400 transition-all" style={{ width: `${(m.expense / maxBar) * 100}%`, minWidth: m.expense > 0 ? '4px' : '0' }} />
                    <span className="text-xs text-gray-400 shrink-0">{formatCurrency(m.expense)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-forest-600" /> Income</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Expenses</span>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-display font-bold text-charcoal-900 mb-4">Recent Activity</h3>
          {d.recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {d.recentActivity.slice(0, 15).map(a => {
                const Icon = activityIcons[a.type] || Clock
                return (
                  <div key={a.id} className="flex gap-3 text-sm">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon size={14} className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-charcoal-800 leading-snug">{a.message}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{timeAgo(a.timestamp)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-2xl font-display font-bold text-charcoal-900">{d.leads.today}</div>
          <div className="text-xs text-gray-500">Leads Today</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-2xl font-display font-bold text-charcoal-900">{d.jobs.new}</div>
          <div className="text-xs text-gray-500">New Jobs</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-2xl font-display font-bold text-charcoal-900">{d.invoices.draft}</div>
          <div className="text-xs text-gray-500">Draft Invoices</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className="text-2xl font-display font-bold text-charcoal-900">{formatCurrency(d.revenue.total)}</div>
          <div className="text-xs text-gray-500">Total Revenue</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm text-center">
          <div className={`text-2xl font-display font-bold ${d.revenue.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(d.revenue.profit)}
          </div>
          <div className="text-xs text-gray-500">Total Profit</div>
        </div>
      </div>
    </AdminLayout>
  )
}
