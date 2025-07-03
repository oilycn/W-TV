
"use client";

import { useState, useEffect } from 'react';
import type { SourceConfig, RawSubscriptionSourceItem } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, DownloadCloud, XCircle, Sun, Moon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';


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
  const [currentSubscriptionUrlInput, setCurrentSubscriptionUrlInput] = useState('');
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);

  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const { theme, toggleTheme } = useTheme();


  useEffect(() => {
    setIsClient(true);
  }, []); // Runs once on mount

  useEffect(() => {
    if (isClient) {
      setCurrentSubscriptionUrlInput(subscriptionUrl);
    }
  }, [subscriptionUrl, isClient]);


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
    if (sources.length === 0) { // if this is the first source being added
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
         if (isClient) localStorage.removeItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY); // No sources left, can re-add default later
      }
    }
    toast({
      title: "成功",
      description: "内容源已移除。",
    });
    if (updatedSources.length === 0 && isClient) {
       // If all sources are removed (including potentially the default one), clear the flag
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
      const proxyResponseData = await response.json();

      console.log("Subscription: Data received from proxy on settings page:", JSON.stringify(proxyResponseData, null, 2).substring(0, 500) + "...");

      if (!response.ok) { 
        const errorMsg = proxyResponseData.error || proxyResponseData.message || `代理服务错误: ${response.statusText}`;
        console.error("Subscription: Proxy returned an error status. Error:", errorMsg, "Details:", proxyResponseData.details);
        throw new Error(errorMsg);
      }
      
      if (proxyResponseData.error && !proxyResponseData.nonJsonData) { 
        console.error("Subscription: Proxy reported an error from upstream subscription URL:", proxyResponseData.error, "Details:", proxyResponseData.details);
        throw new Error(proxyResponseData.error + (proxyResponseData.details ? `: ${proxyResponseData.details}` : ''));
      }
      
      let rawItems: RawSubscriptionSourceItem[] = [];

      if (typeof proxyResponseData.nonJsonData === 'string') {
        console.warn("Subscription: Proxy returned raw string. Attempting to extract and parse 'sites' array string or individual objects from this content:", proxyResponseData.nonJsonData.substring(0, 300) + "...");
        
        const sitesRegex = /"sites"\s*:\s*(\[(?:.|\n|\r)*?\])/s;
        const match = proxyResponseData.nonJsonData.match(sitesRegex);

        if (match && match[1]) {
          const sitesArrayString = match[1];
          console.log("Subscription: Extracted 'sites' array string candidate:", sitesArrayString.substring(0, 300) + "...");
          try {
            rawItems = JSON.parse(sitesArrayString);
            console.log(`Subscription: Successfully parsed extracted 'sites' array string directly. Found ${rawItems.length} items.`);
          } catch (mainParseError) {
            console.warn("Subscription: Failed to parse the extracted 'sites' array string directly. Error:", (mainParseError as Error).message, "Attempting to parse individual objects within it...");
            
            const contentInsideBracketsMatch = sitesArrayString.match(/^\s*\[(.*)\]\s*$/s);
            if (contentInsideBracketsMatch && contentInsideBracketsMatch[1]) {
                const contentInsideBrackets = contentInsideBracketsMatch[1];
                const objectCandidateStrings = [];
                let balance = 0;
                let currentObjectStartIndex = -1;

                for (let i = 0; i < contentInsideBrackets.length; i++) {
                    if (contentInsideBrackets[i] === '{') {
                        if (balance === 0) {
                            currentObjectStartIndex = i;
                        }
                        balance++;
                    } else if (contentInsideBrackets[i] === '}') {
                        balance--;
                        if (balance === 0 && currentObjectStartIndex !== -1) {
                            objectCandidateStrings.push(contentInsideBrackets.substring(currentObjectStartIndex, i + 1));
                            currentObjectStartIndex = -1;
                        }
                    }
                }
                
                console.log(`Subscription: Found ${objectCandidateStrings.length} potential object strings within sites array.`);
                const parsedIndividualItems: RawSubscriptionSourceItem[] = [];
                for (const objStr of objectCandidateStrings) {
                    try {
                        const item = JSON.parse(objStr) as RawSubscriptionSourceItem;
                        parsedIndividualItems.push(item);
                    } catch (individualParseError) {
                        console.warn(`Subscription: Failed to parse individual object: "${objStr.substring(0, 100)}...". Error:`, (individualParseError as Error).message);
                    }
                }

                if (parsedIndividualItems.length > 0) {
                    rawItems = parsedIndividualItems;
                    console.log(`Subscription: Successfully parsed ${rawItems.length} individual objects after main 'sites' array parse failed.`);
                } else {
                    console.error("Subscription: Failed to parse the 'sites' array string and also failed to parse any individual objects within it.");
                    throw new Error(`无法解析提取的 'sites' 数组，也无法解析其内部对象: ${(mainParseError as Error).message}.`);
                }
            } else {
                console.error("Subscription: Extracted 'sites' string was not in a valid array [...] format for fallback parsing.");
                throw new Error(`提取的 'sites' 内容不是有效的数组格式，无法进行回退解析: ${(mainParseError as Error).message}.`);
            }
          }
        } else {
          console.error("Subscription: Could not find 'sites' array string in the raw content using regex. The content might be malformed or not contain a 'sites' key with an array.");
          throw new Error("无法在订阅内容中定位 'sites' 数组。请检查订阅源格式。");
        }
      } else if (typeof proxyResponseData === 'object' && proxyResponseData !== null) {
        // Proxy returned valid JSON, which should be the subscription data directly.
        console.log("Subscription: Proxy returned pre-parsed JSON or successfully parsed upstream. Looking for 'sites' array.");
        if (proxyResponseData.sites && Array.isArray(proxyResponseData.sites)) {
          rawItems = proxyResponseData.sites as RawSubscriptionSourceItem[];
          console.log(`Subscription: Successfully extracted 'sites' array from pre-parsed JSON. Found ${rawItems.length} items.`);
        } else if (Array.isArray(proxyResponseData)) { // Fallback: if the root is an array of source items
          rawItems = proxyResponseData as RawSubscriptionSourceItem[];
          console.log(`Subscription: Pre-parsed JSON is an array itself. Found ${rawItems.length} items.`);
        } else {
          console.error("Subscription: Pre-parsed JSON object does not contain a 'sites' array, nor is it an array itself. Data:", proxyResponseData);
          throw new Error("订阅链接的JSON结构无效 (缺少 'sites' 数组或根不是数组)。");
        }
      } else {
        console.error("Subscription: Unexpected response format from proxy after initial checks:", proxyResponseData);
        throw new Error("从代理服务收到了意外的响应格式。");
      }
      
      if (!rawItems || !Array.isArray(rawItems)) { 
         console.error("Subscription: 'rawItems' is undefined or not an array after all parsing attempts. This implies an unexpected state or failed extraction.");
         throw new Error("无法从订阅数据中提取有效的源列表。");
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
        setSubscriptionUrl(currentSubscriptionUrlInput); // Save the valid subscription URL
        localStorage.setItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY, 'true'); // Mark as processed since we got sources
        toast({ title: "成功", description: `从订阅链接加载了 ${newSubscribedSources.length} 个内容源。` });
      } else {
        setSources([]); // Clear existing sources if subscription yields none
        setActiveSourceId(null);
        // Keep subscriptionUrl if user entered one, even if it yields no sources
        // setSubscriptionUrl(currentSubscriptionUrlInput); 
        localStorage.removeItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY); // No valid sources from subscription, can add default later
        toast({ title: "提示", description: "订阅链接中未找到有效的内容源 (类型为1)。现有内容源已清空。", variant: "default" });
      }

    } catch (error) {
      console.error("Error loading subscription:", error);
      toast({ title: "加载订阅失败", description: error instanceof Error ? error.message : "发生未知错误。", variant: "destructive" });
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const handleRemoveSubscription = () => {
    setSubscriptionUrl('');
    setCurrentSubscriptionUrlInput('');
    setSources([]);
    setActiveSourceId(null);
    if (isClient) {
      localStorage.removeItem(DEFAULT_SOURCE_PROCESSED_FLAG_KEY);
    }
    toast({
      title: "订阅已移除",
      description: "订阅链接和所有相关内容源已清除。",
    });
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
        <h1 className="text-3xl font-bold mb-2 text-foreground">设置</h1>
        <p className="text-muted-foreground">
          管理您的内容源、主题和其他应用设置。
        </p>
      </div>

       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>外观设置</CardTitle>
          <CardDescription>自定义应用的外观和主题。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="theme-switch">主题模式</Label>
              <p className="text-xs text-muted-foreground">
                切换亮色或暗色主题。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              <Switch
                id="theme-switch"
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                aria-label="切换主题"
              />
              <Moon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>

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
        <CardFooter className="flex justify-between">
          <Button 
            onClick={handleLoadSubscription} 
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoadingSubscription}
          >
            <DownloadCloud className="mr-2 h-4 w-4" /> 
            {isLoadingSubscription ? "加载中..." : "加载订阅"}
          </Button>
          {isClient && subscriptionUrl && (
            <Button
              variant="destructive"
              onClick={handleRemoveSubscription}
              disabled={isLoadingSubscription}
            >
              <XCircle className="mr-2 h-4 w-4" />
              移除订阅
            </Button>
          )}
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
