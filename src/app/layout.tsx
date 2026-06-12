
import type { Metadata, Viewport } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/common/AppHeader';
import { Toaster } from "@/components/ui/toaster";
import { CategoryProvider } from '@/contexts/CategoryContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Suspense } from 'react';
import { BottomNavBar } from '@/components/common/BottomNavBar';
import { QueryProvider } from '@/providers/QueryProvider';

// Vidstack Player CSS (local)
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';


const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const robotoMono = Roboto_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    template: '%s | 晚风TV',
    default: '晚风TV - 您的个性化影院',
  },
  description: '全网高画质影视聚合，清爽无广告的观影体验。您的个性化私人影院。',
  keywords: ['影视', '视频', '电影', '电视剧', '在线观看', '聚合影视'],
  openGraph: {
    title: '晚风TV - 您的个性化私人影院',
    description: '全网高画质影视聚合，清爽无广告的观影体验。',
    siteName: '晚风TV',
    type: 'website',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    title: '晚风TV',
    description: '全网高画质影视聚合，您的个性化私人影院。',
  },
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
  <header style={{
    position: 'sticky',
    top: 0,
    zIndex: 20,
    paddingTop: 'env(safe-area-inset-top)',
    backgroundColor: 'hsl(var(--background))'
  }}>
    <div style={{ height: '56px', borderBottom: '1px solid hsl(var(--border))' }} />
  </header>
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
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`} suppressHydrationWarning>
        <QueryProvider>
          <ThemeProvider> 
            <CategoryProvider>
              <div className="flex flex-col min-h-screen">
                <Suspense fallback={<AppHeaderFallback />}>
                  <AppHeader />
                </Suspense>
                <main className="flex-1 overflow-auto pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-6">
                  {children}
                </main>
                <BottomNavBar />
              </div>
            </CategoryProvider>
          </ThemeProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
