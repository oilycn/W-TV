
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
import { Suspense } from 'react'; // Import Suspense


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
                  <Suspense fallback={<div className="p-2">Loading navigation...</div>}>
                    <SidebarNavigationItems /> 
                  </Suspense>
                </SidebarContent>
              </ScrollArea>
              <SidebarFooter className="p-2 mt-auto"> {/* Push footer to bottom */}
                {/* Footer content if any */}
              </SidebarFooter>
            </Sidebar>
            <SidebarInset>
              <Suspense fallback={<div className="sticky top-0 z-10 flex h-16 items-center border-b bg-background/95 px-4 md:px-6"></div>}>
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

