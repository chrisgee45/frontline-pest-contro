import { useState } from 'react'
import { Send, Phone, Clock, MapPin, CheckCircle } from 'lucide-react'

export default function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    message: '',
  })
  const [status, setStatus] = useState('idle') // idle | sending | success | error

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
        setFormData({ name: '', email: '', phone: '', service: '', message: '' })
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <section id="contact" className="section-padding bg-white">
      <div className="container-max">
        <div className="grid lg:grid-cols-5 gap-12">
          {/* Left info */}
          <div className="lg:col-span-2">
            <span className="text-forest-700 font-semibold text-sm uppercase tracking-wider">Contact Us</span>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-charcoal-900 mt-2 mb-4">
              Get Your Free Quote
            </h2>
            <p className="text-gray-600 text-lg mb-8 leading-relaxed">
              Ready to reclaim your home from pests? Fill out the form or give us a call. We respond to every inquiry within 1 business hour.
            </p>

            <div className="space-y-5">
              <a href="tel:4055311034" className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-lg bg-forest-50 group-hover:bg-forest-700 flex items-center justify-center transition-colors">
                  <Phone className="text-forest-700 group-hover:text-white transition-colors" size={22} />
                </div>
                <div>
                  <div className="font-semibold text-charcoal-900">Call Jimmy — (405) 531-1034</div>
                  <div className="text-sm text-gray-500">Call us directly</div>
                </div>
              </a>
              <a href="tel:3488688231" className="flex items-center gap-4 group">
                <div className="w-12 h-12 rounded-lg bg-forest-50 group-hover:bg-forest-700 flex items-center justify-center transition-colors">
                  <Phone className="text-forest-700 group-hover:text-white transition-colors" size={22} />
                </div>
                <div>
                  <div className="font-semibold text-charcoal-900">Call Jarrett — 348-868-8231</div>
                  <div className="text-sm text-gray-500">Call us directly</div>
                </div>
              </a>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-forest-50 flex items-center justify-center">
                  <Clock className="text-forest-700" size={22} />
                </div>
                <div>
                  <div className="font-semibold text-charcoal-900">Mon–Sat: 7AM–7PM</div>
                  <div className="text-sm text-gray-500">Emergency service available</div>
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
            </div>
          </div>

          {/* Right form */}
          <div className="lg:col-span-3">
            {status === 'success' ? (
              <div className="bg-forest-50 border border-forest-200 rounded-2xl p-8 md:p-12 text-center">
                <CheckCircle className="text-forest-600 mx-auto mb-4" size={48} />
                <h3 className="font-display font-bold text-2xl text-charcoal-900 mb-2">Thank You!</h3>
                <p className="text-gray-600">We've received your request and will contact you within 1 business hour.</p>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-6 text-forest-700 font-semibold underline hover:no-underline"
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-gray-50 rounded-2xl p-6 md:p-8 border border-gray-100">
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-charcoal-800 mb-1.5">Name *</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-charcoal-800 mb-1.5">Phone *</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="(405) 555-0123"
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-charcoal-800 mb-1.5">Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@email.com"
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="service" className="block text-sm font-medium text-charcoal-800 mb-1.5">Service Needed</label>
                    <select
                      id="service"
                      name="service"
                      value={formData.service}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900 bg-white"
                    >
                      <option value="">Select a service</option>
                      <option value="termite">Termite Treatment</option>
                      <option value="pest">General Pest Control</option>
                      <option value="rodent">Rodent Control</option>
                      <option value="inspection">Inspection</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="mb-6">
                  <label htmlFor="message" className="block text-sm font-medium text-charcoal-800 mb-1.5">Tell us about your pest issue</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Describe what you're seeing — type of pest, location in your home, how long it's been an issue, etc."
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all text-charcoal-900 resize-none"
                  />
                </div>

                {status === 'error' && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    Something went wrong. Please call us at (405) 531-1034 or try again.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full btn-cta disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {status === 'sending' ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send size={20} />
                      Get My Free Quote
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-400 text-center mt-3">
                  No spam, ever. We'll only use your info to respond to your inquiry.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
