import { ShieldCheck, Clock, MapPin, Heart, Award, Leaf } from 'lucide-react'
import { SpiderWeb, Spider } from './PestDecor'

const reasons = [
  {
    icon: ShieldCheck,
    title: 'Licensed & Insured',
    description: 'Fully licensed Oklahoma pest control professionals with comprehensive insurance coverage for your peace of mind.',
  },
  {
    icon: Clock,
    title: 'Same-Day Service',
    description: 'Emergency pest problems can\'t wait. We offer same-day service to get your pest issue resolved fast.',
  },
  {
    icon: MapPin,
    title: 'Locally Owned',
    description: 'Owner Jimmy Manharth lives and works right here in Edmond. We know Oklahoma pests because we live with them too.',
  },
  {
    icon: Heart,
    title: '100% Satisfaction Guarantee',
    description: 'Not happy? We\'ll come back and re-treat at no extra cost. Your satisfaction is our top priority.',
  },
  {
    icon: Award,
    title: 'Experienced Technicians',
    description: 'Our team brings years of hands-on experience tackling Oklahoma\'s toughest pest challenges.',
  },
  {
    icon: Leaf,
    title: 'Family & Pet Safe',
    description: 'We use targeted treatments that are tough on pests but safe for your family, pets, and the environment.',
  },
]

export default function WhyChooseUs() {
  return (
    <section id="why-us" className="relative overflow-hidden section-padding bg-charcoal-900">
      {/* Decorative cobwebs in the corners — subtle enough to read as
          atmosphere, not decoration that fights the content. */}
      <SpiderWeb className="pointer-events-none absolute top-0 left-0 w-64 md:w-96 h-64 md:h-96 text-forest-500/10" />
      <SpiderWeb className="pointer-events-none absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 text-forest-500/10 -scale-x-100" />
      <SpiderWeb className="pointer-events-none absolute bottom-0 right-0 w-40 md:w-56 h-40 md:h-56 text-forest-500/[0.07] -scale-100" />

      {/* Spider dangling from a silk thread near the top-right on
          desktop; centered on mobile where the corner webs overlap. */}
      <Spider
        withThread
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 md:left-auto md:right-24 md:translate-x-0 w-10 md:w-14 h-[80px] md:h-[112px] text-forest-400/40"
      />

      <div className="relative container-max">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <span className="text-forest-400 font-semibold text-sm uppercase tracking-wider">Why Frontline</span>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mt-2 mb-4">
            Why Oklahoma Trusts Frontline
          </h2>
          <p className="text-gray-400 text-lg">
            We're not a national chain. We're your neighbors — and we treat your home like our own.
          </p>
        </div>

        {/* Reasons grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {reasons.map((reason, i) => (
            <div key={i} className="flex gap-4 p-6 rounded-xl bg-charcoal-800/50 border border-charcoal-700/50 hover:border-forest-700/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-forest-700/20 flex items-center justify-center shrink-0">
                <reason.icon className="text-forest-400" size={24} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-white mb-1.5">{reason.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{reason.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
