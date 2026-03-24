import { Link } from 'react-router-dom'
import { Phone, FileText } from 'lucide-react'

export default function StickyMobileCTA() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-charcoal-900 border-t border-charcoal-700 shadow-2xl">
      <div className="grid grid-cols-2 divide-x divide-charcoal-700">
        <a
          href="tel:4055311034"
          className="flex items-center justify-center gap-2 py-3.5 text-white font-semibold text-sm hover:bg-charcoal-800 transition-colors"
        >
          <Phone size={18} className="text-forest-400" />
          Call Now
        </a>
        <Link
          to="/contact"
          className="flex items-center justify-center gap-2 py-3.5 bg-forest-700 text-white font-semibold text-sm hover:bg-forest-800 transition-colors"
        >
          <FileText size={18} />
          Free Quote
        </Link>
      </div>
    </div>
  )
}
