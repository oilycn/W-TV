
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/common/AppHeader';
import { Toaster } from "@/components/ui/toaster";
import { CategoryProvider } from '@/contexts/CategoryContext';
import { Suspense } from 'react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '晚风TV',
  description: '您的个性化影院体验',
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
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
        <Toaster />
      </body>
    </html>
  );
}
