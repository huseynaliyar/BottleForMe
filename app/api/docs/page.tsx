'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

// Dynamic import to prevent SSR issues with SwaggerUI
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto mb-4 bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src="/logo.jpg" alt="BottleForMe" className="w-10 h-10 rounded-full border border-blue-500" />
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              BottleForMe OpenAPI Specification
              <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full font-mono text-white">v1.0.0</span>
            </h1>
            <p className="text-xs text-slate-400">Malta Plastic, Can & Glass Collection & Direct Payout API</p>
          </div>
        </div>
        <a
          href="/"
          className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl transition"
        >
          ← Back to App
        </a>
      </div>

      <div className="max-w-6xl mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl p-4">
        <SwaggerUI url="/api/docs/schema" />
      </div>
    </div>
  );
}
