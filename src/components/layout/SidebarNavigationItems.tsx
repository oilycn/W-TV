
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
  const currentCategoryIdParam = searchParams.get('category');

  let effectiveCurrentCategoryId: string | null = currentCategoryIdParam;
  if (!currentCategoryIdParam) {
    if (categories.find(c => c.id === 'all')) {
      effectiveCurrentCategoryId = 'all';
    } else if (categories.length > 0) {
      effectiveCurrentCategoryId = categories[0].id;
    }
  }

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
                    size="default" 
                    isActive={effectiveCurrentCategoryId === category.id}
                    className={cn(
                      "justify-start w-full text-left text-base py-2.5", 
                      (effectiveCurrentCategoryId === category.id) 
                        ? "bg-sidebar-accent text-sidebar-primary font-semibold rounded-md" 
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md" 
                    )}
                  >
                    <Link href={`/?category=${category.id}&page=1`} scroll={false}>
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
