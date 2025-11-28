import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Audience from './components/Audience';
import CTA from './components/CTA';
import Footer from './components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-vizme-bg text-vizme-navy selection:bg-vizme-red/20 selection:text-vizme-navy">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Audience />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

export default App;