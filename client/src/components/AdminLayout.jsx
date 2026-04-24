import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Kanban, FileText, Calculator, Users, UserSquare, LogOut, Menu, X, ChevronRight, DollarSign, Receipt, TrendingUp, ClipboardList, BookOpen, Shield, Settings, Package, Link2, HardHat, Car } from 'lucide-react'
import { LogoIcon } from './Logo'

const navItems = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Leads', to: '/admin/leads', icon: Users },
  { label: 'Customers', to: '/admin/customers', icon: UserSquare },
  { label: 'Jobs', to: '/admin/jobs', icon: Kanban },
  { label: 'Technicians', to: '/admin/technicians', icon: HardHat },
  { label: 'Services', to: '/admin/services', icon: Package },
  { label: 'Invoices', to: '/admin/invoices', icon: FileText },
  { label: 'Pay Links', to: '/admin/pay-links', icon: Link2 },
  { label: 'Accounting', to: '/admin/accounting', icon: Calculator },
  { section: 'Financials' },
  { label: 'Financials', to: '/admin/financials', icon: TrendingUp },
  { label: 'Expenses', to: '/admin/expenses', icon: Receipt },
  { label: 'Bills / AP', to: '/admin/bills', icon: DollarSign },
  { label: 'Mileage', to: '/admin/mileage', icon: Car },
  { label: 'Budget', to: '/admin/budget', icon: ClipboardList },
  { label: 'Tax Center', to: '/admin/tax', icon: BookOpen },
  { label: 'Audit Trail', to: '/admin/audit', icon: Shield },
  { section: 'Account' },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
]

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('frontline_admin_token')
    navigate('/admin')
  }

  // A nav item is active if the current pathname matches exactly OR begins
  // with `${to}/` (so /admin/customers/abc123 still highlights the
  // Customers tab and its title renders in the header).
  const isActive = (to) => location.pathname === to || location.pathname.startsWith(to + '/')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-charcoal-900 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-5 border-b border-charcoal-800">
          <div className="flex items-center justify-between">
            <Link to="/admin/dashboard" className="flex items-center gap-2.5">
              <LogoIcon size={36} />
              <div>
                <div className="font-display font-bold text-white text-sm">FRONTLINE</div>
                <div className="text-[10px] text-gray-500">Admin Portal</div>
              </div>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item, i) =>
            item.section ? (
              <div key={item.section} className="pt-4 pb-1 px-3">
                <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">{item.section}</div>
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive(item.to)
                    ? 'bg-forest-700 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-charcoal-800'
                }`}
              >
                <item.icon size={18} />
                {item.label}
                {isActive(item.to) && <ChevronRight size={14} className="ml-auto" />}
              </Link>
            )
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-charcoal-800">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors mb-1"
          >
            View Website →
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-charcoal-800 transition-colors w-full"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 lg:px-6 shrink-0 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600 mr-3">
            <Menu size={22} />
          </button>
          <h1 className="font-display font-bold text-charcoal-900 text-lg">
            {navItems.find(n => isActive(n.to))?.label || 'Admin'}
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
