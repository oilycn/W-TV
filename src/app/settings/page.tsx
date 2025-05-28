
"use client";

import { useState, useEffect } from 'react';
import type { SourceConfig, RawSubscriptionSourceItem } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, DownloadCloud } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_SUBSCRIPTION_URL = 'cinemaViewSubscriptionUrl';
const DEFAULT_SOURCE_PROCESSED_FLAG_KEY = 'cinemaViewDefaultSourceProcessed';
const LOCAL_STORAGE_KEY_ACTIVE_SOURCE = 'cinemaViewActiveSourceId';


export default function SettingsPage() {
  const [sources, setSources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const [activeSourceId, setActiveSourceId] = useLocalStorage<string | null>(LOCAL_STORAGE_KEY_ACTIVE_SOURCE, null);
  const [subscriptionUrl, setSubscriptionUrl] = useLocalStorage<string>(LOCAL_STORAGE_KEY_SUBSCRIPTION_URL, '');
  
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [currentSubscriptionUrlInput, setCurrentSubscriptionUrlInput] = useState(subscriptionUrl);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);

  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setCurrentSubscriptionUrlInput(subscriptionUrl); // Sync input field with loaded storage value
  }, [subscriptionUrl]);


  useEffect(() => {
    if (!isClient) {
      return; 
    }

    const hasBeenProcessed = localStorage.getItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY);

    if (sources.length === 0 && !hasBeenProcessed && !subscriptionUrl) {
      const defaultSource: SourceConfig = {
        id: `default-heimuer-${Date.now().toString()}`, 
        name: "黑木耳",
        url: "https://json.heimuer.tv/api.php/provide/vod"
      };
      setSources([defaultSource]);
      setActiveSourceId(defaultSource.id);
      localStorage.setItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY, 'true');
      
      setTimeout(() => {
        toast({
          title: "默认内容源已添加",
          description: `“${defaultSource.name}” 已作为默认源添加。您可以在下方管理它。`,
          duration: 5000,
        });
      }, 100);
    } else if (sources.length > 0 && (!activeSourceId || !sources.find(s => s.id === activeSourceId))) {
      setActiveSourceId(sources[0].id);
    } else if (sources.length === 0 && activeSourceId) {
      setActiveSourceId(null);
    }

  }, [isClient, sources, setSources, toast, activeSourceId, setActiveSourceId, subscriptionUrl]); 

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
        setActiveSourceId(updatedSources[0].id);
      } else {
        setActiveSourceId(null);
         if (isClient) localStorage.removeItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY);
      }
    }
    toast({
      title: "成功",
      description: "内容源已移除。",
    });
    if (updatedSources.length === 0 && isClient) {
       localStorage.removeItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY);
    }
  };

  const handleLoadSubscription = async () => {
    if (!currentSubscriptionUrlInput.trim()) {
      toast({ title: "提示", description: "请输入订阅链接 URL。", variant: "default" });
      return;
    }
    try {
      new URL(currentSubscriptionUrlInput);
    } catch (_) {
      toast({ title: "错误", description: "订阅链接 URL 无效。", variant: "destructive" });
      return;
    }

    setIsLoadingSubscription(true);
    try {
      const proxyRequestUrl = `/api/proxy?url=${encodeURIComponent(currentSubscriptionUrlInput)}`;
      const response = await fetch(proxyRequestUrl);
      
      // Try to parse the proxy's response as JSON. The proxy should always return JSON.
      let data;
      try {
        data = await response.json();
        console.log("Subscription: Data received from proxy on settings page:", JSON.stringify(data, null, 2));
      } catch (e) {
        // This means the proxy itself returned something that wasn't JSON (e.g., an HTML error page)
        console.error("Subscription: Failed to parse JSON response from proxy. Status:", response.status, "Response Text:", await response.text().catch(() => "Could not get response text."));
        throw new Error(`代理服务返回了无效的响应 (状态: ${response.status})。`);
      }

      if (!response.ok) { // Check if proxy itself returned an error status (e.g., 4xx, 5xx)
        const errorMessage = data.error || data.message || `获取订阅失败: ${response.statusText}`;
        console.error("Subscription: Proxy returned an error status. Response data from proxy:", data);
        throw new Error(errorMessage);
      }
      
      // At this point, response.ok was true, and `data` is the JSON parsed from the proxy's response.
      // Now check if the `data` from proxy indicates an error *it* caught from upstream, or if it's nonJsonData
      if (data.error) { 
        console.error("Subscription: Proxy reported an error from upstream subscription URL:", data.error, "Details:", data.details);
        throw new Error(data.error + (data.details ? `: ${data.details}` : ''));
      }

      if (data.nonJsonData) { 
        console.warn("Subscription: Proxy reported upstream subscription URL returned non-JSON text:", data.nonJsonData.substring(0,200));
        throw new Error(`订阅链接返回的不是有效的JSON数据: ${data.nonJsonData.substring(0,100)}`);
      }
      
      // If we reach here, `data` should be the actual JSON from the subscription URL (passed through by the proxy)
      let rawItems: RawSubscriptionSourceItem[] | undefined;
      console.log("Subscription: Attempting to extract 'sites' array from the data.");

      if (typeof data === 'object' && data !== null && data.sites !== undefined) {
        if (Array.isArray(data.sites)) {
            rawItems = data.sites as RawSubscriptionSourceItem[];
            console.log(`Subscription: Successfully extracted 'sites' array with ${rawItems.length} items.`);
        } else {
            console.error("Subscription: 'data.sites' exists but is not an array. Value:", data.sites);
            throw new Error("订阅链接中的 'sites' 属性不是一个有效的列表。");
        }
      } else if (Array.isArray(data)) {
        // Fallback for simpler subscriptions where the root is the array of items
        rawItems = data as RawSubscriptionSourceItem[];
        console.log(`Subscription: Data itself is an array (fallback scenario) with ${rawItems.length} items.`);
      } else {
        console.error("Subscription: Invalid data format from subscription link. Expected object with 'sites' array or a direct array. Received:", data);
        throw new Error("订阅链接返回的数据格式无效。请检查订阅源的JSON结构。");
      }
      
      const newSubscribedSources: SourceConfig[] = (rawItems || [])
        .filter(item => item && typeof item === 'object' && item.type === 1 && item.api && (item.name || item.key))
        .map(item => ({
          id: `sub-${item.api}-${item.name || item.key}-${Math.random().toString(36).substring(2, 9)}`,
          name: (item.name || item.key)!,
          url: item.api!,
        }));
      
      console.log(`Subscription: Filtered down to ${newSubscribedSources.length} sources of type 1.`);

      if (newSubscribedSources.length > 0) {
        setSources(newSubscribedSources);
        setActiveSourceId(newSubscribedSources[0]?.id || null);
        setSubscriptionUrl(currentSubscriptionUrlInput); 
        localStorage.setItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY, 'true'); 
        toast({ title: "成功", description: `从订阅链接加载了 ${newSubscribedSources.length} 个内容源。` });
      } else {
        // If subscription yields no valid type:1 sources, clear existing manual/default sources
        // and save the subscription URL. This allows an "empty" subscription to effectively reset.
        setSources([]); 
        setActiveSourceId(null);
        setSubscriptionUrl(currentSubscriptionUrlInput);
        localStorage.removeItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY); // Allow default to re-add if sub is later removed
        toast({ title: "提示", description: "订阅链接中未找到有效的内容源 (类型为1)。现有内容源已清空。", variant: "default" });
      }

    } catch (error) {
      console.error("Error loading subscription:", error);
      toast({ title: "加载订阅失败", description: error instanceof Error ? error.message : "发生未知错误。", variant: "destructive" });
    } finally {
      setIsLoadingSubscription(false);
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

    if (sources.length === 0) {
      return <p className="text-muted-foreground">暂无内容源。请添加一个以上的内容源或使用订阅链接加载。</p>;
    }

    return (
      <div className="space-y-4">
        {sources.map(source => (
          <Card 
            key={source.id} 
            className={`flex items-center justify-between p-4 shadow-md ${source.id === activeSourceId ? 'border-primary ring-2 ring-primary' : ''}`}
          >
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
          管理您的内容源。您可以手动添加视频 API 接口，或通过订阅链接批量加载。
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>订阅链接</CardTitle>
          <CardDescription>输入包含内容源配置的 JSON 订阅链接。加载后会替换当前所有手动添加的源。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subscriptionUrl">订阅链接 URL</Label>
            <Input
              id="subscriptionUrl"
              type="url"
              value={currentSubscriptionUrlInput}
              onChange={(e) => setCurrentSubscriptionUrlInput(e.target.value)}
              placeholder="例如: https://example.com/sources.json"
              disabled={isLoadingSubscription}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleLoadSubscription} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoadingSubscription}
          >
            <DownloadCloud className="mr-2 h-4 w-4" /> 
            {isLoadingSubscription ? "加载中..." : "加载订阅"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>手动添加新内容源</CardTitle>
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
        <h2 className="text-2xl font-semibold mb-4 text-foreground">当前内容源列表</h2>
        {renderSourcesList()}
      </div>

    </div>
  );
}

