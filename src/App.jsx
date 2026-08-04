import React from 'react';
import BillingCounter from './components/BillingCounter';

export default function App() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <header className="flex justify-between items-center px-6 py-3 bg-gray-900/80 backdrop-blur border-b border-gray-800 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="text-amber-500">⚡</span> Bill Flow
        </h1>
        <div className="text-xs font-medium text-gray-500 bg-gray-800/50 px-2 py-1 rounded-full border border-gray-700/50">
          v1.0.0-rc
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <BillingCounter />
      </main>
    </div>
  );
}
