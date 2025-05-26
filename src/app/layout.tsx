import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarHeader, SidebarContent, SidebarFooter } from '@/components/ui/sidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import { Home, Bot, Settings, Tv2 } from 'lucide-react';
import AppLogo from '@/components/common/AppLogo';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '影院视图',
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
        <SidebarProvider defaultOpen={true}>
          <Sidebar collapsible="icon" className="border-r border-sidebar-border">
            <SidebarHeader className="p-4">
              <Link href="/" className="flex items-center gap-2">
                <AppLogo />
              </Link>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="主页">
                    <Link href="/">
                      <Home />
                      <span>主页</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="AI推荐">
                    <Link href="/recommendations">
                      <Bot />
                      <span>AI推荐</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="设置">
                    <Link href="/settings">
                      <Settings />
                      <span>设置</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter className="p-2">
              {/* Footer content if any */}
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <AppHeader />
            <main className="flex-1 p-4 md:p-6 overflow-auto">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
