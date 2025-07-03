
import type { Metadata, Viewport } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/common/AppHeader';
import { Toaster } from "@/components/ui/toaster";
import { CategoryProvider } from '@/contexts/CategoryContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Suspense } from 'react';
import { BottomNavBar } from '@/components/common/BottomNavBar';

// Vidstack Player CSS (local)
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';


const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const robotoMono = Roboto_mono({
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
    statusBarStyle: 'black-translucent',
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
        {/* PWA Icon Links for better compatibility */}
        <link rel="icon" href="/icons/icon-192x192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>
        <ThemeProvider> 
          <CategoryProvider>
            <div className="flex flex-col min-h-screen">
              <Suspense fallback={<AppHeaderFallback />}>
                <AppHeader />
              </Suspense>
              <main className="flex-1 p-4 md:p-6 overflow-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">
                {children}
              </main>
              <BottomNavBar />
            </div>
          </CategoryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
