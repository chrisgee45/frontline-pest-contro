import { MapPin, Phone } from 'lucide-react'

const cities = [
  'Edmond', 'Oklahoma City', 'Norman', 'Moore', 'Yukon', 'Mustang',
  'Midwest City', 'Del City', 'Bethany', 'Warr Acres', 'The Village',
  'Nichols Hills', 'Choctaw', 'Harrah', 'Jones', 'Luther',
  'Guthrie', 'Piedmont', 'Deer Creek', 'Stillwater',
  'Shawnee', 'Tulsa', 'Broken Arrow', 'And All of Oklahoma',
]

export default function ServiceArea() {
  return (
    <section id="service-area" className="section-padding bg-forest-800">
      <div className="container-max">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div>
            <span className="text-forest-300 font-semibold text-sm uppercase tracking-wider">Service Area</span>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mt-2 mb-4">
              Proudly Serving All of Oklahoma
            </h2>
            <p className="text-forest-100/80 text-lg mb-8 leading-relaxed">
              Based in Edmond, Frontline Termite and Pest Control provides expert pest management services across the entire state. No matter where you are in Oklahoma, we've got you covered.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="tel:4055311034" className="btn-cta">
                <Phone size={20} />
                Call (405) 531-1034
              </a>
              <a href="#contact" className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white/30 hover:border-white/60 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
                <MapPin size={18} />
                Request Service
              </a>
            </div>
          </div>

          {/* Right - cities grid */}
          <div className="bg-forest-900/50 rounded-2xl p-6 md:p-8 border border-forest-700/30">
            <h3 className="font-display font-bold text-white text-lg mb-4 flex items-center gap-2">
              <MapPin className="text-forest-400" size={20} />
              Cities We Serve
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              {cities.map((city, i) => (
                <span
                  key={i}
                  className={`text-sm py-1 ${
                    city === 'And All of Oklahoma'
                      ? 'text-forest-300 font-semibold col-span-2 sm:col-span-3 mt-2 text-center border-t border-forest-700/30 pt-3'
                      : 'text-forest-100/70'
                  }`}
                >
                  {city !== 'And All of Oklahoma' && <span className="text-forest-500 mr-1.5">•</span>}
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
