import { Bug, Home, ClipboardCheck } from 'lucide-react'

const services = [
  {
    icon: Home,
    title: 'Termite Treatment',
    description: 'Comprehensive termite inspections and treatments using liquid barriers and bait systems to protect your home\'s structure from costly damage.',
    features: ['Liquid barrier treatment', 'Bait station systems', 'Annual inspections', 'Damage prevention'],
  },
  {
    icon: Bug,
    title: 'General Pest Control',
    description: 'Year-round protection from roaches, ants, spiders, wasps, and other common Oklahoma pests with targeted treatment plans.',
    features: ['Full yard & perimeter spray', 'Quarterly maintenance plans', 'Eco-friendly options', 'Family & pet safe'],
  },
  {
    icon: ClipboardCheck,
    title: 'Inspections',
    description: 'Detailed pest and termite inspections for home buyers, sellers, and property owners. Licensed inspectors with thorough reporting.',
    features: ['Real estate inspections', 'WDI/WDO reports', 'Pre-construction treatment', 'Annual monitoring'],
  },
]

export default function Services() {
  return (
    <section id="services" className="section-padding bg-gray-50">
      <div className="container-max">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <span className="text-forest-700 font-semibold text-sm uppercase tracking-wider">Our Services</span>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-charcoal-900 mt-2 mb-4">
            Complete Pest Protection for Your Home
          </h2>
          <p className="text-gray-600 text-lg">
            From termite treatment to general pest control, we provide comprehensive solutions tailored to Oklahoma's unique pest pressures.
          </p>
        </div>

        {/* Service cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 md:p-8 shadow-sm border border-gray-100 hover:shadow-lg hover:border-forest-200 transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-xl bg-forest-50 group-hover:bg-forest-700 flex items-center justify-center mb-5 transition-colors duration-300">
                <service.icon className="text-forest-700 group-hover:text-white transition-colors duration-300" size={28} />
              </div>
              <h3 className="font-display font-bold text-xl text-charcoal-900 mb-3">{service.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-5">{service.description}</p>
              <ul className="space-y-2">
                {service.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-forest-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <a href="#contact" className="btn-primary text-base py-3.5 px-8">
            Request a Free Inspection
          </a>
        </div>
      </div>
    </section>
  )
}
