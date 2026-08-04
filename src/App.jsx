import React, { useState, useEffect } from 'react';
import OnboardingWizard from './components/OnboardingWizard';
import TextileBillingCounter from './components/domains/TextileBillingCounter';
// import GeneralBillingCounter from './components/domains/GeneralBillingCounter';
import AgriBillingCounter from './components/domains/AgriBillingCounter';

export default function App() {
  const [activeDomain, setActiveDomain] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8080/api/config')
      .then(res => res.json())
      .then(data => {
        if (data.configured) {
          setActiveDomain(data.activeDomain);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch config:', err);
        setLoading(false); // Fails gracefully or handle offline retry
      });
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-counter-dark flex items-center justify-center text-amber-glow">Starting Bill Flow...</div>;
  }

  if (!activeDomain) {
    return <OnboardingWizard onComplete={(domain) => setActiveDomain(domain)} />;
  }

  // Render the specific counter based on domain
  let CounterComponent = TextileBillingCounter; // Fallback
  if (activeDomain === 'TEXTILE') {
    CounterComponent = TextileBillingCounter;
  } else if (activeDomain === 'GENERAL') {
    // CounterComponent = GeneralBillingCounter; // To be built
    CounterComponent = () => <div className="p-8 text-white">General Retail Module - Under Construction</div>;
  } else if (activeDomain === 'AGRI') {
    CounterComponent = AgriBillingCounter;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex justify-between items-center px-6 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="text-amber-500">⚡</span> Bill Flow <span className="text-xs text-gray-500 font-normal ml-2">[{activeDomain}]</span>
        </h1>
        <div className="text-xs font-medium text-gray-500 bg-gray-800/50 px-2 py-1 rounded-full border border-gray-700/50">
          v1.0.0-rc
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <CounterComponent />
      </main>
    </div>
  );
}
