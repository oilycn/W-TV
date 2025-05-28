
"use client";

import { useState, useEffect } from 'react';
import type { SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const DEFAULT_SOURCE_PROCESSED_FLAG_KEY = 'cinemaViewDefaultSourceProcessed';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';


export default function SettingsPage() {
  const [sources, setSources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId, setActiveSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);


  useEffect(() => {
    if (!isClient) {
      return; 
    }

    const hasBeenProcessed = localStorage.getItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY);

    if (sources && sources.length === 0 && !hasBeenProcessed) {
      const defaultSource: SourceConfig = {
        id: `default-ffzy-${Date.now().toString()}`, 
        name: "采集资源 FFZY",
        url: "https://cj.ffzyapi.com/api.php/provide/vod"
      };
      setSources([defaultSource]);
      setActiveSourceId(defaultSource.id); // Set the new default source as active
      localStorage.setItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY, 'true');
      
      setTimeout(() => {
        toast({
          title: "默认内容源已添加",
          description: "“采集资源 FFZY” 已作为默认源添加。您可以在下方管理它。",
          duration: 5000,
        });
      }, 100);
    } else if (sources.length > 0 && (!activeSourceId || !sources.find(s => s.id === activeSourceId))) {
      // If there's no active source or active ID is invalid, set first source as active
      setActiveSourceId(sources[0].id);
    } else if (sources.length === 0 && activeSourceId) {
      // If no sources, clear active source ID
      setActiveSourceId(null);
    }

  }, [isClient, sources, setSources, toast, activeSourceId, setActiveSourceId]); 

  const handleAddSource = () => {
    if (!newSourceName.trim() || !newSourceUrl.trim()) {
      toast({
        title: "错误",
        description: "源名称和 URL 不能为空。",
        variant: "destructive",
      });
      return;
    }
    try {
      new URL(newSourceUrl); 
    } catch (_) {
      toast({
        title: "错误",
        description: "请输入有效的 URL。",
        variant: "destructive",
      });
      return;
    }
    const newSource = { id: Date.now().toString(), name: newSourceName, url: newSourceUrl };
    const updatedSources = [...sources, newSource];
    setSources(updatedSources);
    // If this is the first source being added (after potentially being empty), set it as active.
    if (sources.length === 0) {
        setActiveSourceId(newSource.id);
    }

    setNewSourceName('');
    setNewSourceUrl('');
    toast({
      title: "成功",
      description: "内容源已添加。",
    });
    if (isClient && !localStorage.getItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY)) {
      localStorage.setItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY, 'true');
    }
  };

  const handleRemoveSource = (idToRemove: string) => {
    const updatedSources = sources.filter(source => source.id !== idToRemove);
    setSources(updatedSources);

    if (activeSourceId === idToRemove) {
      if (updatedSources.length > 0) {
        setActiveSourceId(updatedSources[0].id); // Set next source as active
      } else {
        setActiveSourceId(null); // No sources left
         if (isClient) localStorage.removeItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY); // Allow default to be re-added if settings are visited again
      }
    }
    toast({
      title: "成功",
      description: "内容源已移除。",
    });
     // If all sources are removed, reset the flag so default can be added again if user revisits
    if (updatedSources.length === 0 && isClient) {
       localStorage.removeItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY);
    }
  };

  const renderSourcesList = () => {
    if (!isClient) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-[76px] w-full rounded-md" />
          <Skeleton className="h-[76px] w-full rounded-md" />
        </div>
      );
    }

    if (sources && sources.length === 0) {
      return <p className="text-muted-foreground">暂无内容源。请添加一个以上的内容源以开始浏览。</p>;
    }

    return (
      <div className="space-y-4">
        {sources && sources.map(source => (
          <Card key={source.id} className={`flex items-center justify-between p-4 shadow-md ${source.id === activeSourceId ? 'border-primary ring-2 ring-primary' : ''}`}>
            <div>
              <p className="font-medium text-foreground">{source.name}</p>
              <p className="text-sm text-muted-foreground break-all">{source.url}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleRemoveSource(source.id)} aria-label="移除源">
              <Trash2 className="h-5 w-5 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-foreground">内容源设置</h1>
        <p className="text-muted-foreground">
          管理您的内容源。添加或移除视频 API 接口地址。
          应用程序将从这些 URL 获取内容。请确保 URL 返回符合预期的 JSON 格式。
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>添加新内容源</CardTitle>
          <CardDescription>输入内容源的名称和 URL。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sourceName">源名称</Label>
            <Input
              id="sourceName"
              value={newSourceName}
              onChange={(e) => setNewSourceName(e.target.value)}
              placeholder="例如：我的电影收藏"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sourceUrl">源 URL</Label>
            <Input
              id="sourceUrl"
              type="url"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="https://example.com/api/content.json"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleAddSource} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <PlusCircle className="mr-2 h-4 w-4" /> 添加源
          </Button>
        </CardFooter>
      </Card>

      <div>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">当前内容源</h2>
        {renderSourcesList()}
      </div>

    </div>
  );
}
