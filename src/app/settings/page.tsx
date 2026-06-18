
"use client";

import { useState, useEffect } from 'react';
import type { SourceConfig, RawSubscriptionSourceItem } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Trash2, PlusCircle, DownloadCloud, XCircle, Sun, Moon, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useTheme } from '@/contexts/ThemeContext';
import { Switch } from '@/components/ui/switch';
import { useCategories } from '@/contexts/CategoryContext';


const LOCAL_STORAGE_KEY_SOURCES = 'cinemaViewSources';
const LOCAL_STORAGE_KEY_SUBSCRIPTION_URL = 'cinemaViewSubscriptionUrl';
const DEFAULT_SOURCE_PROCESSED_FLAG_KEY = 'cinemaViewDefaultSourceProcessed';


export default function SettingsPage() {
  const [sources, setSources] = useLocalStorage<SourceConfig[]>(LOCAL_STORAGE_KEY_SOURCES, []);
  const { activeSourceId, setActiveSourceId } = useCategories();
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
    } catch (_error) {
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
    } catch (_error) {
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
        
        const sitesRegex = /"sites"\s*:\s*(\[[\s\S]*?\])/;
        const match = proxyResponseData.nonJsonData.match(sitesRegex);

        if (match && match[1]) {
          const sitesArrayString = match[1];
          console.log("Subscription: Extracted 'sites' array string candidate:", sitesArrayString.substring(0, 300) + "...");
          try {
            rawItems = JSON.parse(sitesArrayString);
            console.log(`Subscription: Successfully parsed extracted 'sites' array string directly. Found ${rawItems.length} items.`);
          } catch (mainParseError) {
            console.warn("Subscription: Failed to parse the extracted 'sites' array string directly. Error:", (mainParseError as Error).message, "Attempting to parse individual objects within it...");
            
            const contentInsideBracketsMatch = sitesArrayString.match(/^\s*\[([\s\S]*)\]\s*$/);
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
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      );
    }

    if (sources.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-muted/50 rounded-full mb-3">
            <Settings className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-2">暂无内容源</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            您还没有添加任何内容源。请使用上方的订阅链接或手动添加功能来添加内容源。
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sources.map((source, index) => (
          <div 
            key={source.id} 
            className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
              source.id === activeSourceId 
                ? 'border-primary bg-primary/5 shadow-md' 
                : 'border-border bg-card hover:border-primary/50'
            }`}
          >
            {/* Active indicator */}
            {source.id === activeSourceId && (
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-accent"></div>
            )}
            
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Source icon */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                  source.id === activeSourceId 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {source.name.charAt(0).toUpperCase()}
                </div>
                
                {/* Source info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-foreground truncate">{source.name}</h4>
                    {source.id === activeSourceId && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        当前使用
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate" title={source.url}>
                    {source.url}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>源 #{index + 1}</span>
                    <span>•</span>
                    <span>API 接口</span>
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1">
                {source.id !== activeSourceId && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setActiveSourceId(source.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary hover:bg-primary/10 h-7 px-2 text-xs"
                  >
                    设为当前
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleRemoveSource(source.id)} 
                  aria-label="移除源"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        
        {/* Summary */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-dashed">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              共 {sources.length} 个内容源
            </span>
            <span className="text-muted-foreground">
              当前使用: {sources.find(s => s.id === activeSourceId)?.name || '未选择'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto py-4 sm:py-6 px-4 max-w-4xl">
        {/* Header Section */}
        <div className="text-center mb-4 sm:mb-6 animate-in fade-in-50 slide-in-from-top-5 duration-700">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full mb-2 sm:mb-3">
            <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            应用设置
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto px-2">
            个性化您的观影体验，管理内容源和应用偏好设置
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:gap-8 animate-in fade-in-50 duration-500">
          {/* Theme Settings */}
          <Card className="overflow-hidden border-0 shadow-lg bg-card/50 backdrop-blur-sm animate-in slide-in-from-left-5 duration-700 delay-100">
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-1">
              <div className="bg-card rounded-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-md">
                      {theme === 'dark' ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
                    </div>
                    <div>
                      <CardTitle className="text-lg">外观主题</CardTitle>
                      <CardDescription className="text-sm">选择界面主题风格</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 transition-all hover:bg-muted/50">
                    <div className="space-y-0.5">
                      <Label htmlFor="theme-switch" className="text-sm font-medium">主题模式</Label>
                      <p className="text-xs text-muted-foreground">
                        {theme === 'dark' ? '深色主题' : '浅色主题'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className={`h-4 w-4 transition-colors ${theme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <Switch
                        id="theme-switch"
                        checked={theme === 'dark'}
                        onCheckedChange={toggleTheme}
                        aria-label="切换主题"
                        className="data-[state=checked]:bg-primary"
                      />
                      <Moon className={`h-4 w-4 transition-colors ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                  </div>
                </CardContent>
              </div>
            </div>
          </Card>

          {/* Subscription Settings */}
          <Card className="overflow-hidden border-0 shadow-lg bg-card/50 backdrop-blur-sm animate-in slide-in-from-left-5 duration-700 delay-200">
            <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-1">
              <div className="bg-card rounded-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/10 rounded-md">
                      <DownloadCloud className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">订阅管理</CardTitle>
                      <CardDescription className="text-sm">批量导入内容源配置</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="space-y-2">
                    <Label htmlFor="subscriptionUrl" className="text-sm font-medium">订阅链接 URL</Label>
                    <div className="relative">
                      <Input
                        id="subscriptionUrl"
                        type="url"
                        value={currentSubscriptionUrlInput}
                        onChange={(e) => setCurrentSubscriptionUrlInput(e.target.value)}
                        placeholder="例如: https://example.com/sources.json"
                        disabled={isLoadingSubscription}
                        className="pr-8 h-9 text-sm focus:border-primary transition-colors"
                      />
                      {currentSubscriptionUrlInput && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        </div>
                      )}
                    </div>
                    {isClient && subscriptionUrl && (
                      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        <span>当前订阅: {subscriptionUrl}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-2 pt-0 p-4">
                  <Button 
                    onClick={handleLoadSubscription} 
                    size="sm"
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white relative overflow-hidden"
                    disabled={isLoadingSubscription}
                  >
                    {isLoadingSubscription && (
                      <div className="absolute inset-0 bg-blue-600/20">
                        <div className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                      </div>
                    )}
                    <DownloadCloud className={`mr-1.5 h-3.5 w-3.5 ${isLoadingSubscription ? 'animate-bounce' : ''}`} /> 
                    {isLoadingSubscription ? "加载中..." : "加载订阅"}
                  </Button>
                  {isClient && subscriptionUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveSubscription}
                      disabled={isLoadingSubscription}
                      className="flex-1 sm:flex-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      移除订阅
                    </Button>
                  )}
                </CardFooter>
              </div>
            </div>
          </Card>
          
          {/* Manual Source Addition */}
          <Card className="overflow-hidden border-0 shadow-lg bg-card/50 backdrop-blur-sm animate-in slide-in-from-left-5 duration-700 delay-300">
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 p-1">
              <div className="bg-card rounded-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-500/10 rounded-md">
                      <PlusCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">添加内容源</CardTitle>
                      <CardDescription className="text-sm">手动添加自定义内容源</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="sourceName" className="text-sm font-medium">源名称</Label>
                      <Input
                        id="sourceName"
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        placeholder="例如：我的电影收藏"
                        className="h-9 text-sm focus:border-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sourceUrl" className="text-sm font-medium">源 URL</Label>
                      <Input
                        id="sourceUrl"
                        type="url"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        placeholder="https://example.com/api/content.json"
                        className="h-9 text-sm focus:border-primary transition-colors"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 p-4">
                  <Button 
                    onClick={handleAddSource} 
                    size="sm"
                    className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white"
                  >
                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> 添加内容源
                  </Button>
                </CardFooter>
              </div>
            </div>
          </Card>

          {/* Sources List */}
          <Card className="overflow-hidden border-0 shadow-lg bg-card/50 backdrop-blur-sm animate-in slide-in-from-left-5 duration-700 delay-400">
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 p-1">
              <div className="bg-card rounded-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/10 rounded-md">
                      <Settings className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">内容源列表</CardTitle>
                      <CardDescription className="text-sm">
                        管理您的所有内容源 {sources.length > 0 && `(${sources.length} 个源)`}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {renderSourcesList()}
                </CardContent>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
