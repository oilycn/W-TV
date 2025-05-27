
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCategories } from '@/contexts/CategoryContext';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function SidebarNavigationItems() {
  const { categories } = useCategories();
  const searchParams = useSearchParams();
  const currentCategoryIdParam = searchParams.get('category');

  let effectiveCurrentCategoryId: string | null = currentCategoryIdParam;
  if (!currentCategoryIdParam) {
    if (categories.some(c => c.id === 'all')) {
      effectiveCurrentCategoryId = 'all';
    } else if (categories.length > 0 && categories[0]) {
      effectiveCurrentCategoryId = categories[0].id;
    }
  }
  
  if (!categories || categories.length === 0) {
    return null; // Don't render if no categories
  }

  return (
    <div className="flex-1 overflow-y-auto group-data-[collapsible=icon]:overflow-visible">
      <SidebarMenu className="px-2 pb-2">
        {categories.map((category) => {
          if (!category || !category.id) return null; // Skip if category or id is invalid

          // Preserve activeSourceTrigger, clear search (q) and set page to 1
          const newLinkParams = new URLSearchParams(searchParams.toString());
          newLinkParams.set('category', category.id);
          newLinkParams.set('page', '1');
          newLinkParams.delete('q'); // Remove search query when changing category

          const linkHref = `/?${newLinkParams.toString()}`;

          return (
            <SidebarMenuItem key={category.id}>
              <SidebarMenuButton
                asChild
                tooltip={category.name}
                variant="ghost"
                size="default" 
                isActive={effectiveCurrentCategoryId === category.id}
                className={cn(
                  "text-center text-base py-2.5", // Changed from justify-start text-left
                  (effectiveCurrentCategoryId === category.id) 
                    ? "bg-sidebar-accent text-sidebar-primary font-semibold rounded-md" 
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 rounded-md" 
                )}
              >
                <Link href={linkHref} scroll={false}>
                  <span>{category.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}
