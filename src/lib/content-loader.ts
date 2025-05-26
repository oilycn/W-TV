
import type { ContentItem, SourceConfig, PlaybackURL, PlaybackSourceGroup, ApiCategory, PaginatedContentResponse } from '@/types';

// Mock data to be used if fetching fails or no sources are configured
const mockCategories: ApiCategory[] = [
  { id: '1', name: '电影 (模拟)' },
  { id: '2', name: '电视剧 (模拟)' },
  { id: '3', name: '动漫 (模拟)' },
];

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
  if (!apiItem || !apiItem.vod_id || !apiItem.vod_name) { // vod_pic can be optional for robustness
    console.warn('Skipping item due to missing essential fields (vod_id, vod_name):', apiItem);
    return null;
  }

  const playbackSources: PlaybackSourceGroup[] = [];
  if (apiItem.vod_play_from && apiItem.vod_play_url) {
    const sourceNames = String(apiItem.vod_play_from).split('$$$');
    const urlGroups = String(apiItem.vod_play_url).split('$$$');

    sourceNames.forEach((sourceName: string, index: number) => {
      if (urlGroups[index]) {
        const urls: PlaybackURL[] = urlGroups[index]
          .split('#')
          .map((episode: string) => {
            const parts = episode.split('$');
            return parts.length === 2 ? { name: parts[0] || `Ep ${index+1}`, url: parts[1] } : null;
          })
          .filter((u: PlaybackURL | null): u is PlaybackURL => u !== null && u.url !== '');
        
        if (urls.length > 0) {
          playbackSources.push({ sourceName, urls });
        }
      }
    });
  }
  
  let type: 'movie' | 'tv_show' = 'movie';
  const typeNameStr = String(apiItem.type_name || '').toLowerCase();
  if (typeNameStr) {
    if (typeNameStr.includes('剧') || typeNameStr.includes('电视剧') || typeNameStr.includes('动漫') || typeNameStr.includes('综艺') || typeNameStr.includes('series') || typeNameStr.includes('show')) {
      type = 'tv_show';
    }
  } else if (apiItem.tid) {
    const tid = parseInt(String(apiItem.tid), 10);
    if (tid === 2 || tid === 3 || tid === 4) { // Common TIDs for TV shows, anime, variety
      type = 'tv_show';
    }
  }


  return {
    id: String(apiItem.vod_id),
    title: apiItem.vod_name,
    description: apiItem.vod_blurb || apiItem.vod_content || '暂无简介',
    posterUrl: apiItem.vod_pic || `https://placehold.co/400x600.png?text=${encodeURIComponent(apiItem.vod_name)}`,
    backdropUrl: apiItem.vod_pic_slide || apiItem.vod_pic || `https://placehold.co/1280x720.png?text=${encodeURIComponent(apiItem.vod_name)} backdrop`,
    cast: apiItem.vod_actor ? String(apiItem.vod_actor).split(/[,，、\s]+/).filter(Boolean) : [],
    director: apiItem.vod_director ? String(apiItem.vod_director).split(/[,，、\s]+/).filter(Boolean) : [],
    userRating: parseFloat(apiItem.vod_douban_score) || parseFloat(apiItem.vod_score) || undefined,
    genres: apiItem.type_name ? String(apiItem.type_name).split(/[,，、\s]+/).filter(Boolean) : [],
    releaseYear: parseInt(apiItem.vod_year) || undefined,
    runtime: apiItem.vod_duration || undefined,
    type: type,
    availableQualities: apiItem.vod_quality ? String(apiItem.vod_quality).split(',') : (apiItem.vod_remarks && String(apiItem.vod_remarks).match(/[0-9]+[pP]/g) ? String(apiItem.vod_remarks).match(/[0-9]+[pP]/g) : undefined),
    playbackSources: playbackSources.length > 0 ? playbackSources : undefined,
  };
}

async function fetchViaProxy(targetUrl: string, sourceName?: string): Promise<any> {
  const proxyRequestUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  const response = await fetch(proxyRequestUrl);

  if (!response.ok) {
    let errorDetails = `Status: ${response.status}`;
    try {
      const errorJson = await response.json();
      errorDetails = errorJson.error || errorJson.message || errorDetails;
    } catch (e) { /* ignore */ }
    const errorMessage = `Error fetching from ${sourceName || 'source'} (via proxy ${proxyRequestUrl}): ${errorDetails}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (data && data.nonJsonData) {
    const errorMessage = `Proxy returned non-JSON data for ${sourceName || 'source'} (${proxyRequestUrl}): ${data.nonJsonData.substring(0,100)}...`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  return data;
}

export async function fetchApiCategories(sourceUrl: string): Promise<ApiCategory[]> {
  try {
    const data = await fetchViaProxy(sourceUrl, `categories from ${sourceUrl}`);
    if (data && Array.isArray(data.class)) {
      return data.class.map((cat: any) => ({
        id: String(cat.type_id),
        name: cat.type_name,
      })).filter((cat: ApiCategory | null): cat is ApiCategory => cat !== null && cat.id !== '' && cat.name !== '');
    }
    console.warn(`No 'class' array found in category data from ${sourceUrl}`, data);
    return [];
  } catch (error) {
    console.error(`Failed to fetch categories from ${sourceUrl}:`, error);
    return [];
  }
}

export async function fetchApiContentList(
  sourceUrl: string,
  params: { page?: number; categoryId?: string; searchTerm?: string }
): Promise<PaginatedContentResponse> {
  const apiUrl = new URL(sourceUrl);
  apiUrl.searchParams.set('ac', 'detail');
  if (params.page) apiUrl.searchParams.set('pg', String(params.page));
  if (params.categoryId && params.categoryId !== 'all') apiUrl.searchParams.set('t', params.categoryId);
  if (params.searchTerm) apiUrl.searchParams.set('wd', params.searchTerm);

  try {
    const data = await fetchViaProxy(apiUrl.toString(), `content list from ${sourceUrl}`);
    const items = (data.list && Array.isArray(data.list))
      ? data.list.map(mapApiItemToContentItem).filter((item: ContentItem | null): item is ContentItem => item !== null)
      : [];
    
    return {
      items,
      page: parseInt(String(data.page), 10) || 1,
      pageCount: parseInt(String(data.pagecount), 10) || 1,
      limit: parseInt(String(data.limit), 10) || 20, // Default limit if not provided
      total: parseInt(String(data.total), 10) || 0,
    };
  } catch (error) {
    console.error(`Failed to fetch content list from ${sourceUrl} with params ${JSON.stringify(params)}:`, error);
    return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 }; // Return empty valid structure
  }
}


// --- Potentially keep or adapt old fetchAllContent if a global, non-categorized view is needed ---
// For now, we assume HomePage will use the new category-focused fetching from a single source.
// The old fetchContentFromSource is effectively replaced by fetchApiContentList
export async function fetchAllContent(sources: SourceConfig[]): Promise<ContentItem[]> {
  if (!sources || sources.length === 0) {
    console.warn("No sources configured for fetchAllContent, returning mock data.");
    return getMockContentItems();
  }

  // This function might need rethinking. For now, it fetches page 1 from all sources.
  const allContentPromises = sources.map(source => 
    fetchApiContentList(source.url, { page: 1 })
      .then(response => response.items)
      .catch(err => {
        console.error(`Error in fetchAllContent for source ${source.name}:`, err);
        return []; // return empty array for this source on error
      })
  );
  
  try {
    const results = await Promise.all(allContentPromises);
    const combinedContent = results.flat();
    
    if (combinedContent.length === 0 && sources.length > 0) {
      console.warn("All sources returned no content in fetchAllContent, falling back to mock data.");
      return getMockContentItems();
    }
    
    const uniqueContent = Array.from(new Map(combinedContent.map(item => [item.id, item])).values());
    return uniqueContent;

  } catch (error) {
    console.error("Error fetching content from one or more sources in fetchAllContent, returning mock data.", error);
    return getMockContentItems();
  }
}


export function getMockContentItemById(id: string): ContentItem | undefined {
  return mockContentItems.find(item => item.id === id);
}

export function getMockContentItems(): ContentItem[] {
  return mockContentItems;
}

export function getMockApiCategories(): ApiCategory[] {
  return mockCategories;
}

export function getMockPaginatedResponse(page: number = 1, categoryId?: string, searchTerm?: string): PaginatedContentResponse {
  let items = mockContentItems;
  if (categoryId && categoryId !== 'all' && categoryId !== '1') { // mock category '1' is movie
      items = items.filter(item => item.type === (categoryId === '2' ? 'tv_show' : 'movie'));
  }
  if (searchTerm) {
      items = items.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  const limit = 2; // Mock limit
  const total = items.length;
  const pageCount = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  
  return {
    items: items.slice(startIndex, startIndex + limit),
    page,
    pageCount,
    limit,
    total,
  };
}
