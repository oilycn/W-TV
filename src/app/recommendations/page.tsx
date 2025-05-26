"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { contentRecommendations, ContentRecommendationsInput } from '@/ai/flows/content-recommendations';
import { Loader2, Wand2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const VIEWING_HISTORY_KEY = 'cinemaViewViewingHistory';
const PREFERENCES_KEY = 'cinemaViewPreferences';

export default function RecommendationsPage() {
  const [viewingHistory, setViewingHistory] = useLocalStorage(VIEWING_HISTORY_KEY, '例如：观看了《星际穿越》（科幻，评分5/5），《盗梦空间》（科幻，评分5/5），不喜欢《爱情公寓》（喜剧）。');
  const [preferences, setPreferences] = useLocalStorage(PREFERENCES_KEY, '例如：喜欢诺兰导演的电影，偏好硬科幻和悬疑类型，不喜欢纯喜剧。');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!viewingHistory.trim() || !preferences.trim()) {
      toast({
        title: "输入错误",
        description: "观看历史和偏好不能为空。",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setRecommendations([]);
    try {
      const input: ContentRecommendationsInput = {
        viewingHistory,
        preferences,
      };
      const result = await contentRecommendations(input);
      if (result && result.recommendations) {
        setRecommendations(result.recommendations);
        if (result.recommendations.length === 0) {
          toast({
            title: "暂无推荐",
            description: "根据您的输入，目前没有合适的推荐。",
          });
        }
      } else {
        throw new Error("AI未能返回有效的推荐结果。");
      }
    } catch (error) {
      console.error("Error getting recommendations:", error);
      toast({
        title: "推荐失败",
        description: `获取AI推荐时发生错误：${error instanceof Error ? error.message : '未知错误'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-2 text-foreground">AI 内容推荐</h1>
      <p className="text-muted-foreground mb-8">
        根据您的观看历史和偏好，让AI为您推荐可能感兴趣的电影和电视剧。
      </p>

      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle>输入您的信息</CardTitle>
          <CardDescription>提供您的观看历史和偏好，以便AI更好地为您推荐。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="viewingHistory" className="text-lg">观看历史</Label>
            <Textarea
              id="viewingHistory"
              value={viewingHistory}
              onChange={(e) => setViewingHistory(e.target.value)}
              placeholder="例如：最近观看了《沙丘》（科幻，评分4/5），《鱿鱼游戏》（韩剧、惊悚，评分5/5）。"
              rows={5}
              className="text-base"
            />
             <p className="text-xs text-muted-foreground">提示：描述越详细，推荐结果越精准。</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferences" className="text-lg">个人偏好</Label>
            <Textarea
              id="preferences"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="例如：喜欢科幻、悬疑和剧情片。偏爱有深度思考的电影。不喜欢恐怖片。"
              rows={5}
              className="text-base"
            />
            <p className="text-xs text-muted-foreground">提示：可以包括喜欢的类型、导演、演员，或者不喜欢的元素。</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-6 py-3">
            {isLoading ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-5 w-5" />
            )}
            获取推荐
          </Button>
        </CardFooter>
      </Card>

      {recommendations.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl">为您推荐</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="text-lg text-foreground/90">{rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
