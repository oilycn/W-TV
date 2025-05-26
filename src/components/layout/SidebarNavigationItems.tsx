
'use client';

import Link from 'next/link';
import { useCategories } from '@/contexts/CategoryContext';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';

export function SidebarNavigationItems() {
  const { categories } = useCategories();

  return (
    <>
      {categories && categories.length > 0 && (
        <>
          <SidebarSeparator />
          {/* Removed the "分类" (Categories) sub-header */}
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
                      {/* Icon removed */}
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
