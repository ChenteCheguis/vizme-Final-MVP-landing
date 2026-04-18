import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import HowItWorks from '../components/HowItWorks';
import SocialProof from '../components/SocialProof';
import PricingSection from '../components/PricingSection';
import Footer from '../components/Footer';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white text-vizme-navy selection:bg-vizme-red/20 selection:text-vizme-navy">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <SocialProof />
        <PricingSection />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
