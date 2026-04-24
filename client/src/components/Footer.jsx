import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin } from 'lucide-react'
import { LogoIcon } from './Logo'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-charcoal-950 text-gray-400 pt-16 pb-24 md:pb-8">
      <div className="container-max px-4 sm:px-6 lg:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <LogoIcon size={40} />
              <div className="leading-tight">
                <div className="font-display font-extrabold text-white text-base tracking-tight">FRONTLINE</div>
                <div className="text-[10px] text-gray-500 font-medium tracking-wide uppercase">Termite & Pest Control</div>
              </div>
            </Link>
            <p className="text-sm leading-relaxed mb-4">
              Oklahoma's Front Line Against Pests. Locally owned and operated by Jimmy Manharth in Edmond, Oklahoma.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-display font-bold text-white text-sm uppercase tracking-wider mb-4">Services</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/services#termite" className="hover:text-white transition-colors">Termite Treatment</Link></li>
              <li><Link to="/services#pest" className="hover:text-white transition-colors">General Pest Control</Link></li>
              <li><Link to="/services#rodent" className="hover:text-white transition-colors">Rodent Control</Link></li>
              <li><Link to="/services#inspection" className="hover:text-white transition-colors">Inspections</Link></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-bold text-white text-sm uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link to="/services" className="hover:text-white transition-colors">Services</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-white text-sm uppercase tracking-wider mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="tel:4055311034" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone size={16} className="text-forest-500" />
                  Jimmy — (405) 531-1034
                </a>
              </li>
              <li>
                <a href="tel:3488688231" className="flex items-center gap-2 hover:text-white transition-colors">
                  <Phone size={16} className="text-forest-500" />
                  Jarret — 348-868-8231
                </a>
              </li>
              <li>
                <span className="flex items-center gap-2">
                  <MapPin size={16} className="text-forest-500" />
                  Edmond, Oklahoma
                </span>
              </li>
              <li>
                <span className="flex items-center gap-2">
                  <Mail size={16} className="text-forest-500" />
                  info@frontlinepestok.com
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-charcoal-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>&copy; {currentYear} Frontline Termite and Pest Control. All rights reserved.</p>
          <p>Designed by <a href="https://www.blackridgeplatforms.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">BlackRidge Platforms</a></p>
        </div>
      </div>
    </footer>
  )
}
