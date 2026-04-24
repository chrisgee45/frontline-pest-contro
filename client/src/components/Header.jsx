import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Phone, Menu, X } from 'lucide-react'
import { LogoIcon } from './Logo'

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Services', to: '/services' },
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ]

  const isActive = (to) => location.pathname === to

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-charcoal-900/95 backdrop-blur-sm border-b border-charcoal-800">
      {/* Top bar */}
      <div className="bg-forest-700 text-white text-sm py-1.5">
        <div className="container-max flex justify-between items-center px-4 sm:px-6 lg:px-8">
          <span className="hidden sm:inline">Serving All of Oklahoma — Same-Day Service Available</span>
          <span className="sm:hidden text-center w-full">Same-Day Service Available</span>
          <div className="hidden sm:flex items-center gap-4">
            <a href="tel:4055311034" className="flex items-center gap-1.5 font-semibold hover:text-amber-300 transition-colors">
              <Phone size={14} />
              Jimmy (405) 531-1034
            </a>
            <a href="tel:3468688231" className="flex items-center gap-1.5 font-semibold hover:text-amber-300 transition-colors">
              <Phone size={14} />
              Jarret (346) 868-8231
            </a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <div className="container-max px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <LogoIcon size={44} />
            <div className="leading-tight">
              <div className="font-display font-extrabold text-white text-base md:text-lg tracking-tight">FRONTLINE</div>
              <div className="text-[10px] md:text-xs text-gray-400 font-medium tracking-wide uppercase">Termite & Pest Control</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium transition-colors ${
                  isActive(link.to) ? 'text-white' : 'text-gray-300 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <div className="flex flex-col items-end leading-tight">
              <a href="tel:4055311034" className="flex items-center gap-2 text-white font-semibold text-sm hover:text-amber-400 transition-colors">
                <Phone size={14} />
                Jimmy (405) 531-1034
              </a>
              <a href="tel:3468688231" className="flex items-center gap-2 text-white font-semibold text-sm hover:text-amber-400 transition-colors">
                <Phone size={14} />
                Jarret (346) 868-8231
              </a>
            </div>
            <Link to="/contact" className="btn-primary text-sm py-2.5 px-5">
              Free Quote
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-white p-2"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-charcoal-900 border-t border-charcoal-800">
          <nav className="container-max px-4 py-4 flex flex-col gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive(link.to) ? 'text-white bg-charcoal-800' : 'text-gray-300 hover:text-white hover:bg-charcoal-800'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a href="tel:4055311034" className="mt-2 btn-primary justify-center">
              <Phone size={18} />
              Call Jimmy (405) 531-1034
            </a>
            <a href="tel:3468688231" className="mt-2 btn-primary justify-center">
              <Phone size={18} />
              Call Jarret (346) 868-8231
            </a>
          </nav>
        </div>
      )}
    </header>
  )
}
