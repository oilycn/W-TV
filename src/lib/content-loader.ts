
import type { ContentItem, SourceConfig, PlaybackURL, PlaybackSourceGroup } from '@/types';

// Mock data to be used if fetching fails or no sources are configured
const mockContentItems: ContentItem[] = [
  {
    id: 'mock-1',
    title: '科幻巨制：星际漫游 (模拟)',
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
    playbackSources: [
      {
        sourceName: '线路1 (m3u8)',
        urls: [
          { name: '第1集', url: 'https://example.com/play/1' },
          { name: '第2集', url: 'https://example.com/play/2' },
        ]
      }
    ]
  },
  {
    id: 'mock-2',
    title: '都市悬疑剧：谜案追踪 (模拟)',
    description: '资深侦探揭开层层迷雾，追踪城市中离奇案件的真凶。每集一个新案件，剧情扣人心弦。',
    posterUrl: 'https://placehold.co/400x600.png?text=谜案追踪',
    backdropUrl: 'https://placehold.co/1280x720.png?text=谜案追踪背景',
    cast: ['刘能', '赵四', '谢广坤'],
    userRating: 9.0,
    genres: ['悬疑', '剧情', '犯罪'],
    releaseYear: 2024,
    type: 'tv_show',
    availableQualities: ['1080p', '720p'],
    playbackSources: [
      {
        sourceName: '高清源',
        urls: [
          { name: 'S01E01', url: 'https://example.com/play/s1e1' },
          { name: 'S01E02', url: 'https://example.com/play/s1e2' },
        ]
      }
    ]
  },
];

function mapApiItemToContentItem(apiItem: any): ContentItem | null {
  if (!apiItem || !apiItem.vod_id || !apiItem.vod_name || !apiItem.vod_pic) {
    return null;
  }

  const playbackSources: PlaybackSourceGroup[] = [];
  if (apiItem.vod_play_from && apiItem.vod_play_url) {
    const sourceNames = apiItem.vod_play_from.split('$$$');
    const urlGroups = apiItem.vod_play_url.split('$$$');

    sourceNames.forEach((sourceName: string, index: number) => {
      if (urlGroups[index]) {
        const urls: PlaybackURL[] = urlGroups[index]
          .split('#')
          .map((episode: string) => {
            const parts = episode.split('$');
            return parts.length === 2 ? { name: parts[0], url: parts[1] } : null;
          })
          .filter((u: PlaybackURL | null): u is PlaybackURL => u !== null);
        
        if (urls.length > 0) {
          playbackSources.push({ sourceName, urls });
        }
      }
    });
  }
  
  let type: 'movie' | 'tv_show' = 'movie'; // Default to movie
  if (apiItem.type_name && typeof apiItem.type_name === 'string') {
    if (apiItem.type_name.includes('剧') || apiItem.type_name.includes('电视剧') || apiItem.type_name.includes('动漫') || apiItem.type_name.includes('综艺')) {
      type = 'tv_show';
    }
  } else if (apiItem.tid) { // Fallback for some APIs that use tid for type
     // Common TIDs: 1=电影, 2=电视剧, 3=综艺, 4=动漫. This can vary by API.
    if (apiItem.tid === 2 || apiItem.tid === 3 || apiItem.tid === 4 || 
        (typeof apiItem.type_name === 'string' && (apiItem.type_name.toLowerCase().includes('series') || apiItem.type_name.toLowerCase().includes('show')))) {
      type = 'tv_show';
    }
  }


  return {
    id: String(apiItem.vod_id),
    title: apiItem.vod_name,
    description: apiItem.vod_blurb || apiItem.vod_content || '暂无简介',
    posterUrl: apiItem.vod_pic,
    backdropUrl: apiItem.vod_pic_slide || apiItem.vod_pic, // Use poster if backdrop not available
    cast: apiItem.vod_actor ? apiItem.vod_actor.split(/[,，、\s]+/).filter(Boolean) : [],
    director: apiItem.vod_director ? apiItem.vod_director.split(/[,，、\s]+/).filter(Boolean) : [],
    userRating: parseFloat(apiItem.vod_douban_score) || parseFloat(apiItem.vod_score) || undefined,
    genres: apiItem.type_name ? apiItem.type_name.split(/[,，、\s]+/).filter(Boolean) : [],
    releaseYear: parseInt(apiItem.vod_year) || undefined,
    runtime: apiItem.vod_duration || undefined,
    type: type,
    availableQualities: apiItem.vod_quality ? apiItem.vod_quality.split(',') : (apiItem.vod_remarks && apiItem.vod_remarks.match(/[0-9]+[pP]/g) ? apiItem.vod_remarks.match(/[0-9]+[pP]/g) : undefined),
    playbackSources: playbackSources.length > 0 ? playbackSources : undefined,
  };
}


export async function fetchContentFromSource(source: SourceConfig): Promise<ContentItem[]> {
  try {
    const apiUrl = new URL(source.url);
    apiUrl.searchParams.set('ac', 'detail');
    // Page is usually managed by the API or could be a parameter later.
    // For now, we fetch the default first page from the source.
    // apiUrl.searchParams.set('pg', '1'); 

    const fullTargetUrl = apiUrl.toString();
    // Use the Next.js API proxy route
    const proxyRequestUrl = `/api/proxy?url=${encodeURIComponent(fullTargetUrl)}`;
    
    const response = await fetch(proxyRequestUrl);

    if (!response.ok) {
      let errorDetails = `Status: ${response.status}`;
      try {
        // Attempt to parse error from proxy response
        const errorJson = await response.json();
        errorDetails = errorJson.error || errorJson.message || errorDetails;
      } catch (e) { /* ignore if error response is not json */ }
      console.error(`Error fetching from ${source.name} (via proxy ${proxyRequestUrl}): ${errorDetails}`);
      return [];
    }

    const data = await response.json();

    if (data && data.list && Array.isArray(data.list)) {
      return data.list.map((item: any) => mapApiItemToContentItem(item)).filter((item: ContentItem | null): item is ContentItem => item !== null);
    } else if (data && data.nonJsonData) {
      // Handle case where proxy returned non-JSON data
      console.error(`Proxy returned non-JSON data for ${source.name} (${proxyRequestUrl}): ${data.nonJsonData.substring(0,100)}...`);
      return [];
    }
     else {
      console.error(`Invalid data format from ${source.name} (via proxy ${proxyRequestUrl}). Expected 'list' array. Got:`, data);
      return [];
    }
  } catch (error) {
    console.error(`Exception fetching from ${source.name} (${source.url}) using proxy:`, error);
    return [];
  }
}

export async function fetchAllContent(sources: SourceConfig[]): Promise<ContentItem[]> {
  if (!sources || sources.length === 0) {
    console.warn("No sources configured, returning mock data.");
    return getMockContentItems();
  }

  const allContentPromises = sources.map(source => fetchContentFromSource(source));
  
  try {
    const results = await Promise.all(allContentPromises);
    const combinedContent = results.flat();
    
    if (combinedContent.length === 0) {
      console.warn("All sources returned no content, falling back to mock data.");
      return getMockContentItems();
    }
    
    // Remove duplicates by id, preferring the first encountered version
    const uniqueContent = Array.from(new Map(combinedContent.map(item => [item.id, item])).values());
    return uniqueContent;

  } catch (error) {
    console.error("Error fetching content from one or more sources, returning mock data.", error);
    return getMockContentItems();
  }
}


export function getMockContentItemById(id: string): ContentItem | undefined {
  return mockContentItems.find(item => item.id === id);
}

export function getMockContentItems(): ContentItem[] {
  // Ensure mock items have placeholder data-ai-hint conceptually
  return mockContentItems.map(item => ({
    ...item,
    // posterUrl: item.posterUrl.startsWith('https://placehold.co') ? `${item.posterUrl}&text=${encodeURIComponent(item.title)}` : item.posterUrl,
    // backdropUrl: item.backdropUrl?.startsWith('https://placehold.co') ? `${item.backdropUrl}&text=${encodeURIComponent(item.title + ' backdrop')}` : item.backdropUrl,
  }));
}
