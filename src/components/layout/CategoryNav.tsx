import React from 'react';
import { useCategories } from '@/contexts/CategoryContext';
import { cn } from '@/lib/utils';
import { Film, Tv, Palette, Theater, Popcorn, Compass, Flame } from 'lucide-react';

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
    if (name.includes('热') || name.includes('榜')) return Flame;
    return Popcorn;
  };

  if (!globalCategories || globalCategories.length <= 1) {
    return null;
  }

  return (
    <section className="relative z-30 mx-auto mb-6 w-full max-w-screen-3xl px-3 md:px-8">
      <div className="rounded-2xl border border-border/50 bg-card/60 p-2.5 shadow-sm backdrop-blur-xl md:p-3.5">
        <div className="hidden items-center justify-between pb-2.5 px-1 md:flex">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-primary" />
            <h2 className="text-sm font-semibold tracking-wide text-foreground">影视频道分类</h2>
          </div>
          <span className="text-xs text-muted-foreground/80">已加载 {globalCategories.length} 个分类</span>
        </div>

        <div className="overflow-x-auto scrollbar-none py-1">
          <div className="flex w-max gap-2 px-1 md:w-full md:flex-wrap">
            {globalCategories.map((category) => {
              const Icon = getIcon(category.name);
              const isActive = selectedCategoryId === category.id;
              
              return (
                <button
                  key={category.id}
                  onClick={() => onCategoryChange(category.id)}
                  className={cn(
                    "group flex h-9 items-center gap-2 rounded-full border px-4 text-xs md:text-sm font-medium transition-all duration-200 active:scale-95",
                    isActive 
                      ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20" 
                      : "border-border/60 bg-background/50 text-muted-foreground hover:border-primary/40 hover:bg-muted/70 hover:text-foreground"
                  )}
                >
                  <Icon className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-primary-foreground" : "text-muted-foreground/80"
                  )} />
                  <span>{category.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
