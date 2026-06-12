"use client";

import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { HistoryEntry } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History as HistoryIcon, Trash2, Play, Clock, Tv, Film } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';
import Image from 'next/image';

const LOCAL_STORAGE_KEY_HISTORY = 'cinemaViewHistory';

function formatRelativeTime(timestamp: number) {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - timestamp) / 1000);
  
  if (diffInSeconds < 60) return '刚刚';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} 分钟前`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} 小时前`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays} 天前`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths} 个月前`;
  
  return new Date(timestamp).toLocaleDateString();
}

export default function HistoryPage() {
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>(LOCAL_STORAGE_KEY_HISTORY, []);
  const { toast } = useToast();

  const handleClearHistory = () => {
    setHistory([]);
    toast({
      title: "成功",
      description: "观看历史已清空。",
    });
  };

  const sortedHistory = [...history].sort((a, b) => b.watchedAt - a.watchedAt);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 px-4 md:px-0">
      
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border/40">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-black text-foreground flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <HistoryIcon className="w-7 h-7 text-primary" />
            </div>
            观看历史
          </h1>
          <p className="text-muted-foreground ml-14">
            随时随地，接着看。
          </p>
        </div>
        
        {history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0">
                <Trash2 className="mr-2 h-4 w-4" />
                清空历史
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确定要清空所有观看历史吗？</AlertDialogTitle>
                <AlertDialogDescription>
                  此操作无法撤销。所有历史记录将被永久删除。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                  确定清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* History List */}
      {sortedHistory.length > 0 ? (
        <div className="flex flex-col gap-4">
          {sortedHistory.map(({ item, sourceId, sourceName, watchedAt, episodeName }) => {
            const linkHref = sourceId 
              ? `/content/${item.id}?sourceId=${sourceId}` 
              : `/content/${item.id}`;
            
            return (
              <Link 
                key={`${item.id}-${watchedAt}`} 
                href={linkHref}
                className="group relative flex flex-col sm:flex-row gap-4 sm:gap-6 p-3 sm:p-4 rounded-2xl bg-card hover:bg-muted/30 border border-border/40 hover:border-primary/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.02)] transition-all duration-300 overflow-hidden"
              >
                {/* Thumbnail */}
                <div className="relative w-full sm:w-56 md:w-64 aspect-video shrink-0 rounded-xl overflow-hidden bg-muted/30 border border-border/20">
                  <Image
                    src={item.backdropUrl || item.posterUrl}
                    alt={item.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    unoptimized={item.backdropUrl?.startsWith('https://placehold.co') || item.posterUrl.startsWith('https://placehold.co')}
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
                  
                  {/* Play Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 scale-90 group-hover:scale-100">
                    <div className="w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(var(--primary),0.4)] backdrop-blur-md transform transition-transform hover:scale-110">
                       <Play className="w-5 h-5 ml-1" fill="currentColor" />
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col flex-1 min-w-0 justify-center py-1 sm:py-2">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="text-lg sm:text-xl font-bold truncate text-foreground group-hover:text-primary transition-colors duration-300">
                      {item.title}
                    </h3>
                  </div>
                  
                  {episodeName && (
                    <div className="mt-2.5 inline-flex">
                      <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-0 px-3 py-1 font-medium text-xs sm:text-sm shadow-sm">
                        <span className="opacity-70 mr-1.5 font-normal">看到</span> {episodeName}
                      </Badge>
                    </div>
                  )}
                  
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2 md:line-clamp-1 max-w-2xl">
                     {item.description || "暂无简介"}
                  </p>

                  <div className="mt-auto pt-4 flex flex-wrap items-center text-xs font-medium text-muted-foreground/80 gap-x-5 gap-y-2">
                     <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {formatRelativeTime(watchedAt)}</span>
                     {sourceName && <span className="flex items-center gap-1.5"><Tv className="w-3.5 h-3.5"/> {sourceName}</span>}
                     {item.genres && item.genres.length > 0 && <span className="flex items-center gap-1.5"><Film className="w-3.5 h-3.5"/> {item.genres[0]}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        /* Cinematic Empty State */
        <div className="relative flex flex-col items-center justify-center min-h-[50vh] text-center p-8 overflow-hidden rounded-3xl bg-muted/10 border border-border/30 mt-8">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-50" />
          <div className="relative z-10 p-6 bg-background/50 rounded-full mb-6 border border-border/50 shadow-2xl backdrop-blur-sm animate-in zoom-in duration-700">
             <HistoryIcon className="w-16 h-16 text-muted-foreground/50" />
          </div>
          <h2 className="relative z-10 text-2xl md:text-3xl font-bold mb-3 text-foreground tracking-tight">暂无观看历史</h2>
          <p className="relative z-10 mb-8 text-muted-foreground max-w-md text-base">
            就像一本还没打开的书，您的观影旅程还未开始。<br/>去首页发现精彩内容，记录您的每一次感动。
          </p>
          <Button asChild size="lg" className="relative z-10 rounded-full px-8 shadow-lg transition-transform hover:scale-105 active:scale-95">
             <Link href="/">探索海量影视</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
