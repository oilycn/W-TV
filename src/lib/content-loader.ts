
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
  if (!apiItem || !apiItem.vod_id || !apiItem.vod_name) { 
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
  const typeNameStr = String(apiItem.type_name || apiItem.vod_class || '').toLowerCase();
  if (typeNameStr) {
    if (typeNameStr.includes('剧') || typeNameStr.includes('电视剧') || typeNameStr.includes('动漫') || typeNameStr.includes('综艺') || typeNameStr.includes('series') || typeNameStr.includes('show') || typeNameStr.includes('animation') || typeNameStr.includes('anime')) {
      type = 'tv_show';
    }
  } else if (apiItem.tid) { // Fallback to tid if type_name is not conclusive
    const tid = parseInt(String(apiItem.tid), 10);
    // Common TIDs for TV shows-like content (often includes movies as 1, TV as 2, Anime as 3, Variety as 4)
    if (tid === 2 || tid === 3 || tid === 4) { 
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
    genres: apiItem.type_name || apiItem.vod_class ? String(apiItem.type_name || apiItem.vod_class).split(/[,，、\s]+/).filter(Boolean) : [],
    releaseYear: parseInt(apiItem.vod_year) || undefined,
    runtime: apiItem.vod_duration || apiItem.vod_remarks || undefined, // vod_remarks often contains episode count or quality
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

  const textData = await response.text();
  const contentType = response.headers.get('content-type');

  try {
    const jsonData = JSON.parse(textData);
    return jsonData;
  } catch (jsonError) {
    if (contentType && contentType.toLowerCase().includes('application/json')) {
      console.error(`Proxy: Failed to parse JSON from ${targetUrl} even though Content-Type was ${contentType}. Data: ${textData.substring(0,200)}...`);
      throw new Error('Failed to parse JSON response from target');
    }
    console.warn(`Proxy: Response from ${targetUrl} was not parseable as JSON (Content-Type: ${contentType}). Returning as nonJsonData object. Data: ${textData.substring(0,100)}...`);
    // This case should ideally be handled by the caller if it truly expects non-JSON.
    // For this app, most API endpoints are expected to be JSON.
    // Returning an object that signals non-JSON can be one way, or throwing an error.
    // Given the previous error, throwing might be better if JSON is strictly expected.
    // throw new Error(`Proxy received non-JSON data: ${textData.substring(0,100)}`);
    // Let's stick to the previous behavior of returning an object with nonJsonData for now, caller handles it.
     return { nonJsonData: textData };
  }
}

export async function fetchApiCategories(sourceUrl: string): Promise<ApiCategory[]> {
  try {
    const data = await fetchViaProxy(sourceUrl, `categories from ${sourceUrl}`);
    if (data && data.nonJsonData) { // Check if proxy flagged it as non-JSON
        console.warn(`fetchApiCategories: Received nonJsonData from proxy for ${sourceUrl}. Attempting to parse anyway if it looks like JSON in a string.`);
        // Attempt to parse if it's a string that might contain JSON
        if (typeof data.nonJsonData === 'string') {
            try {
                const parsedNonJsonData = JSON.parse(data.nonJsonData);
                if (parsedNonJsonData && Array.isArray(parsedNonJsonData.class)) {
                     return parsedNonJsonData.class.map((cat: any) => ({
                        id: String(cat.type_id),
                        name: cat.type_name,
                    })).filter((cat: ApiCategory | null): cat is ApiCategory => cat !== null && cat.id !== '' && cat.name !== '');
                }
            } catch (e) {
                console.error(`fetchApiCategories: Failed to parse nonJsonData string as JSON from ${sourceUrl}:`, e);
                return []; // Return empty on parse failure of nonJsonData
            }
        }
        return []; // If nonJsonData isn't a string or doesn't parse/fit structure
    }
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
  params: { page?: number; categoryId?: string; searchTerm?: string; ids?: string }
): Promise<PaginatedContentResponse> {
  const apiUrl = new URL(sourceUrl);
  apiUrl.searchParams.set('ac', 'detail'); // Always use 'detail' for list/item fetching

  if (params.ids) {
    apiUrl.searchParams.set('ids', params.ids);
  } else {
    if (params.page) apiUrl.searchParams.set('pg', String(params.page));
    if (params.categoryId && params.categoryId !== 'all') apiUrl.searchParams.set('t', params.categoryId);
    if (params.searchTerm) apiUrl.searchParams.set('wd', params.searchTerm);
  }

  try {
    const data = await fetchViaProxy(apiUrl.toString(), `content list/item from ${sourceUrl}`);
    
    let actualData = data;
    if (data && data.nonJsonData) { 
        console.warn(`fetchApiContentList: Received nonJsonData from proxy for ${apiUrl.toString()}. Attempting to parse.`);
        if (typeof data.nonJsonData === 'string') {
            try {
                actualData = JSON.parse(data.nonJsonData);
            } catch (e) {
                console.error(`fetchApiContentList: Failed to parse nonJsonData string as JSON from ${apiUrl.toString()}:`, e);
                return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 };
            }
        } else {
           return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 };
        }
    }

    const items = (actualData.list && Array.isArray(actualData.list))
      ? actualData.list.map(mapApiItemToContentItem).filter((item: ContentItem | null): item is ContentItem => item !== null)
      : [];
    
    return {
      items,
      page: parseInt(String(actualData.page), 10) || 1,
      pageCount: parseInt(String(actualData.pagecount), 10) || 1,
      limit: parseInt(String(actualData.limit), 10) || items.length || 20, 
      total: parseInt(String(actualData.total), 10) || items.length || 0, 
    };
  } catch (error) {
    console.error(`Failed to fetch content list from ${sourceUrl} with params ${JSON.stringify(params)}:`, error);
    return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 }; 
  }
}

export async function fetchContentItemById(sourceUrl: string, itemId: string): Promise<ContentItem | null> {
  const response = await fetchApiContentList(sourceUrl, { ids: itemId });
  if (response.items && response.items.length > 0) {
    return response.items[0];
  }
  console.warn(`fetchContentItemById: Item with ID ${itemId} not found or error in response from ${sourceUrl}. Response items:`, response.items);
  return null;
}


export async function fetchAllContent(sources: SourceConfig[]): Promise<ContentItem[]> {
  if (!sources || sources.length === 0) {
    console.warn("No sources configured for fetchAllContent, returning mock data.");
    return getMockContentItems();
  }

  const allContentPromises = sources.map(source => 
    fetchApiContentList(source.url, { page: 1 }) 
      .then(response => response.items)
      .catch(err => {
        console.error(`Error in fetchAllContent for source ${source.name}:`, err);
        return []; 
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
  if (categoryId && categoryId !== 'all' && categoryId !== '1') { 
      items = items.filter(item => item.type === (categoryId === '2' ? 'tv_show' : 'movie'));
  }
  if (searchTerm) {
      items = items.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  const limit = 2; 
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

