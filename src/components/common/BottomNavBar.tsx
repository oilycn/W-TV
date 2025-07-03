"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, LayoutGrid, Search, History, Settings } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/categories', label: '分类', icon: LayoutGrid },
  { href: '/search', label: '搜索', icon: Search },
  { href: '/history', label: '历史', icon: History },
  { href: '/settings', label: '设置', icon: Settings },
];

export function BottomNavBar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  if (!isMobile) {
    return null;
  }
  
  const getIsActive = (href: string) => {
    if (href === '/') return pathname === '/';
    // For other routes, check if the current path starts with the href.
    // This makes sure that sub-paths are also considered active.
    return pathname.startsWith(href);
  };

  return (
    <div className="fixed bottom-0 left-0 z-20 w-full border-t bg-background/95 backdrop-blur-sm md:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = getIsActive(item.href);
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex flex-col items-center justify-center gap-1 flex-1 text-muted-foreground transition-colors",
              isActive ? "text-primary" : "hover:text-foreground"
            )}>
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
