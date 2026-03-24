import { Bug, Rat, Bird } from 'lucide-react'

const pests = [
  { name: 'Termites', icon: '🏠', description: 'Oklahoma\'s #1 structural pest. Subterranean termites cause billions in damage yearly.', threat: 'High' },
  { name: 'Cockroaches', icon: '🪳', description: 'German and American roaches thrive in Oklahoma\'s warm climate and spread disease.', threat: 'High' },
  { name: 'Ants', icon: '🐜', description: 'Fire ants, carpenter ants, and odorous house ants are common invaders across the state.', threat: 'Medium' },
  { name: 'Spiders', icon: '🕷️', description: 'Brown recluse and black widow spiders pose real health risks in Oklahoma homes.', threat: 'High' },
  { name: 'Mice & Rats', icon: '🐀', description: 'Rodents chew wiring, contaminate food, and spread disease. Active year-round in OK.', threat: 'High' },
  { name: 'Mosquitoes', icon: '🦟', description: 'Carriers of West Nile and other diseases. Thrive in Oklahoma\'s humid summers.', threat: 'Medium' },
  { name: 'Wasps & Hornets', icon: '🐝', description: 'Paper wasps and mud daubers build nests on Oklahoma homes. Painful stings.', threat: 'Medium' },
  { name: 'Bed Bugs', icon: '🛏️', description: 'Hitchhiking pests that infest mattresses and furniture. Extremely hard to eliminate alone.', threat: 'High' },
]

export default function PestLibrary() {
  return (
    <section id="pests" className="section-padding bg-gray-50">
      <div className="container-max">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <span className="text-forest-700 font-semibold text-sm uppercase tracking-wider">Pest Library</span>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-charcoal-900 mt-2 mb-4">
            Common Oklahoma Pests
          </h2>
          <p className="text-gray-600 text-lg">
            Know your enemy. Learn about the most common pests we treat across the state.
          </p>
        </div>

        {/* Pest grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {pests.map((pest, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md hover:border-forest-200 transition-all duration-200 text-center group cursor-default">
              <div className="text-4xl mb-3">{pest.icon}</div>
              <h3 className="font-display font-bold text-charcoal-900 mb-2">{pest.name}</h3>
              <p className="text-gray-500 text-xs leading-relaxed mb-3">{pest.description}</p>
              <span className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                pest.threat === 'High'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700'
              }`}>
                {pest.threat} Threat
              </span>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <a href="#contact" className="btn-primary">
            Have a Pest Problem? Get Help Now
          </a>
        </div>
      </div>
    </section>
  )
}
