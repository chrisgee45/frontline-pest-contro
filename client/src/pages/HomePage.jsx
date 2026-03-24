import Hero from '../components/Hero'
import TrustBar from '../components/TrustBar'
import Services from '../components/Services'
import WhyChooseUs from '../components/WhyChooseUs'
import Reviews from '../components/Reviews'
import PestLibrary from '../components/PestLibrary'
import ServiceArea from '../components/ServiceArea'
import ContactForm from '../components/ContactForm'

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Services />
      <WhyChooseUs />
      <Reviews />
      <PestLibrary />
      <ServiceArea />
      <ContactForm />
    </>
  )
}
