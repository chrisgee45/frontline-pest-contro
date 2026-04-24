import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import StickyMobileCTA from './components/StickyMobileCTA'
import HomePage from './pages/HomePage'
import ServicesPage from './pages/ServicesPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminLeads from './pages/AdminLeads'
import AdminCustomers from './pages/AdminCustomers'
import AdminCustomerDetail from './pages/AdminCustomerDetail'
import AdminJobs from './pages/AdminJobs'
import AdminServices from './pages/AdminServices'
import AdminInvoices from './pages/AdminInvoices'
import AdminPayLinks from './pages/AdminPayLinks'
import PublicPayPage from './pages/PublicPayPage'
import AdminAccounting from './pages/AdminAccounting'
import AdminFinancials from './pages/AdminFinancials'
import AdminExpenses from './pages/AdminExpenses'
import AdminBills from './pages/AdminBills'
import AdminBudget from './pages/AdminBudget'
import AdminTax from './pages/AdminTax'
import AdminAudit from './pages/AdminAudit'
import AdminSettings from './pages/AdminSettings'
import ScrollToTop from './components/ScrollToTop'

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen">
        <Routes>
          {/* Admin routes — no header/footer */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/leads" element={<AdminLeads />} />
          <Route path="/admin/customers" element={<AdminCustomers />} />
          <Route path="/admin/customers/:id" element={<AdminCustomerDetail />} />
          <Route path="/admin/jobs" element={<AdminJobs />} />
          <Route path="/admin/services" element={<AdminServices />} />
          <Route path="/admin/invoices" element={<AdminInvoices />} />
          <Route path="/admin/pay-links" element={<AdminPayLinks />} />

          {/* Public customer-facing pay page — no admin auth. Reached
              from invoice emails and texted/copied pay links. */}
          <Route path="/pay/:token" element={<PublicPayPage mode="pay" />} />
          <Route path="/pay/:token/success" element={<PublicPayPage mode="success" />} />
          <Route path="/admin/accounting" element={<AdminAccounting />} />
          <Route path="/admin/financials" element={<AdminFinancials />} />
          <Route path="/admin/expenses" element={<AdminExpenses />} />
          <Route path="/admin/bills" element={<AdminBills />} />
          <Route path="/admin/budget" element={<AdminBudget />} />
          <Route path="/admin/tax" element={<AdminTax />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/settings" element={<AdminSettings />} />

          {/* Public routes */}
          <Route path="*" element={
            <>
              <Header />
              <main>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/services" element={<ServicesPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                </Routes>
              </main>
              <Footer />
              <StickyMobileCTA />
            </>
          } />
        </Routes>
      </div>
    </Router>
  )
}

export default App
