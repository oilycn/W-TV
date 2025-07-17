import type { ContentItem } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';

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
    <Link href={linkHref} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted shadow-sm group-hover:shadow-lg transition-all duration-300">
        {/* 海报图片 */}
        <Image
          src={item.posterUrl}
          alt={item.title || 'Content Poster'}
          fill
          style={{ objectFit: "cover" }}
          className="transition-transform duration-300 group-hover:scale-110"
          unoptimized={item.posterUrl.startsWith('https://placehold.co')}
          data-ai-hint={getAiHint(item)}
        />
        
        {/* 更新状态标签 - 右上角 */}
        {item.remarks && (
          <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md font-medium shadow-lg z-10">
            {item.remarks}
          </div>
        )}
        
        {/* 底部信息覆盖层 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-8">
          <div className="text-white">
            {/* 评分和标题 */}
            <div className="flex items-start gap-2 mb-1">
              {/* 评分 - 移动端显示在标题前 */}
              {item.userRating && (
                <div className="flex items-center gap-1 bg-yellow-500/20 backdrop-blur-sm text-yellow-400 text-xs px-1.5 py-0.5 rounded flex-shrink-0">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="font-semibold">{item.userRating.toFixed(1)}</span>
                </div>
              )}
              
              {/* 标题 */}
              <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex-1" title={item.title}>
                {item.title || "未知标题"}
              </h3>
            </div>
            
            {/* 年份和类型 */}
            <div className="flex items-center gap-2 text-xs text-white/80">
              {item.releaseYear && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-white font-medium">
                  {item.releaseYear}
                </span>
              )}
              {item.genres && item.genres.length > 0 && (
                <span className="truncate">
                  {item.genres[0]}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* 悬停效果遮罩 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>
        
        {/* 播放按钮 - 悬停时显示 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
            <div className="w-0 h-0 border-l-[8px] border-l-black border-y-[6px] border-y-transparent ml-1"></div>
          </div>
        </div>
      </div>
    </Link>
  );
}
