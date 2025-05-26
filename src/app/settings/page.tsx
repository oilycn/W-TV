"use client";

import { useState } from 'react';
import type { SourceConfig } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'cinemaViewSources';

export default function SettingsPage() {
  const [sources, setSources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY, []);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const { toast } = useToast();

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
      new URL(newSourceUrl); // Validate URL
    } catch (_) {
      toast({
        title: "错误",
        description: "请输入有效的 URL。",
        variant: "destructive",
      });
      return;
    }

    setSources(prevSources => [
      ...prevSources,
      { id: Date.now().toString(), name: newSourceName, url: newSourceUrl },
    ]);
    setNewSourceName('');
    setNewSourceUrl('');
    toast({
      title: "成功",
      description: "内容源已添加。",
    });
  };

  const handleRemoveSource = (id: string) => {
    setSources(prevSources => prevSources.filter(source => source.id !== id));
    toast({
      title: "成功",
      description: "内容源已移除。",
    });
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">设置</h1>
      <p className="mb-8 text-muted-foreground">
        管理您的内容源。添加或移除视频 API 接口地址，类似于 TVBox 的配置。
        应用程序将从这些 URL 获取内容。请确保 URL 返回符合预期的 JSON 格式。
      </p>

      <Card className="mb-8 shadow-lg">
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

      <h2 className="text-2xl font-semibold mb-4 text-foreground">当前内容源</h2>
      {sources.length === 0 ? (
        <p className="text-muted-foreground">暂无内容源。请添加一个以上的内容源以开始浏览。</p>
      ) : (
        <div className="space-y-4">
          {sources.map(source => (
            <Card key={source.id} className="flex items-center justify-between p-4 shadow-md">
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
      )}
    </div>
  );
}
