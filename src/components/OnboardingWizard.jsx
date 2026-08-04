import React, { useState } from 'react';

export default function OnboardingWizard({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const domains = [
    {
      id: 'TEXTILE',
      title: 'Textiles & Garments',
      desc: 'Optimized for sizes, colors, and complex variations.',
      icon: '👗'
    },
    {
      id: 'GENERAL',
      title: 'General Retail / Supermarket',
      desc: 'Blazing fast barcode scanning and simple inventory.',
      icon: '🛒'
    },
    {
      id: 'AGRI',
      title: 'Agri-Trading / Mandi',
      desc: 'Handles bag weights, grades, and commission agents.',
      icon: '🌾'
    }
  ];

  const handleSelect = async (domain) => {
    if (confirm(`Are you sure you want to lock the system into the ${domain} configuration? This cannot be undone.`)) {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('http://localhost:8080/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain })
        });
        if (!res.ok) throw new Error('Setup failed. Please try again.');
        onComplete(domain);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-counter-dark flex flex-col items-center justify-center p-8 text-gray-200">
      <div className="max-w-4xl w-full">
        <h1 className="text-4xl font-bold text-center mb-4 text-amber-glow">Welcome to Bill Flow</h1>
        <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
          Before we begin, we need to configure your database. Bill Flow is meticulously designed to adapt to your specific industry. Select your primary business type below to initialize the system.
        </p>

        {error && <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded mb-6 text-center">{error}</div>}
        {loading && <div className="text-amber-glow text-center mb-6">Initializing database... please wait.</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {domains.map((d) => (
            <button
              key={d.id}
              onClick={() => handleSelect(d.id)}
              disabled={loading}
              className="bg-[#111118] border border-gray-800 hover:border-amber-glow/50 p-6 rounded-xl transition-all hover:bg-[#1a1a24] text-left group flex flex-col items-center disabled:opacity-50"
            >
              <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">{d.icon}</div>
              <h2 className="text-xl font-bold text-white mb-2 text-center">{d.title}</h2>
              <p className="text-sm text-gray-500 text-center">{d.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
