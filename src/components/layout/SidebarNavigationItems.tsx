
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

  // Determine the effective current category ID
  // If no category is in URL, and 'all' exists, 'all' is active.
  // If 'all' doesn't exist, and no category in URL, the first category is active.
  let effectiveCurrentCategoryId: string | null = currentCategoryIdParam;
  if (!currentCategoryIdParam) {
    if (categories.find(c => c.id === 'all')) {
      effectiveCurrentCategoryId = 'all';
    } else if (categories.length > 0) {
      // Fallback to the first category if 'all' is not an option and no param is set
      // This case might not be strictly necessary if 'all' is always prepended or default
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
                    size="default" // Using default size which is slightly larger
                    isActive={effectiveCurrentCategoryId === category.id}
                    className={cn(
                      "justify-start w-full text-left text-sm", // Increased base font size
                      (effectiveCurrentCategoryId === category.id) && "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
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

