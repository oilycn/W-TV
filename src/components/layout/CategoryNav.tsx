import React from 'react';
import { useCategories } from '@/contexts/CategoryContext';
import { cn } from '@/lib/utils';
import { Film, Tv, Palette, Theater, Popcorn, Compass } from 'lucide-react';

interface CategoryNavProps {
  selectedCategoryId: string;
  onCategoryChange: (id: string) => void;
}

export function CategoryNav({ selectedCategoryId, onCategoryChange }: CategoryNavProps) {
  const { categories: globalCategories } = useCategories();

  const getIcon = (name: string) => {
    if (name.includes('电影')) return Film;
    if (name.includes('剧')) return Tv;
    if (name.includes('动漫')) return Palette;
    if (name.includes('综艺')) return Theater;
    if (name.includes('全部')) return Compass;
    return Popcorn;
  };

  return (
    <section className="relative z-30 mx-auto mb-5 w-full max-w-screen-3xl px-0 md:px-8">
      <div className="md:rounded-xl md:border md:border-border/70 md:bg-background/80 md:p-4 md:shadow-sm md:backdrop-blur">
        <div className="hidden items-end justify-between gap-4 pb-3 md:flex">
          <div>
            <p className="text-xs font-medium text-muted-foreground">频道 Dock</p>
            <h2 className="text-xl font-bold text-foreground">快速切换分类</h2>
          </div>
          <p className="text-xs text-muted-foreground">共 {globalCategories.length} 个分类</p>
        </div>
        <div className="overflow-x-auto scrollbar-none pb-2 md:overflow-visible md:pb-0">
          <div className="flex w-max gap-2 px-4 py-1 md:w-full md:flex-wrap md:px-0 md:py-0">
          {globalCategories.map((category) => {
            const Icon = getIcon(category.name);
            const isActive = selectedCategoryId === category.id;
            
            return (
              <button
                key={category.id}
                onClick={() => onCategoryChange(category.id)}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors md:rounded-lg",
                  isActive 
                    ? "border-foreground bg-foreground text-background shadow-sm" 
                    : "border-border/70 bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-background" : "text-muted-foreground")} />
                {category.name}
              </button>
            );
          })}
          </div>
        </div>
      </div>
    </section>
  );
}
