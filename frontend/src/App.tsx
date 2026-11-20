import React from 'react'

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 shadow-sm">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-brand-50 text-brand-600 mb-4">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-ink-primary tracking-tight">
          Secure File Management Platform
        </h1>
        <p className="text-sm text-ink-secondary mt-2">
          Enterprise Cloud Storage with Defense-in-Depth Security
        </p>
        <div className="mt-6 pt-6 border-t border-border flex justify-between items-center text-xs font-mono text-ink-tertiary">
          <span>React 18 + Vite + Tailwind</span>
          <span className="inline-flex items-center text-status-success font-medium">
            <span className="w-2 h-2 rounded-full bg-status-success mr-1.5 animate-pulse"></span>
            Operational
          </span>
        </div>
      </div>
    </div>
  )
}

export default App
