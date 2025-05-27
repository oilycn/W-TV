
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
          { name: '第1集', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
          { name: '第2集', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
        ]
      },
      {
        sourceName: '备用线路 (mp4)',
        urls: [
          { name: '高清版', url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
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
        sourceName: '高清源 (mp4)',
        urls: [
          { name: 'S01E01', url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
          { name: 'S01E02', url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
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
                    // if name is empty but url seems valid
                    if (!name && url && (url.startsWith('http://') || url.startsWith('https://') || url.includes('.m3u8') || url.includes('.mp4'))) {
                        name = `播放 ${urlIdx + 1}`;
                    }
                } else if (parts.length === 1) {
                    const singlePart = parts[0]?.trim();
                    // Check if the single part looks like a URL
                    if (singlePart && (singlePart.startsWith('http://') || singlePart.startsWith('https://') || singlePart.includes('.m3u8') || singlePart.includes('.mp4'))) {
                        url = singlePart;
                        name = `播放 ${urlIdx + 1}`;
                    } else if (singlePart) {
                         // If it's not a URL, it might be a name with an implicit URL that was not correctly paired by '$'
                         // This case is harder to handle reliably without more context on API variations
                         // For now, we'll only proceed if we have a clear URL
                    }
                }

                if (name && url && (url.startsWith('http://') || url.startsWith('https://') || url.includes('.m3u8') || url.includes('.mp4'))) {
                    parsedUrls.push({ name, url });
                } else if (url && (url.startsWith('http://') || url.startsWith('https://') || url.includes('.m3u8') || url.includes('.mp4'))){
                    // if name is missing but url is valid
                    parsedUrls.push({ name: `播放 ${urlIdx + 1}`, url });
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
    if (!isNaN(tid) && (tid === 2 || tid === 3 || tid === 4 || (tid >= 10 && tid <= 50))) { // Common TIDs for TV shows/series/anime
      type = 'tv_show';
    }
  }


  return {
    id: String(apiItem.vod_id),
    title: apiItem.vod_name || "未知标题",
    description: apiItem.vod_blurb || apiItem.vod_content || '暂无简介',
    posterUrl: apiItem.vod_pic || `https://placehold.co/400x600.png?text=${encodeURIComponent(apiItem.vod_name || 'Poster')}`,
    backdropUrl: apiItem.vod_pic_slide || apiItem.vod_pic || `https://placehold.co/1280x720.png?text=${encodeURIComponent(apiItem.vod_name || 'Backdrop')} backdrop`,
    cast: apiItem.vod_actor ? String(apiItem.vod_actor).split(/[,，、\s]+/).filter(Boolean) : [],
    director: apiItem.vod_director ? String(apiItem.vod_director).split(/[,，、\s]+/).filter(Boolean) : [],
    userRating: parseFloat(apiItem.vod_douban_score) || parseFloat(apiItem.vod_score) || undefined,
    genres: apiItem.vod_class ? String(apiItem.vod_class).split(/[,，、\s]+/).filter(Boolean) : (apiItem.type_name ? String(apiItem.type_name).split(/[,，、\s]+/).filter(Boolean) : []),
    releaseYear: parseInt(apiItem.vod_year) || undefined,
    runtime: apiItem.vod_duration || apiItem.vod_remarks || undefined,
    type: type,
    availableQualities: apiItem.vod_quality ? String(apiItem.vod_quality).split(',') : (apiItem.vod_remarks && String(apiItem.vod_remarks).match(/[0-9]+[pP]/g) ? String(apiItem.vod_remarks).match(/[0-9]+[pP]/g) : undefined),
    playbackSources: playbackSources.length > 0 ? playbackSources : undefined,
  };
}

async function fetchViaProxy(targetUrl: string, sourceName?: string): Promise<any> {
  const proxyRequestUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
  console.log(`fetchViaProxy: Requesting ${proxyRequestUrl} (for ${sourceName || targetUrl})`);
  const response = await fetch(proxyRequestUrl);

  if (!response.ok) {
    let errorDetails = `Status: ${response.status}`;
    try {
      const errorData = await response.json();
      errorDetails = errorData.error || errorData.message || errorDetails;
      if (errorData.details) errorDetails += ` Details: ${errorData.details}`;
    } catch (e) { /* ignore if error response is not JSON */ }
    const errorMessage = `Error fetching from ${sourceName || 'source'} (via proxy ${proxyRequestUrl}): ${errorDetails}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  const data = await response.json(); // This is the JSON response *from our proxy*

  // Case 1: Our proxy signals an error it encountered (e.g., failed to fetch target)
  if (data && data.error) {
    console.error(`fetchViaProxy: Proxy itself returned an error for ${targetUrl}: ${data.error}`, data.details || '');
    throw new Error(`Proxy error for ${targetUrl}: ${data.error}. Details: ${data.details || 'N/A'}`);
  }

  // Case 2: Our proxy indicates the *target source* returned non-JSON data
  if (data && typeof data.nonJsonData === 'string') {
    console.warn(`fetchViaProxy: Target source ${sourceName || targetUrl} returned non-JSON data: "${data.nonJsonData.substring(0, 200)}"`);
    // We throw an error here so that the calling function (e.g., fetchApiContentList)
    // knows that the target source didn't provide valid JSON.
    throw new Error(`Target source (${sourceName || targetUrl}) returned non-JSON data: "${data.nonJsonData.substring(0, 200)}"`);
  }

  // Case 3: Our proxy successfully returned JSON from the target source
  console.log(`fetchViaProxy: Successfully received JSON data from proxy for ${sourceName || targetUrl}`);
  return data; // This should be the actual JSON data from the target source
}


export async function fetchApiCategories(sourceUrl: string): Promise<ApiCategory[]> {
  console.log(`fetchApiCategories: Attempting to fetch categories from ${sourceUrl}`);
  try {
    const data = await fetchViaProxy(sourceUrl, `categories from ${sourceUrl}`);
    if (data && Array.isArray(data.class)) {
      let categories: ApiCategory[] = data.class.map((cat: any) => ({
        id: String(cat.type_id),
        name: cat.type_name,
      })).filter((cat: ApiCategory | null): cat is ApiCategory => cat !== null && cat.id !== '' && cat.name !== '');
      
      if (!categories.some(c => c.id === 'all')) {
        console.log("fetchApiCategories: Prepending 'All' category.");
        categories.unshift({ id: 'all', name: '全部' });
      }
      console.log(`fetchApiCategories: Successfully fetched ${categories.length} categories from ${sourceUrl}.`);
      return categories;
    }
    console.warn(`No 'class' array found in category data from ${sourceUrl}`, data);
    return [{ id: 'all', name: '全部 (默认)' }]; 
  } catch (error) {
    console.error(`Failed to fetch categories from ${sourceUrl}. Error:`, error instanceof Error ? error.message : String(error));
    return [{ id: 'all', name: '全部 (错误)' }]; 
  }
}

export async function fetchApiContentList(
  sourceUrl: string,
  params: { page?: number; categoryId?: string; searchTerm?: string; ids?: string }
): Promise<PaginatedContentResponse> {
  const apiUrl = new URL(sourceUrl);
  apiUrl.searchParams.set('ac', 'detail'); // This is standard for these APIs

  if (params.ids) {
    apiUrl.searchParams.set('ids', params.ids);
  } else {
    // Only set page, category, search if not fetching by specific IDs
    if (params.page) apiUrl.searchParams.set('pg', String(params.page));
    if (params.categoryId && params.categoryId !== 'all') apiUrl.searchParams.set('t', params.categoryId);
    if (params.searchTerm) apiUrl.searchParams.set('wd', params.searchTerm);
  }
  console.log(`fetchApiContentList: Requesting ${apiUrl.toString()} from source ${sourceUrl} with params ${JSON.stringify(params)}`);

  try {
    const actualData = await fetchViaProxy(apiUrl.toString(), `content list/item from ${sourceUrl}`);
    
    const items = (actualData.list && Array.isArray(actualData.list))
      ? actualData.list.map(mapApiItemToContentItem).filter((item: ContentItem | null): item is ContentItem => item !== null)
      : [];
    
    console.log(`fetchApiContentList: Fetched ${items.length} items. Page: ${actualData.page}, PageCount: ${actualData.pagecount || actualData.page_count}, Total: ${actualData.total}`);
    return {
      items,
      page: parseInt(String(actualData.page), 10) || 1,
      pageCount: parseInt(String(actualData.pagecount || actualData.page_count), 10) || 1,
      limit: parseInt(String(actualData.limit), 10) || items.length || 20,
      total: parseInt(String(actualData.total), 10) || items.length || 0,
    };
  } catch (error) {
    console.error(`Failed to fetch or parse content list from ${sourceUrl} (API URL: ${apiUrl.toString()}). Error:`, error instanceof Error ? error.message : String(error));
    return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 };
  }
}

export async function fetchContentItemById(sourceUrl: string, itemId: string): Promise<ContentItem | null> {
  console.log(`fetchContentItemById: Fetching item ${itemId} from ${sourceUrl}`);
  const response = await fetchApiContentList(sourceUrl, { ids: itemId });
  if (response.items && response.items.length > 0) {
    console.log(`fetchContentItemById: Found item ${itemId}`);
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

  // For fetchAllContent, we typically want a broad overview, so just page 1 from each source
  // More specific fetching (by category, pagination, search) is handled by fetchApiContentList for the active source
  const allContentPromises = sources.map(source =>
    fetchApiContentList(source.url, { page: 1 }) 
      .then(response => response.items) // Only take items from the paginated response
      .catch(err => {
        console.error(`Error in fetchAllContent for source ${source.name} (${source.url}):`, err);
        return []; // Return empty array for this source on error
      })
  );

  try {
    const results = await Promise.all(allContentPromises);
    const combinedContent = results.flat();

    if (combinedContent.length === 0 && sources.length > 0) {
      console.warn("All sources returned no content in fetchAllContent, falling back to mock data.");
      return getMockContentItems(); // Fallback to mock if all sources fail or return nothing
    }

    // Deduplicate items by ID, preferring the first encountered version
    const uniqueContent = Array.from(new Map(combinedContent.map(item => [item.id, item])).values());
    console.log(`fetchAllContent: Combined and deduplicated content from ${sources.length} sources, resulting in ${uniqueContent.length} items.`);
    return uniqueContent;

  } catch (error) {
    // This catch might be redundant if individual promises handle their errors,
    // but it's a good safety net.
    console.error("Unexpected error during Promise.all in fetchAllContent, returning mock data.", error);
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
  const allCategory: ApiCategory = { id: 'all', name: '全部 (模拟)' };
  const hasAll = mockCategoriesRaw.some(c => c.id === 'all');
  return hasAll ? mockCategoriesRaw : [allCategory, ...mockCategoriesRaw];
}

export function getMockPaginatedResponse(page: number = 1, categoryId?: string, searchTerm?: string): PaginatedContentResponse {
  let items = mockContentItems;
  if (categoryId && categoryId !== 'all') {
      // Example filtering for mock data
      if (categoryId === 'mock-cat-1') items = items.filter(item => item.type === 'movie');
      else if (categoryId === 'mock-cat-2') items = items.filter(item => item.type === 'tv_show');
      // Add more mock category filters if needed
  }
  if (searchTerm) {
      items = items.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }
  const limit = 10; // Example limit for mock
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
