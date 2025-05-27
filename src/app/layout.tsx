
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarInset, 
  SidebarHeader, 
  SidebarContent, 
  SidebarFooter
} from '@/components/ui/sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import AppLogo from '@/components/common/AppLogo';
import { CategoryProvider } from '@/contexts/CategoryContext'; 
import { ScrollArea } from '@/components/ui/scroll-area';
import { SidebarNavigationItems } from '@/components/layout/SidebarNavigationItems';
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

// Define very simple, static fallbacks as functional components
const AppHeaderFallback = () => (
  <div style={{ 
    position: 'sticky', 
    top: 0, 
    zIndex: 10, 
    display: 'flex', 
    height: '64px', /* Corresponds to h-16 */
    alignItems: 'center', 
    borderBottom: '1px solid hsl(var(--border))', /* Simulate border-b */
    backgroundColor: 'hsl(var(--background))', /* Simulate bg-background/95 */
    paddingLeft: '1rem', /* Corresponds to px-4 */
    paddingRight: '1rem', /* Corresponds to px-4 */
  }} />
);

const SidebarNavFallback = () => (
  <div style={{ padding: '0.5rem' }}>{/* Corresponds to p-2 */}
    {/* You can add simple skeleton lines here if needed */}
  </div>
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
          <SidebarProvider defaultOpen={true}>
            <Sidebar collapsible="icon" className="border-r border-sidebar-border flex flex-col"> {/* Ensure sidebar itself can flex its content */}
              <SidebarHeader className="p-4">
                <Link href="/" className="flex items-center gap-2">
                  <AppLogo />
                </Link>
              </SidebarHeader>
              <ScrollArea className="flex-grow"> {/* ScrollArea wraps the navigation items */}
                <SidebarContent>
                  <Suspense fallback={<SidebarNavFallback />}>
                    <SidebarNavigationItems /> 
                  </Suspense>
                </SidebarContent>
              </ScrollArea>
              <SidebarFooter className="p-2 mt-auto"> {/* Push footer to bottom */}
                {/* Footer content if any */}
              </SidebarFooter>
            </Sidebar>
            <SidebarInset>
              <Suspense fallback={<AppHeaderFallback />}>
                <AppHeader />
              </Suspense>
              <main className="flex-1 p-4 md:p-6 overflow-auto">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </CategoryProvider>
        <Toaster />
      </body>
    </html>
  );
}
