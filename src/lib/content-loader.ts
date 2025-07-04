
import type { ContentItem, SourceConfig, PlaybackURL, PlaybackSourceGroup, ApiCategory, PaginatedContentResponse } from '@/types';

// Mock data to be used if fetching fails or no sources are configured
const mockCategoriesRaw: ApiCategory[] = [
  { id: 'mock-cat-1', name: '热门电影 (模拟)' },
  { id: 'mock-cat-2', name: '最新剧集 (模拟)' },
  { id: 'mock-cat-3', name: '经典动漫 (模拟)' },
];

const mockContentItems: ContentItem[] = [
  {
    id: 'mock-1',
    title: '科幻巨制：星际漫游 (模拟)',
    description: '一部探索宇宙深处奥秘的史诗级科幻电影。人类面临存亡危机，勇敢的宇航员踏上未知的旅程。',
    posterUrl: 'https://placehold.co/400x600.png',
    backdropUrl: 'https://placehold.co/1280x720.png',
    cast: ['张三', '李四', '王五'],
    director: ['赵六'],
    userRating: 8.5,
    genres: ['科幻', '冒险'],
    releaseYear: 2023,
    runtime: '2h 30m',
    remarks: '超清4K',
    type: 'movie',
    availableQualities: ['1080p', '4K'],
    playbackSources: [
      {
        sourceName: '线路1 (m3u8)',
        urls: [
          { name: '第1集', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
          { name: '第2集', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
        ]
      },
      {
        sourceName: '备用线路 (m3u8)',
        urls: [
          { name: '高清版', url: 'https://stream.mux.com/b_354uRz01PBzC2pG44M01ab026r2kBCrM00.m3u8' },
        ]
      }
    ]
  },
  {
    id: 'mock-2',
    title: '都市悬疑剧：谜案追踪 (模拟)',
    description: '资深侦探揭开层层迷雾，追踪城市中离奇案件的真凶。每集一个新案件，剧情扣人心弦。',
    posterUrl: 'https://placehold.co/400x600.png',
    backdropUrl: 'https://placehold.co/1280x720.png',
    cast: ['刘能', '赵四', '谢广坤'],
    userRating: 9.0,
    genres: ['悬疑', '剧情', '犯罪'],
    releaseYear: 2024,
    remarks: '更新至12集',
    type: 'tv_show',
    availableQualities: ['1080p', '720p'],
    playbackSources: [
      {
        sourceName: '高清源 (m3u8)',
        urls: [
          { name: 'S01E01', url: 'https://stream.mux.com/T32wTkE4Ld2e022b7201201fxqIVa4cW29jI.m3u8' },
          { name: 'S01E02', url: 'https://test-streams.mux.dev/v609ms/v609ms.m3u8' },
        ]
      }
    ]
  },
];

function mapApiItemToContentItem(apiItem: any): ContentItem | null {
  if (!apiItem || !apiItem.vod_id || !apiItem.vod_name) {
    console.warn('Skipping item due to missing essential fields (vod_id, vod_name):', JSON.stringify(apiItem).substring(0,200));
    return null;
  }

  const playbackSources: PlaybackSourceGroup[] = [];
  if (apiItem.vod_play_from && apiItem.vod_play_url) {
    const sourceNames = String(apiItem.vod_play_from).split('$$$');
    const urlGroups = String(apiItem.vod_play_url).split('$$$');

    sourceNames.forEach((sourceNameRaw: string, groupIndex: number) => {
      const sourceName = sourceNameRaw.trim();
      if (urlGroups[groupIndex] && sourceName) {
        const urlsString = urlGroups[groupIndex];
        const parsedUrls: PlaybackURL[] = [];

        if (urlsString) {
            const rawEpisodes = urlsString.split('#');
            rawEpisodes.forEach((episodeStr, urlIdx) => {
                const parts = episodeStr.split('$');
                let name: string | undefined;
                let url: string | undefined;

                if (parts.length >= 2) {
                    name = parts[0]?.trim();
                    url = parts[1]?.trim();
                } else if (parts.length === 1) {
                    const singlePart = parts[0]?.trim();
                    if (singlePart && (singlePart.startsWith('http://') || singlePart.startsWith('https://') || singlePart.includes('.m3u8') || singlePart.includes('.mp4') || singlePart.includes('.mpd'))) {
                        url = singlePart;
                    }
                }
                
                if (url && !name) { // Ensure a name if URL is valid but name wasn't parsed
                    name = `播放 ${urlIdx + 1}`;
                }

                if (name && url && (url.startsWith('http://') || url.startsWith('https://') || url.includes('.m3u8') || url.includes('.mp4') || url.includes('.mpd'))) {
                    parsedUrls.push({ name, url });
                } else if (url && (url.startsWith('http://') || url.startsWith('https://') || url.includes('.m3u8') || url.includes('.mp4') || url.includes('.mpd'))){
                    // Fallback for URLs without explicit names
                    parsedUrls.push({ name: `播放 ${urlIdx + 1}`, url });
                } else {
                    // console.warn(`Skipping invalid episode string part: "${episodeStr}" in group "${sourceName}" for item "${apiItem.vod_name}"`);
                }
            });
        }

        if (parsedUrls.length > 0) {
          playbackSources.push({ sourceName, urls: parsedUrls });
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
  } else if (apiItem.tid) {
    const tid = parseInt(String(apiItem.tid), 10);
    if (!isNaN(tid) && (tid === 2 || tid === 3 || tid === 4 || (tid >= 10 && tid <= 50))) { 
      type = 'tv_show';
    }
  }

  const genres = apiItem.vod_class ? String(apiItem.vod_class).split(/[,，、\s]+/).filter(Boolean) : (apiItem.type_name ? String(apiItem.type_name).split(/[,，、\s]+/).filter(Boolean) : []);
  
  const posterUrl = apiItem.vod_pic || `https://placehold.co/400x600.png?text=${encodeURIComponent(apiItem.vod_name || 'Poster')}`;
  const backdropUrl = apiItem.vod_pic_slide || posterUrl.replace('400x600', '1280x720');


  return {
    id: String(apiItem.vod_id),
    title: apiItem.vod_name || "未知标题",
    description: apiItem.vod_blurb || apiItem.vod_content || '暂无简介',
    posterUrl: posterUrl,
    backdropUrl: backdropUrl,
    cast: apiItem.vod_actor ? String(apiItem.vod_actor).split(/[,，、\s]+/).filter(Boolean) : [],
    director: apiItem.vod_director ? String(apiItem.vod_director).split(/[,，、\s]+/).filter(Boolean) : [],
    userRating: parseFloat(apiItem.vod_douban_score) || parseFloat(apiItem.vod_score) || undefined,
    genres: genres,
    releaseYear: parseInt(String(apiItem.vod_year)) || undefined,
    runtime: apiItem.vod_duration || undefined,
    remarks: apiItem.vod_remarks || undefined,
    type: type,
    availableQualities: apiItem.vod_quality ? String(apiItem.vod_quality).split(',') : (apiItem.vod_remarks && String(apiItem.vod_remarks).match(/[0-9]+[pP]/g) ? String(apiItem.vod_remarks).match(/[0-9]+[pP]/g) : undefined),
    playbackSources: playbackSources.length > 0 ? playbackSources : undefined,
  };
}

async function fetchViaProxy(targetUrl: string, sourceName?: string): Promise<any> {
  const proxyRequestUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  // console.log(`fetchViaProxy: Requesting ${proxyRequestUrl} (for ${sourceName || 'target resource'})`);
  
  try {
    const response = await fetch(proxyRequestUrl);

    if (!response.ok) { // This means the /api/proxy call itself was not ok OR it's forwarding an error
      let errorDetails = `Status: ${response.status}`;
      let errorTextFromServer = '';
      try {
        // Proxy should return JSON error, even if it's forwarding an upstream text error in 'details'
        const errorData = await response.json();
        errorDetails = errorData.error || errorData.message || errorDetails; // errorData.error is from proxy's own error, errorData.message might be from target
        if (errorData.details) { // This 'details' comes from the proxy wrapping an upstream text error
            errorTextFromServer = String(errorData.details);
        }
      } catch (e) { /* ignore if error response is not JSON, errorDetails remains status */ }
      const errorMessage = `Error fetching from ${sourceName || 'source'} (via proxy ${proxyRequestUrl}): ${errorDetails}`;
      
      const logFn = (response.status >= 500 && response.status <= 599) ? console.warn : console.error;
      logFn(`fetchViaProxy: ${errorMessage}`, errorTextFromServer ? `\nUpstream Details: ${errorTextFromServer.substring(0, 500)}` : '');
      
      const errorToThrow = new Error(errorMessage);
      (errorToThrow as any).details = errorTextFromServer;
      throw errorToThrow;
    }
    
    const proxyResponseData = await response.json();

    if (proxyResponseData.error && !proxyResponseData.nonJsonData) {
        // console.error(`fetchViaProxy: Proxy reported an error from upstream for ${targetUrl}:`, proxyResponseData.error, "Details:", proxyResponseData.details);
        const errorToThrow = new Error(proxyResponseData.error + (proxyResponseData.details ? `: ${proxyResponseData.details}` : ''));
        (errorToThrow as any).details = proxyResponseData.details;
        throw errorToThrow;
    }

    if (typeof proxyResponseData.nonJsonData === 'string') {
      // This means the upstream API returned plain text, which the proxy forwarded.
      // It's up to the caller to decide if this is an error or expected.
      // For functions like fetchApiCategories or fetchApiContentList, they treat this as an API error.
      // console.warn(`fetchViaProxy: Proxy returned raw string (nonJsonData) for ${targetUrl}. Data: "${proxyResponseData.nonJsonData.substring(0, 200)}"`);
      throw new Error(`Target source (${sourceName || 'resource'}) returned non-JSON data: "${proxyResponseData.nonJsonData.substring(0, 100)}"`);
    }
    
    // console.log(`fetchViaProxy: Successfully received and parsed JSON data from proxy for ${sourceName || targetUrl}`);
    return proxyResponseData;

  } catch (error) {
    // This catches errors from the fetch operation to the proxy itself, 
    // or re-throws errors from the above blocks.
    // console.error(`fetchViaProxy: Exception for ${targetUrl}:`, error);
    throw error; 
  }
}


export async function fetchApiCategories(sourceUrl: string): Promise<ApiCategory[]> {
  // console.log(`fetchApiCategories: Attempting to fetch categories from ${sourceUrl}`);
  try {
    const data = await fetchViaProxy(sourceUrl, `categories from ${sourceUrl}`);
    
    if (data && Array.isArray(data.class)) {
      let categories: ApiCategory[] = data.class.map((cat: any) => ({
        id: String(cat.type_id),
        name: cat.type_name,
      })).filter((cat: ApiCategory | null): cat is ApiCategory => cat !== null && cat.id !== '' && cat.name !== '');
      
      if (!categories.some(c => c.id === 'all')) {
        // console.log("fetchApiCategories: Prepending 'All' category.");
        categories.unshift({ id: 'all', name: '全部' });
      }
      // console.log(`fetchApiCategories: Successfully fetched ${categories.length} categories from ${sourceUrl}.`);
      return categories;
    }
    // console.warn(`No 'class' array found in category data from ${sourceUrl}`, JSON.stringify(data).substring(0,200));
    return [{ id: 'all', name: '全部 (默认)' }]; 
  } catch (error) {
    // Error is already logged by fetchViaProxy if it's a network/proxy issue
    // console.error(`Failed to fetch categories from ${sourceUrl}. Error:`, error instanceof Error ? error.message : String(error));
    // Ensure 'All' category is always present, even on error.
    return [{ id: 'all', name: '全部 (错误)' }]; 
  }
}

export async function fetchApiContentList(
  sourceUrl: string,
  params: { page?: number; categoryId?: string; searchTerm?: string; ids?: string }
): Promise<PaginatedContentResponse> {
  const apiUrl = new URL(sourceUrl);
  apiUrl.searchParams.set('ac', 'detail'); 

  if (params.ids) {
    apiUrl.searchParams.set('ids', params.ids);
  } else {
    if (params.page) apiUrl.searchParams.set('pg', String(params.page));
    if (params.categoryId && params.categoryId !== 'all') apiUrl.searchParams.set('t', params.categoryId);
    if (params.searchTerm) apiUrl.searchParams.set('wd', params.searchTerm);
  }
  // console.log(`fetchApiContentList: Requesting ${apiUrl.toString()} from source ${sourceUrl} with params ${JSON.stringify(params)}`);

  try {
    const actualData = await fetchViaProxy(apiUrl.toString(), `content list/item from ${sourceUrl}`);
        
    const items = (actualData.list && Array.isArray(actualData.list))
      ? actualData.list.map(mapApiItemToContentItem).filter((item: ContentItem | null): item is ContentItem => item !== null)
      : [];
    
    const page = parseInt(String(actualData.page), 10) || 1;
    const pageCount = parseInt(String(actualData.pagecount || actualData.page_count), 10) || 1;
    const total = parseInt(String(actualData.total), 10) || (items.length > 0 ? items.length : 0); 
    const limit = parseInt(String(actualData.limit), 10) || (items.length > 0 ? items.length : 20);


    // console.log(`fetchApiContentList: Fetched ${items.length} items. Page: ${page}, PageCount: ${pageCount}, Total: ${total}, Limit: ${limit}`);
    return {
      items,
      page,
      pageCount,
      limit,
      total,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (params.searchTerm && (errorMessage.includes('暂不支持搜索') || errorMessage.includes('Target source (content list/item from') && errorMessage.includes('returned non-JSON data: "暂不支持搜索"'))) {
      console.warn(`API Search Not Supported (or returned non-JSON 'not supported' message): ${sourceUrl} (API URL: ${apiUrl.toString()}). Error: ${errorMessage}`);
    } else if (!errorMessage.includes('Error fetching from')) { 
      // Avoid double logging if fetchViaProxy already logged it.
      // Log other unexpected errors during processing *after* successful proxy fetch, or if fetchViaProxy re-throws.
      console.error(`Failed to fetch or parse content list from ${sourceUrl} (API URL: ${apiUrl.toString()}). Error:`, errorMessage);
    }
    return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 };
  }
}

export async function fetchContentItemById(sourceUrl: string, itemId: string): Promise<ContentItem | null> {
  // console.log(`fetchContentItemById: Fetching item ${itemId} from ${sourceUrl}`);
  try {
    const response = await fetchApiContentList(sourceUrl, { ids: itemId });
    if (response.items && response.items.length > 0) {
      // console.log(`fetchContentItemById: Found item ${itemId}`);
      return response.items[0];
    }
    // console.warn(`fetchContentItemById: Item with ID ${itemId} not found or error in response from ${sourceUrl}. Response items count:`, response.items?.length);
    return null;
  } catch (error) {
     // Errors would be logged by fetchApiContentList or fetchViaProxy
     return null;
  }
}


export function getMockContentItemById(id: string): ContentItem | undefined {
  return mockContentItems.find(item => item.id === id);
}

export function getMockContentItems(): ContentItem[] {
  return mockContentItems;
}

export function getMockApiCategories(): ApiCategory[] {
  const allCategory: ApiCategory = { id: 'all', name: '全部 (模拟)' };
  const hasAll = mockCategoriesRaw.some(c => c.id === 'all');
  return hasAll ? mockCategoriesRaw : [allCategory, ...mockCategoriesRaw];
}

export function getMockPaginatedResponse(page: number = 1, categoryId?: string, searchTerm?: string): PaginatedContentResponse {
  let items = mockContentItems;
  if (categoryId && categoryId !== 'all') {
      if (categoryId === 'mock-cat-1') items = items.filter(item => item.type === 'movie');
      else if (categoryId === 'mock-cat-2') items = items.filter(item => item.type === 'tv_show');
  }
  if (searchTerm) {
      items = items.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  const limit = 10; 
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
