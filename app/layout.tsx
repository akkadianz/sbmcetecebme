import type { Metadata } from 'next'
import { Geist_Mono, Manrope } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import { BatchProvider } from '@/context/batch-context'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'SBM Student Management System',
  description: 'Offline college student management system for batch administration',
  generator: 'v0.app',
  icons: {
    icon: [{ url: '/sbm-favicon-32x32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/sbm-apple-180x180.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const analyticsEnabled = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="ui-density" strategy="beforeInteractive">{`
(function () {
  try {
    var key = 'ui-density';
    var stored = localStorage.getItem(key);
    var density = stored;
    if (density !== 'compact' && density !== 'comfortable') {
      density = (window.matchMedia && window.matchMedia('(max-width: 640px)').matches)
        ? 'compact'
        : 'comfortable';
    }
    document.documentElement.dataset.density = density;
  } catch (e) {}
})();
        `}</Script>
      </head>
      <body className={`${manrope.variable} ${geistMono.variable} font-sans antialiased`}>
        <BatchProvider>
          {children}
          <Toaster />
        </BatchProvider>
        {analyticsEnabled ? <Analytics /> : null}
      </body>
    </html>
  )
}
