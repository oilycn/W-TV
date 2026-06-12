import type { ContentItem } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Tv } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ContentCardProps {
  item: ContentItem;
  sourceId?: string;
  sourceName?: string;
}

export function ContentCard({ item, sourceId, sourceName }: ContentCardProps) {
  const getAiHint = (currentItem: ContentItem) => {
    if (currentItem.genres && currentItem.genres.length > 0) {
      return currentItem.genres.slice(0, 2).join(" ").toLowerCase();
    }
    return currentItem.title.split(" ")[0].toLowerCase() || "movie poster";
  }

  const linkHref = sourceId 
    ? `/content/${item.id}?sourceId=${sourceId}` 
    : `/content/${item.id}`;

  return (
    <div className="group flex flex-col h-full animate-in zoom-in-95 fade-in duration-500 ease-out fill-mode-both" style={{ animationDelay: `${Math.random() * 200}ms` }}>
      <Link href={linkHref} prefetch={false} className="block relative h-full">
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted/30 transition-all duration-500 transform-gpu group-hover:-translate-y-2 group-hover:scale-[1.02] group-hover:shadow-[0_20px_40px_rgba(var(--primary),0.15)] group-hover:ring-1 group-hover:ring-primary/30 border border-border/40">
          <Image
            src={item.posterUrl}
            alt={item.title || 'Content Poster'}
            fill
            style={{ objectFit: "cover" }}
            className="transition-transform duration-700 ease-out group-hover:scale-110"
            unoptimized={item.posterUrl.startsWith('https://placehold.co')}
            data-ai-hint={getAiHint(item)}
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 15vw"
          />
          
          {item.remarks && (
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white/90 text-[11px] font-medium px-2 py-0.5 rounded-full z-20 border border-white/10 shadow-sm transition-transform duration-300 group-hover:scale-105">
              {item.remarks}
            </div>
          )}

          {/* Glare effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/0 group-hover:via-white/10 transition-all duration-700 opacity-0 group-hover:opacity-100 mix-blend-overlay"></div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500"></div>
          
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 scale-90 group-hover:scale-100">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] border border-white/30 transition-transform duration-300 hover:scale-110 hover:bg-white/30">
              <svg className="w-7 h-7 text-white ml-1 drop-shadow-md" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
      <div className="pt-3 pb-1 flex flex-col flex-grow transition-transform duration-500 group-hover:-translate-y-1">
        <h3 className="font-semibold text-sm leading-tight text-foreground truncate mb-1.5" title={item.title}>
          <Link href={linkHref} prefetch={false}>
            {item.title || "未知标题"}
          </Link>
        </h3>
        
        <div className="flex items-center text-xs text-muted-foreground gap-x-2 flex-wrap">
          {item.userRating && (
            <div className="flex items-center gap-1 text-amber-500 font-medium">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>{item.userRating.toFixed(1)}</span>
            </div>
          )}
          {item.releaseYear && <span>{item.releaseYear}</span>}
          {item.genres && item.genres.length > 0 && (
            <span className="truncate">{item.genres[0]}</span>
          )}
        </div>
        
        {sourceName && (
          <div className="mt-auto pt-2">
            <Badge variant="outline" className="flex items-center gap-1.5 w-full justify-center text-xs py-1 px-2">
              <Tv className="h-3 w-3" />
              <span className="truncate">{sourceName}</span>
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
