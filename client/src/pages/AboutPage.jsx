import { Link } from 'react-router-dom'
import { Shield, Heart, MapPin, Users, Award, Clock, Phone, CheckCircle, ArrowRight } from 'lucide-react'

const values = [
  { icon: Heart, title: 'Integrity', description: 'We tell you what we find — honestly. No upselling, no scare tactics. Just straight talk and fair pricing.' },
  { icon: Shield, title: 'Reliability', description: 'When we say we\'ll be there, we\'ll be there. On time, every time. Your schedule matters to us.' },
  { icon: Users, title: 'Community', description: 'We live and work in Oklahoma. Your neighbors are our neighbors. We\'re invested in this community.' },
  { icon: Award, title: 'Excellence', description: 'We stay current on the latest pest control methods and products so we can deliver the best results.' },
]

const timeline = [
  { label: 'Founded', detail: 'Jimmy Manharth starts Frontline Termite and Pest Control in Edmond, Oklahoma, with a commitment to honest, reliable service.' },
  { label: 'Growing', detail: 'Word-of-mouth referrals fuel rapid growth across the Oklahoma City metro area. Frontline expands to serve residential and commercial clients.' },
  { label: 'Statewide', detail: 'Frontline now proudly serves all of Oklahoma, from Tulsa to Lawton, with the same personalized attention that started it all.' },
]

export default function AboutPage() {
  return (
    <>
      {/* Page Hero */}
      <section className="bg-charcoal-950 pt-32 pb-16 md:pt-36 md:pb-20">
        <div className="container-max px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-forest-400 font-semibold text-sm uppercase tracking-wider">About Us</span>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-white mt-2 mb-4">
              Meet the Team Behind
              <span className="block text-forest-400">Your Pest Protection</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl leading-relaxed">
              Frontline isn't a national franchise or a call-center operation. We're your neighbors — locally owned and operated right here in Edmond, Oklahoma.
            </p>
          </div>
        </div>
      </section>

      {/* Owner Section */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="rounded-2xl overflow-hidden aspect-[4/3] bg-gray-200 shadow-lg">
                <div className="w-full h-full bg-gradient-to-br from-forest-700 to-forest-900 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-32 h-32 rounded-full bg-white/10 mx-auto mb-4 flex items-center justify-center">
                      <Shield className="text-white/60" size={64} />
                    </div>
                    <p className="text-white/60 text-sm">Owner Photo Coming Soon</p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <span className="text-forest-700 font-semibold text-sm uppercase tracking-wider">Owner & Operator</span>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl text-charcoal-900 mt-2 mb-6">Jimmy Manharth</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Jimmy Manharth founded Frontline Termite and Pest Control with a simple belief: pest control should be honest, effective, and affordable. After years of watching national chains overcharge and underdeliver, he decided Oklahoma families deserved better.
                </p>
                <p>
                  Based in Edmond, Jimmy and his team treat every home like their own. That means showing up on time, explaining exactly what they find, and never recommending treatments you don't need. It's old-fashioned service in a modern industry — and it's why Frontline's customers keep coming back.
                </p>
                <p>
                  When he's not protecting Oklahoma homes from pests, Jimmy is active in the Edmond community and committed to building a business his family and customers can be proud of.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-6">
                <MapPin className="text-forest-600" size={20} />
                <span className="text-charcoal-800 font-medium">Edmond, Oklahoma</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding bg-gray-50">
        <div className="container-max">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-forest-700 font-semibold text-sm uppercase tracking-wider">Our Values</span>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-charcoal-900 mt-2 mb-4">
              What We Stand For
            </h2>
            <p className="text-gray-600 text-lg">
              These aren't just words on a wall. They're the principles that guide every interaction, every treatment, and every decision we make.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 text-center">
                <div className="w-14 h-14 rounded-full bg-forest-50 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="text-forest-700" size={26} />
                </div>
                <h3 className="font-display font-bold text-lg text-charcoal-900 mb-2">{v.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story Timeline */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-forest-700 font-semibold text-sm uppercase tracking-wider">Our Journey</span>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl text-charcoal-900 mt-2">The Frontline Story</h2>
            </div>
            <div className="space-y-8">
              {timeline.map((item, i) => (
                <div key={i} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-forest-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {i + 1}
                    </div>
                    {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-forest-200 mt-2" />}
                  </div>
                  <div className="pb-8">
                    <h3 className="font-display font-bold text-xl text-charcoal-900 mb-2">{item.label}</h3>
                    <p className="text-gray-600 leading-relaxed">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Frontline */}
      <section className="section-padding bg-charcoal-900">
        <div className="container-max">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-forest-400 font-semibold text-sm uppercase tracking-wider">The Frontline Difference</span>
              <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mt-2 mb-6">
                Why Choose a Local Company?
              </h2>
              <div className="space-y-4">
                {[
                  'We answer our own phones — no call centers, no runaround',
                  'Jimmy personally oversees every treatment plan',
                  'We know Oklahoma pests because we deal with them too',
                  'Flat, honest pricing with no hidden fees',
                  'Same-day and emergency service available',
                  '100% satisfaction guarantee on every service',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle size={20} className="text-forest-400 shrink-0 mt-0.5" />
                    <span className="text-gray-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-charcoal-800/50 rounded-2xl p-8 border border-charcoal-700/50">
              <div className="text-center">
                <div className="text-5xl font-display font-extrabold text-white mb-2">100%</div>
                <div className="text-forest-400 font-semibold text-lg mb-4">Satisfaction Guarantee</div>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  If you're not completely satisfied with our service, we'll come back and re-treat at no additional cost. That's the Frontline promise.
                </p>
                <a href="tel:4055311034" className="btn-cta w-full justify-center">
                  <Phone size={20} />
                  Call (405) 531-1034
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding bg-forest-800">
        <div className="container-max text-center">
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mb-4">Ready to Protect Your Home?</h2>
          <p className="text-forest-100/80 text-lg mb-8 max-w-xl mx-auto">
            Get in touch today for a free inspection and see why Oklahoma homeowners trust Frontline.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact" className="btn-cta">
              Get a Free Quote
              <ArrowRight size={20} />
            </Link>
            <a href="tel:4055311034" className="btn-secondary text-lg py-4 px-8">
              <Phone size={20} />
              Call Now
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
