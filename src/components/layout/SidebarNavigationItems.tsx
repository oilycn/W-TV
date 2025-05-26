
'use client';

import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { useCategories } from '@/contexts/CategoryContext';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarHeader,
} from '@/components/ui/sidebar';

export function SidebarNavigationItems() {
  const { categories } = useCategories();

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="主页">
            <Link href="/">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-home"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <span>主页</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip="AI推荐">
            <Link href="/recommendations">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bot"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
              <span>AI推荐</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      {categories && categories.length > 0 && (
        <>
          <SidebarSeparator />
          <SidebarHeader className="px-2 pt-2 pb-1 group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium text-sidebar-foreground/70">分类</span>
          </SidebarHeader>
          <div className="flex-1 overflow-y-auto group-data-[collapsible=icon]:overflow-visible">
            <SidebarMenu className="px-2 pb-2">
              {categories.map((category) => (
                <SidebarMenuItem key={category.id}>
                  <SidebarMenuButton
                    asChild
                    tooltip={category.name}
                    variant="ghost"
                    size="sm"
                  >
                    <Link href={`/?category=${category.id}&page=1`}>
                      <LayoutGrid className="h-4 w-4" />
                      <span>{category.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        </>
      )}
    </>
  );
}
