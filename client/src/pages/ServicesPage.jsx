import { Link } from 'react-router-dom'
import { Bug, Home, Rat, ClipboardCheck, Phone, CheckCircle, ArrowRight } from 'lucide-react'

const services = [
  {
    id: 'termite',
    icon: Home,
    title: 'Termite Treatment',
    tagline: 'Protect your biggest investment',
    description: 'Termites cause more than $5 billion in property damage annually across the United States, and Oklahoma\'s warm, humid climate makes it a hotspot for subterranean termite activity. Frontline Termite and Pest Control offers comprehensive termite solutions designed to eliminate active infestations and prevent future damage.',
    methods: [
      { name: 'Liquid Barrier Treatment', detail: 'We apply a continuous chemical barrier around your home\'s foundation, creating an impenetrable zone that kills termites on contact and prevents colony access to your structure.' },
      { name: 'Bait Station Systems', detail: 'Strategically placed monitoring stations around your property detect termite activity early. Once detected, bait is introduced that termites carry back to the colony, eliminating it at the source.' },
      { name: 'Pre-Construction Treatment', detail: 'Building a new home? We treat the soil before the slab is poured, creating a protective barrier from day one.' },
    ],
    features: ['Free termite inspections', 'Annual monitoring plans', 'WDI/WDO reports for real estate', 'Damage repair referrals', 'Retreatment guarantee'],
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
  },
  {
    id: 'pest',
    icon: Bug,
    title: 'General Pest Control',
    tagline: 'Year-round protection for your family',
    description: 'Oklahoma is home to a wide variety of pests that invade homes and businesses throughout the year — from roaches and ants in the summer to spiders and crickets seeking warmth in the fall. Frontline\'s general pest control programs provide ongoing protection with targeted treatments that are tough on pests but safe for your family and pets.',
    methods: [
      { name: 'Interior Treatment', detail: 'We treat baseboards, entry points, kitchens, bathrooms, and other high-activity areas using low-toxicity products that are effective against crawling insects.' },
      { name: 'Full Yard & Perimeter Spray', detail: 'We don\'t just spray a barrier around the foundation — we treat your entire yard. From the fence line to the front door, we spray the full property to eliminate pests where they live and breed before they ever reach your home.' },
      { name: 'Quarterly Maintenance Plans', detail: 'Regular scheduled treatments throughout the year keep pest populations controlled and prevent seasonal surges. Each visit includes a full yard and perimeter spray.' },
    ],
    features: ['Roaches, ants, spiders, crickets', 'Wasps, hornets, and stinging insects', 'Flea and tick treatments', 'Eco-friendly product options'],
    image: 'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800&q=80',
  },
  {
    id: 'rodent',
    icon: Rat,
    title: 'Rodent Control',
    tagline: 'Mice and rat control with lasting exclusion',
    description: 'Mice and rats chew electrical wiring, contaminate food, and spread disease. Oklahoma\'s mix of urban and rural environments gives rodent populations ideal conditions. Frontline focuses on finding how they\'re getting in and shutting those entry points down so the problem doesn\'t come back.',
    methods: [
      { name: 'Inspection & Entry Point Identification', detail: 'Our technicians inspect your home inside and out to find every gap, crack, and opening that rodents use to gain entry. Mice can squeeze through a hole the size of a dime, so a thorough inspection is the foundation of the service.' },
      { name: 'Exclusion & Sealing', detail: 'We seal identified entry points with professional-grade materials designed to stand up to chewing and weather. This is the most important step for long-term control — without it, any other treatment is temporary.' },
      { name: 'Ongoing Monitoring & Prevention', detail: 'Follow-up visits check the seals, look for new activity, and catch any issues before they grow. Recommended for older homes, homes near fields or water, and properties with recurring rodent pressure.' },
    ],
    features: ['Mice and rat control', 'Entry point identification', 'Exclusion & sealing', 'Attic and crawl space inspection', 'Ongoing monitoring available'],
    image: 'https://images.unsplash.com/photo-1589652717521-10c0d092dea9?w=800&q=80',
  },
  {
    id: 'inspection',
    icon: ClipboardCheck,
    title: 'Inspections',
    tagline: 'Know exactly what you\'re dealing with',
    description: 'Whether you\'re buying a home, selling a property, or just want peace of mind, a professional pest inspection gives you the knowledge you need to make informed decisions. Frontline\'s licensed inspectors provide thorough, honest assessments with detailed reporting that meets Oklahoma real estate and lending requirements.',
    methods: [
      { name: 'Real Estate / WDI Inspections', detail: 'Wood-Destroying Insect (WDI) reports required by many lenders. We inspect the entire accessible structure and provide official documentation of findings.' },
      { name: 'Annual Property Inspections', detail: 'Yearly inspections catch pest problems early before they become expensive. Recommended for all Oklahoma homeowners.' },
      { name: 'Pre-Purchase Inspections', detail: 'Buying a home? We\'ll give you an honest assessment of any pest issues so you can negotiate with confidence.' },
    ],
    features: ['WDI/WDO official reports', 'Same-day inspection available', 'Digital reports with photos', 'Licensed Oklahoma inspectors', 'Fast turnaround for closings'],
    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  },
]

export default function ServicesPage() {
  return (
    <>
      {/* Page Hero */}
      <section className="bg-charcoal-950 pt-32 pb-16 md:pt-36 md:pb-20">
        <div className="container-max px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-forest-400 font-semibold text-sm uppercase tracking-wider">Our Services</span>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-white mt-2 mb-4">
              Professional Pest Control
              <span className="block text-forest-400">Solutions for Oklahoma</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl leading-relaxed">
              From termite treatment to mice and rat control, Frontline provides comprehensive pest management tailored to Oklahoma's unique climate and pest pressures.
            </p>
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <section className="bg-white border-b border-gray-100 sticky top-[88px] md:top-[104px] z-30">
        <div className="container-max px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-3 -mx-4 px-4 sm:mx-0 sm:px-0">
            {services.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-charcoal-700 hover:bg-forest-50 hover:text-forest-700 transition-colors whitespace-nowrap"
              >
                <s.icon size={16} />
                {s.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Service details */}
      {services.map((service, i) => (
        <section
          key={service.id}
          id={service.id}
          className={`section-padding ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
        >
          <div className="container-max">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Content */}
              <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-forest-50 flex items-center justify-center">
                    <service.icon className="text-forest-700" size={26} />
                  </div>
                  <div>
                    <h2 className="font-display font-extrabold text-2xl md:text-3xl text-charcoal-900">{service.title}</h2>
                    <p className="text-forest-700 text-sm font-medium">{service.tagline}</p>
                  </div>
                </div>

                <p className="text-gray-600 leading-relaxed mb-8">{service.description}</p>

                {/* Methods */}
                <h3 className="font-display font-bold text-lg text-charcoal-900 mb-4">How We Treat</h3>
                <div className="space-y-4 mb-8">
                  {service.methods.map((method, j) => (
                    <div key={j} className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                      <h4 className="font-semibold text-charcoal-900 mb-1">{method.name}</h4>
                      <p className="text-gray-600 text-sm leading-relaxed">{method.detail}</p>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <h3 className="font-display font-bold text-lg text-charcoal-900 mb-3">What's Included</h3>
                <ul className="grid sm:grid-cols-2 gap-2 mb-6">
                  {service.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-charcoal-800">
                      <CheckCircle size={16} className="text-forest-600 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link to="/contact" className="btn-primary">
                  Get a Free {service.title} Quote
                  <ArrowRight size={18} />
                </Link>
              </div>

              {/* Image */}
              <div className={`${i % 2 === 1 ? 'lg:order-1' : ''} relative`}>
                <div className="rounded-2xl overflow-hidden shadow-lg aspect-[4/3] bg-gray-200">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Bottom CTA */}
      <section className="bg-forest-800 section-padding">
        <div className="container-max text-center">
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mb-4">Not Sure What Service You Need?</h2>
          <p className="text-forest-100/80 text-lg mb-8 max-w-2xl mx-auto">
            No problem. Give us a call or request a free inspection and we'll identify the issue and recommend the right treatment plan.
          </p>
          {/* Two call buttons side-by-side, then Request Free Inspection
              centered on its own row beneath them. */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:4055311034" className="btn-cta">
                <Phone size={20} />
                Call Jimmy 405-531-1034
              </a>
              <a href="tel:3488688231" className="btn-cta">
                <Phone size={20} />
                Call Jarrett 348-868-8231
              </a>
            </div>
            <Link to="/contact" className="btn-secondary text-lg py-4 px-8">
              Request Free Inspection
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
