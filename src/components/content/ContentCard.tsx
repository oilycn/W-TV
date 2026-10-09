'use client';

import { useState } from 'react';
import type { ContentItem } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Tv, Film, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ContentCardProps {
  item: ContentItem;
  sourceId?: string;
  sourceName?: string;
}

export function ContentCard({ item, sourceId, sourceName }: ContentCardProps) {
  const [imgError, setImgError] = useState(false);

  const getAiHint = (currentItem: ContentItem) => {
    if (currentItem.genres && currentItem.genres.length > 0) {
      return currentItem.genres.slice(0, 2).join(" ").toLowerCase();
    }
    return currentItem.title.split(" ")[0].toLowerCase() || "movie poster";
  };

  const linkHref = sourceId 
    ? `/content/${item.id}?sourceId=${sourceId}` 
    : `/content/${item.id}`;

  const [useProxy, setUseProxy] = useState(false);

  const getPosterSrc = () => {
    if (!item.posterUrl) return '';
    if (item.posterUrl.startsWith('/api/proxy')) return item.posterUrl;
    const needsDirectProxy = item.posterUrl.includes('wirqed.cn') || item.posterUrl.includes('huangguo');
    if (useProxy || needsDirectProxy) {
      return `/api/proxy?url=${encodeURIComponent(item.posterUrl)}`;
    }
    return item.posterUrl;
  };

  const handleImageError = () => {
    if (!useProxy && item.posterUrl && !item.posterUrl.startsWith('/api/proxy')) {
      // 首次加载失败时尝试走安全代理
      setUseProxy(true);
    } else {
      setImgError(true);
    }
  };

  const hasPoster = item.posterUrl && !imgError;

  return (
    <div className="group flex h-full flex-col">
      <Link href={linkHref} prefetch={false} className="relative block h-full">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border/50 bg-muted/40 shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-1.5 group-hover:border-primary/40 group-hover:shadow-xl group-hover:shadow-primary/5">
          {hasPoster ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={getPosterSrc()}
              alt={item.title || 'Content Poster'}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              data-ai-hint={getAiHint(item)}
              onError={handleImageError}
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-muted/80 via-muted to-muted/60 p-4 text-center">
              <Film className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <span className="line-clamp-2 text-xs font-medium text-muted-foreground/80">
                {item.title || '暂无海报'}
              </span>
            </div>
          )}

          {/* 右上角：更新状态/剧集备注角标 */}
          {item.remarks && (
            <div className="absolute right-2 top-2 z-20 max-w-[85%] truncate rounded-md border border-white/20 bg-black/75 px-2 py-0.5 text-[11px] font-medium text-white shadow-md backdrop-blur-md">
              {item.remarks}
            </div>
          )}

          {/* 左上角：评分高亮徽章 */}
          {item.userRating && item.userRating > 0 && (
            <div className="absolute left-2 top-2 z-20 flex items-center gap-0.5 rounded-md border border-amber-500/20 bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400 shadow-md backdrop-blur-md">
              <Star className="h-3 w-3 fill-current text-amber-400" />
              <span>{item.userRating.toFixed(1)}</span>
            </div>
          )}

          {/* 悬浮遮罩与播放图标 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 ease-out group-hover:scale-100 group-hover:opacity-100 scale-75">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-white/25 shadow-2xl backdrop-blur-md transition-transform duration-200 group-hover:scale-110">
              <Play className="ml-1 h-5 w-5 text-white fill-white drop-shadow-md" />
            </div>
          </div>
        </div>
      </Link>

      {/* 底部标题及分类信息 */}
      <div className="flex flex-grow flex-col pb-1 pt-2.5">
        <h3 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary" title={item.title}>
          <Link href={linkHref} prefetch={false}>
            {item.title || '未知标题'}
          </Link>
        </h3>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {item.releaseYear && <span>{item.releaseYear}</span>}
          {item.genres && item.genres.length > 0 && (
            <span className="truncate">{item.genres.slice(0, 2).join(' / ')}</span>
          )}
        </div>

        {sourceName && (
          <div className="mt-auto pt-2">
            <Badge variant="outline" className="flex w-full items-center justify-center gap-1.5 rounded-md border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
              <Tv className="h-3 w-3" />
              <span className="truncate">{sourceName}</span>
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
