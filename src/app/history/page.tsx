
"use client";

import { useLocalStorage } from '@/hooks/useLocalStorage';
import type { HistoryEntry } from '@/types';
import { ContentCard } from '@/components/content/ContentCard';
import { Button } from '@/components/ui/button';
import { History as HistoryIcon, Trash2 } from 'lucide-react';
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

const LOCAL_STORAGE_KEY_HISTORY = 'cinemaViewHistory';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          观看历史
        </h1>
        {history.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
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
                <AlertDialogAction onClick={handleClearHistory}>
                  确定
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {sortedHistory.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
          {sortedHistory.map(({ item, sourceId, watchedAt, episodeName }) => (
            <div key={`${item.id}-${watchedAt}`} className="flex flex-col">
              <ContentCard item={item} sourceId={sourceId} />
               <p className="mt-1 text-xs text-muted-foreground text-center">
                {new Date(watchedAt).toLocaleString()}
              </p>
              {episodeName && (
                <p className="mt-1 text-xs text-foreground font-medium text-center truncate" title={episodeName}>
                  看到: {episodeName}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] text-center p-4">
          <HistoryIcon className="w-24 h-24 mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-semibold mb-2 text-foreground">暂无观看历史</h2>
          <p className="mb-6 text-muted-foreground max-w-md">
            您还没有观看任何影片。开始浏览并播放，您的历史记录将显示在这里。
          </p>
           <Button asChild>
              <Link href="/">去首页看看</Link>
            </Button>
        </div>
      )}
    </div>
  );
}
