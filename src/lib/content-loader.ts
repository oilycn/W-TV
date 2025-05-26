import type { ContentItem, SourceConfig } from '@/types';

// Mock data to be used if fetching fails or no sources are configured
const mockContentItems: ContentItem[] = [
  {
    id: '1',
    title: '科幻巨制：星际漫游',
    description: '一部探索宇宙深处奥秘的史诗级科幻电影。人类面临存亡危机，勇敢的宇航员踏上未知的旅程。',
    posterUrl: 'https://placehold.co/400x600.png?text=星际漫游',
    backdropUrl: 'https://placehold.co/1280x720.png?text=星际漫游背景',
    cast: ['张三', '李四', '王五'],
    director: ['赵六'],
    userRating: 8.5,
    genres: ['科幻', '冒险'],
    releaseYear: 2023,
    runtime: '2h 30m',
    type: 'movie',
    availableQualities: ['1080p', '4K'],
  },
  {
    id: '2',
    title: '都市悬疑剧：谜案追踪',
    description: '资深侦探揭开层层迷雾，追踪城市中离奇案件的真凶。每集一个新案件，剧情扣人心弦。',
    posterUrl: 'https://placehold.co/400x600.png?text=谜案追踪',
    backdropUrl: 'https://placehold.co/1280x720.png?text=谜案追踪背景',
    cast: ['刘能', '赵四', '谢广坤'],
    userRating: 9.0,
    genres: ['悬疑', '剧情', '犯罪'],
    releaseYear: 2024,
    type: 'tv_show',
    availableQualities: ['1080p', '720p'],
  },
  {
    id: '3',
    title: '奇幻史诗：龙之谷',
    description: '古老的预言成真，巨龙苏醒，英勇的骑士与魔法师联手保卫家园。',
    posterUrl: 'https://placehold.co/400x600.png?text=龙之谷',
    cast: ['小明', '小红'],
    userRating: 7.8,
    genres: ['奇幻', '动作'],
    releaseYear: 2022,
    runtime: '2h 15m',
    type: 'movie',
    availableQualities: ['1080p'],
  },
  {
    id: '4',
    title: '温馨喜剧：邻里一家亲',
    description: '讲述一个充满欢声笑语的社区中，几个家庭之间发生的温馨日常故事。',
    posterUrl: 'https://placehold.co/400x600.png?text=邻里一家亲',
    cast: ['宋丹丹', '高亚麟'],
    userRating: 8.2,
    genres: ['喜剧', '家庭'],
    releaseYear: 2023,
    type: 'tv_show',
    availableQualities: ['720p'],
  },
];

export async function fetchContentFromSource(source: SourceConfig): Promise<ContentItem[]> {
  try {
    const response = await fetch(source.url);
    if (!response.ok) {
      console.error(`Error fetching from ${source.name} (${source.url}): ${response.statusText}`);
      return []; // Return empty array on error
    }
    // This assumes the source URL returns a JSON array of ContentItem
    const data = await response.json();
    if (Array.isArray(data)) {
      // Basic validation (can be more thorough)
      return data.filter(item => item.id && item.title && item.posterUrl) as ContentItem[];
    }
    console.error(`Invalid data format from ${source.name} (${source.url})`);
    return [];
  } catch (error) {
    console.error(`Exception fetching from ${source.name} (${source.url}):`, error);
    return []; // Return empty array on exception
  }
}

export async function fetchAllContent(sources: SourceConfig[]): Promise<ContentItem[]> {
  if (!sources || sources.length === 0) {
    return mockContentItems; // Return mock data if no sources configured
  }

  const allContentPromises = sources.map(source => fetchContentFromSource(source));
  const results = await Promise.all(allContentPromises);
  
  // Flatten array and remove duplicates by id
  const combinedContent = results.flat();
  const uniqueContent = Array.from(new Map(combinedContent.map(item => [item.id, item])).values());
  
  return uniqueContent.length > 0 ? uniqueContent : mockContentItems; // Fallback to mock if all sources fail or return empty
}

export function getMockContentItemById(id: string): ContentItem | undefined {
  return mockContentItems.find(item => item.id === id);
}

export function getMockContentItems(): ContentItem[] {
  return mockContentItems;
}

// Add data-ai-hint to mock data posterUrls programmatically for existing items
mockContentItems.forEach(item => {
  let hint = "";
  if (item.genres && item.genres.length > 0) {
    hint = item.genres.slice(0, 2).join(" ").toLowerCase();
  } else {
    hint = item.title.split(" ")[0].toLowerCase();
  }
  // This is a conceptual update. Actual posterUrl should be updated if it was just a placeholder.
  // For placehold.co, we can't add data-ai-hint directly to URL, so this is more for future image components.
  // The ContentCard component will handle adding data-ai-hint attribute if posterUrl is from placehold.co.
});
