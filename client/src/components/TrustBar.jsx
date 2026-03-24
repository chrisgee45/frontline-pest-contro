import { Star, ShieldCheck, Users, ThumbsUp } from 'lucide-react'

export default function TrustBar() {
  const stats = [
    { icon: Star, label: 'Google Rating', value: '5.0', sub: 'Stars' },
    { icon: Users, label: 'Happy Customers', value: '500+', sub: 'Served' },
    { icon: ShieldCheck, label: 'Licensed & Insured', value: '100%', sub: 'Compliant' },
    { icon: ThumbsUp, label: 'Satisfaction', value: '100%', sub: 'Guaranteed' },
  ]

  return (
    <section className="relative z-10 -mt-8 md:-mt-10 px-4 sm:px-6 lg:px-8">
      <div className="container-max">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
          {stats.map((stat, i) => (
            <div key={i} className="flex items-center gap-3 p-4 md:p-6 justify-center">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-forest-50 flex items-center justify-center shrink-0">
                <stat.icon className="text-forest-700" size={20} />
              </div>
              <div>
                <div className="font-display font-bold text-xl md:text-2xl text-charcoal-900">{stat.value}</div>
                <div className="text-xs md:text-sm text-gray-500">{stat.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
