'use client';

import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import Link from 'next/link';

export default function ApiDocsPage() {
  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white">
        <Link href="/" className="text-sm font-semibold">Back to BottleForMe</Link>
        <a href="/api/docs/schema" className="text-sm text-blue-300">OpenAPI JSON</a>
      </header>
      <ApiReferenceReact configuration={{
        url: '/api/docs/schema',
        withDefaultFonts: false,
        persistAuth: false,
        hideClientButton: true,
        showDeveloperTools: 'never',
        telemetry: false,
        customFetch(input, init) {
          const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
          if (url.origin !== window.location.origin) return Promise.reject(new Error('Only the BottleForMe API is available here.'));
          return fetch(input, { ...init, redirect: 'error' });
        },
      }} />
    </div>
  );
}
