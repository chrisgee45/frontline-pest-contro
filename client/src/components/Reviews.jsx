import { Star, Quote } from 'lucide-react'

const reviews = [
  {
    name: 'Sarah M.',
    location: 'Edmond, OK',
    rating: 5,
    text: 'Jimmy and his team were at our house the same day we called. Found termite activity in our garage and had it treated within hours. Incredibly professional and thorough.',
    service: 'Termite Treatment',
  },
  {
    name: 'David R.',
    location: 'Oklahoma City, OK',
    rating: 5,
    text: 'We switched to Frontline after years with a national chain and the difference is night and day. They actually take the time to explain what they\'re doing and why. Great people.',
    service: 'General Pest Control',
  },
  {
    name: 'Michelle T.',
    location: 'Norman, OK',
    rating: 5,
    text: 'Had mice coming in through the attic. Frontline figured out exactly where they were getting in, sealed everything up, and we haven\'t had a single issue since. Worth every penny.',
    service: 'Rodent Control',
  },
  {
    name: 'James & Linda K.',
    location: 'Yukon, OK',
    rating: 5,
    text: 'Used them for our pre-purchase home inspection. Found issues the other company missed completely. Honest, detailed, and fair pricing. Highly recommend.',
    service: 'Inspection',
  },
]

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(rating)].map((_, i) => (
        <Star key={i} size={16} className="fill-amber-400 text-amber-400" />
      ))}
    </div>
  )
}

export default function Reviews() {
  return (
    <section id="reviews" className="section-padding bg-white">
      <div className="container-max">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12 md:mb-16">
          <span className="text-forest-700 font-semibold text-sm uppercase tracking-wider">Testimonials</span>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-charcoal-900 mt-2 mb-4">
            What Our Customers Say
          </h2>
          <div className="flex items-center justify-center gap-2 text-lg">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={22} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="font-bold text-charcoal-900">5.0</span>
            <span className="text-gray-500">on Google Reviews</span>
          </div>
        </div>

        {/* Reviews grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {reviews.map((review, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-6 md:p-8 border border-gray-100 relative">
              <Quote className="absolute top-6 right-6 text-forest-100" size={40} />
              <StarRating rating={review.rating} />
              <p className="text-charcoal-800 mt-4 mb-5 leading-relaxed relative z-10">"{review.text}"</p>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-charcoal-900">{review.name}</div>
                  <div className="text-sm text-gray-500">{review.location}</div>
                </div>
                <span className="text-xs font-medium text-forest-700 bg-forest-50 px-3 py-1 rounded-full">
                  {review.service}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
