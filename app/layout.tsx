import type { Metadata, Viewport } from 'next';
import { themeKey } from '@/lib/appearance';
import { languages, localeKey } from '@/lib/locale';
import WebLanguageProvider from '@/components/WebLanguageProvider';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import AccountBottomNav from '@/components/AccountBottomNav';

export const metadata: Metadata = {
  title: 'BottleForMe - Plastic Bottle, Can & Glass Collection',
  description: 'Peer-to-peer doorstep collection and fair deposit sharing for plastic bottles, cans, and glass bottles in Malta.',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.jpg',
    apple: '/logo.jpg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0066ff',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try {
          document.documentElement.dataset.theme = localStorage.getItem(${JSON.stringify(themeKey)}) === 'light' ? 'light' : 'dark';
          var locale = localStorage.getItem(${JSON.stringify(localeKey)});
          if (${JSON.stringify(languages.map(({ value }) => value))}.includes(locale)) {
            document.documentElement.lang = locale;
            document.documentElement.dir = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';
          }
        } catch {}` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- this App Router layout covers every route */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (${process.env.NODE_ENV === 'production'} && 'serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('BottleForMe SW registered:', registration.scope);
                    },
                    function(err) {
                      console.log('BottleForMe SW registration failed:', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </head>
      <body className="bg-[#05070c] text-slate-100 min-h-screen antialiased selection:bg-blue-600 selection:text-white">
        <WebLanguageProvider>{children}<AccountBottomNav /></WebLanguageProvider>
      </body>
    </html>
  );
}
