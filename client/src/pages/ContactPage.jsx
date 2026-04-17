import { useState } from 'react'
import { Send, Phone, Clock, MapPin, Mail, CheckCircle, MessageSquare } from 'lucide-react'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    service: '',
    urgency: '',
    message: '',
  })
  const [status, setStatus] = useState('idle')

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        setStatus('success')
        setFormData({ name: '', email: '', phone: '', address: '', service: '', urgency: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      {/* Page Hero */}
      <section className="bg-charcoal-950 pt-32 pb-16 md:pt-36 md:pb-20">
        <div className="container-max px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-forest-400 font-semibold text-sm uppercase tracking-wider">Contact Us</span>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-white mt-2 mb-4">
              Get Your Free
              <span className="block text-forest-400">Pest Control Quote</span>
            </h1>
            <p className="text-gray-400 text-lg md:text-xl leading-relaxed">
              Fill out the form below or give us a call. We respond to every inquiry within 1 business hour.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="section-padding bg-white">
        <div className="container-max">
          <div className="grid lg:grid-cols-5 gap-12">
            {/* Left info */}
            <div className="lg:col-span-2 space-y-8">
              {/* Contact methods */}
              <div>
                <h2 className="font-display font-bold text-xl text-charcoal-900 mb-6">Get in Touch</h2>
                <div className="space-y-5">
                  <a href="tel:4055311034" className="flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-lg bg-forest-50 group-hover:bg-forest-700 flex items-center justify-center transition-colors">
                      <Phone className="text-forest-700 group-hover:text-white transition-colors" size={22} />
                    </div>
                    <div>
                      <div className="font-semibold text-charcoal-900">(405) 531-1034</div>
                      <div className="text-sm text-gray-500">Call us directly</div>
                    </div>
                  </a>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-forest-50 flex items-center justify-center">
                      <Mail className="text-forest-700" size={22} />
                    </div>
                    <div>
                      <div className="font-semibold text-charcoal-900">info@frontlinepestok.com</div>
                      <div className="text-sm text-gray-500">Email us anytime</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-forest-50 flex items-center justify-center">
                      <MapPin className="text-forest-700" size={22} />
                    </div>
                    <div>
                      <div className="font-semibold text-charcoal-900">Edmond, Oklahoma</div>
                      <div className="text-sm text-gray-500">Serving all of Oklahoma</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-forest-50 flex items-center justify-center">
                      <Clock className="text-forest-700" size={22} />
                    </div>
                    <div>
                      <div className="font-semibold text-charcoal-900">Mon–Sat: 7AM–7PM</div>
                      <div className="text-sm text-gray-500">Emergency service available</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ mini */}
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <h3 className="font-display font-bold text-lg text-charcoal-900 mb-4 flex items-center gap-2">
                  <MessageSquare size={20} className="text-forest-700" />
                  Common Questions
                </h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm text-charcoal-900">Do you offer free inspections?</h4>
                    <p className="text-sm text-gray-600 mt-1">Yes! We provide free pest and termite inspections for all residential properties across Oklahoma.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-charcoal-900">How quickly can you come out?</h4>
                    <p className="text-sm text-gray-600 mt-1">We offer same-day service for most areas. Call us and we'll do our best to get to you today.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-charcoal-900">Are your treatments safe for pets?</h4>
                    <p className="text-sm text-gray-600 mt-1">Absolutely. We use targeted, low-toxicity products and will advise you on any precautions needed.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right form */}
            <div className="lg:col-span-3">
              {status === 'success' ? (
                <div className="bg-forest-50 border border-forest-200 rounded-2xl p-8 md:p-12 text-center">
                  <CheckCircle className="text-forest-600 mx-auto mb-4" size={48} />
                  <h3 className="font-display font-bold text-2xl text-charcoal-900 mb-2">Request Received!</h3>
                  <p className="text-gray-600 mb-2">Thank you for contacting Frontline Termite and Pest Control.</p>
                  <p className="text-gray-600">We'll get back to you within <strong>1 business hour</strong>.</p>
                  <button onClick={() => setStatus('idle')} className="mt-6 text-forest-700 font-semibold underline hover:no-underline">
                    Submit another request
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-gray-50 rounded-2xl p-6 md:p-8 border border-gray-100">
                  <h2 className="font-display font-bold text-xl text-charcoal-900 mb-6">Request a Free Quote</h2>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-charcoal-800 mb-1.5">Full Name *</label>
                      <input id="name" name="name" type="text" required value={formData.name} onChange={handleChange}
                        placeholder="Your full name"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900" />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-charcoal-800 mb-1.5">Phone *</label>
                      <input id="phone" name="phone" type="tel" required value={formData.phone} onChange={handleChange}
                        placeholder="(405) 555-0123"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900" />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-charcoal-800 mb-1.5">Email</label>
                      <input id="email" name="email" type="email" value={formData.email} onChange={handleChange}
                        placeholder="you@email.com"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900" />
                    </div>
                    <div>
                      <label htmlFor="address" className="block text-sm font-medium text-charcoal-800 mb-1.5">Service Address</label>
                      <input id="address" name="address" type="text" value={formData.address} onChange={handleChange}
                        placeholder="123 Main St, Edmond, OK"
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900" />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="service" className="block text-sm font-medium text-charcoal-800 mb-1.5">Service Needed</label>
                      <select id="service" name="service" value={formData.service} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900 bg-white">
                        <option value="">Select a service</option>
                        <option value="termite">Termite Treatment</option>
                        <option value="pest">General Pest Control</option>
                        <option value="inspection">Inspection</option>
                        <option value="other">Other / Not Sure</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="urgency" className="block text-sm font-medium text-charcoal-800 mb-1.5">How Urgent?</label>
                      <select id="urgency" name="urgency" value={formData.urgency} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900 bg-white">
                        <option value="">Select urgency</option>
                        <option value="emergency">Emergency — Need help today</option>
                        <option value="soon">This week</option>
                        <option value="planning">Just planning ahead</option>
                        <option value="quote">Just getting a quote</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label htmlFor="message" className="block text-sm font-medium text-charcoal-800 mb-1.5">Tell us about your pest issue</label>
                    <textarea id="message" name="message" rows={5} value={formData.message} onChange={handleChange}
                      placeholder="Describe what you're seeing — type of pest, where in your home, how long it's been an issue, etc."
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900 resize-none" />
                  </div>

                  {status === 'error' && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      Something went wrong. Please call us at (405) 531-1034 or try again.
                    </div>
                  )}

                  <button type="submit" disabled={status === 'sending'} className="w-full btn-cta disabled:opacity-60 disabled:cursor-not-allowed">
                    {status === 'sending' ? 'Sending...' : (<><Send size={20} />Get My Free Quote</>)}
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-3">No spam, ever. We'll only use your info to respond to your inquiry.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
