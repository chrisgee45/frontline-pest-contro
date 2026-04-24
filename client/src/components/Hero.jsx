import { Phone, FileText, ShieldCheck, Clock, Award } from 'lucide-react'
import { SpiderWeb, Spider } from './PestDecor'

export default function Hero() {
  return (
    <section className="relative min-h-[600px] md:min-h-[700px] flex items-center bg-charcoal-950 pt-28 md:pt-32 overflow-hidden">
      {/* Background image overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1920&q=80')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal-950 via-charcoal-950/90 to-charcoal-950/60" />
      </div>

      {/* Pest-themed decoration — subtle cobweb in the upper right,
          plus a spider dangling on a silk thread. Placed behind the
          content wrapper so the headline and buttons sit on top. */}
      <SpiderWeb className="pointer-events-none absolute top-16 right-0 w-56 md:w-80 h-56 md:h-80 text-forest-300/15 -scale-x-100 z-[1]" />
      <Spider
        withThread
        className="pointer-events-none absolute top-16 right-10 md:right-24 w-9 md:w-12 h-[72px] md:h-[96px] text-forest-300/50 z-[1]"
      />

      <div className="relative z-10 container-max px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        <div className="max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-forest-700/20 border border-forest-600/30 text-forest-300 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <ShieldCheck size={16} />
            Licensed & Insured — Locally Owned
          </div>

          {/* Headline */}
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl text-white leading-[1.1] mb-4">
            Oklahoma's Front Line
            <span className="block text-forest-400">Against Pests</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-gray-300 mb-8 leading-relaxed max-w-xl">
            Protecting Oklahoma homes and businesses from termites, rodents, and pests with expert treatment backed by our satisfaction guarantee. Owned and operated by Jimmy Manharth.
          </p>

          {/* CTAs — two call buttons side-by-side, then Get a Free Quote
              centered directly beneath them. Shrinks the wrapper to
              match the phone-row width on desktop (w-fit) so self-center
              on the Free Quote lines up with the midpoint of the two
              phone buttons rather than the full hero column. */}
          <div className="flex flex-col items-start gap-4 mb-10 w-full sm:w-fit">
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <a href="tel:4055311034" className="btn-cta">
                <Phone size={22} />
                Call Jimmy 405-531-1034
              </a>
              <a href="tel:3488688231" className="btn-cta">
                <Phone size={22} />
                Call Jarrett 348-868-8231
              </a>
            </div>
            <a href="#contact" className="btn-secondary text-lg py-4 px-8 self-stretch sm:self-center justify-center">
              <FileText size={20} />
              Get a Free Quote
            </a>
          </div>

          {/* Quick trust indicators */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-400">
            <span className="flex items-center gap-1.5">
              <Clock size={16} className="text-forest-400" />
              Same-Day Service
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-forest-400" />
              100% Satisfaction Guarantee
            </span>
            <span className="flex items-center gap-1.5">
              <Award size={16} className="text-forest-400" />
              Serving All of Oklahoma
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
