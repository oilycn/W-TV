
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
      {/* Home and AI Recommendations links are now in AppHeader.tsx */}
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
