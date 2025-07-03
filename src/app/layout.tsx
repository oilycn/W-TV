
import type { Metadata, Viewport } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/common/AppHeader';
import { Toaster } from "@/components/ui/toaster";
import { CategoryProvider } from '@/contexts/CategoryContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Suspense } from 'react';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const robotoMono = Roboto_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '晚风TV',
  description: '您的个性化影院体验',
  formatDetection: {
    telephone: false,
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '晚风TV',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

const AppHeaderFallback = () => (
  <div style={{
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    height: '64px', /* Corresponds to h-16 */
    alignItems: 'center',
    borderBottom: '1px solid hsl(var(--border))',
    backgroundColor: 'hsl(var(--background))', 
    paddingLeft: '1rem',
    paddingRight: '1rem',
  }} />
);


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Vidstack Player CSS from CDN */}
        <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/vidstack@1.11.24/player/styles/base.css" />
        <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/@vidstack/react@1.11.24/player/styles/default/theme.css" />
        <link rel="stylesheet" href="https://fastly.jsdelivr.net/npm/@vidstack/react@1.11.24/player/styles/default/layouts/video.css" />
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>
        <ThemeProvider> 
          <CategoryProvider>
            <div className="flex flex-col min-h-screen">
              <Suspense fallback={<AppHeaderFallback />}>
                <AppHeader />
              </Suspense>
              <main className="flex-1 p-4 md:p-6 overflow-auto">
                {children}
              </main>
            </div>
          </CategoryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
