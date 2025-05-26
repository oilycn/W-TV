
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCategories } from '@/contexts/CategoryContext';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function SidebarNavigationItems() {
  const { categories } = useCategories();
  const searchParams = useSearchParams();
  const currentCategoryId = searchParams.get('category');

  return (
    <>
      {categories && categories.length > 0 && (
        <>
          <SidebarSeparator />
          <div className="flex-1 overflow-y-auto group-data-[collapsible=icon]:overflow-visible">
            <SidebarMenu className="px-2 pb-2">
              {categories.map((category) => (
                <SidebarMenuItem key={category.id}>
                  <SidebarMenuButton
                    asChild
                    tooltip={category.name}
                    variant="ghost"
                    size="sm"
                    isActive={currentCategoryId === category.id || (currentCategoryId === null && category.id === 'all')} // 'all' or first category if none selected
                    className={cn(
                      "justify-start w-full text-left",
                      (currentCategoryId === category.id || (!currentCategoryId && category.id === 'all')) && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                  >
                    <Link href={`/?category=${category.id}&page=1`}>
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
