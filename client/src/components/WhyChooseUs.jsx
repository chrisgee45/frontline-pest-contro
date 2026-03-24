import { ShieldCheck, Clock, MapPin, Heart, Award, Leaf } from 'lucide-react'

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
    <section id="why-us" className="section-padding bg-charcoal-900">
      <div className="container-max">
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
