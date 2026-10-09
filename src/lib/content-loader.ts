import type { ContentItem, SourceConfig, PlaybackURL, PlaybackSourceGroup, ApiCategory, PaginatedContentResponse } from '@/types';

// Centralized path for proxy and rule API routes
const PROXY_API_PATH = '/api/proxy';
const RULE_API_PATH = '/api/rule';

export function isJsRuleSource(url: string): boolean {
  if (!url) return false;
  return url.endsWith('.js') || url.includes('/rules/') || url.includes('/js/');
}

export function encodeIdIfNeeded(id: string): string {
  if (!id) return '';
  const str = String(id);
  if (str.includes('/') || str.includes('?') || str.includes('&') || str.includes(':')) {
    try {
      if (typeof window !== 'undefined') {
        return 'b64_' + btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } else {
        return 'b64_' + Buffer.from(str).toString('base64url');
      }
    } catch (_e) {
      return encodeURIComponent(str);
    }
  }
  return str;
}

export function decodeIdIfNeeded(id: string): string {
  if (!id) return '';
  const str = String(id);
  if (str.startsWith('b64_')) {
    try {
      const b64 = str.slice(4).replace(/-/g, '+').replace(/_/g, '/');
      if (typeof window !== 'undefined') {
        return decodeURIComponent(escape(atob(b64)));
      } else {
        return Buffer.from(b64, 'base64').toString('utf-8');
      }
    } catch (_e) {
      return str;
    }
  }
  return decodeURIComponent(str);
}

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
    const maxGroups = Math.max(sourceNames.length, urlGroups.length);

    for (let groupIndex = 0; groupIndex < maxGroups; groupIndex++) {
      const urlsString = urlGroups[groupIndex]?.trim();
      if (!urlsString) continue;

      let sourceName = (sourceNames[groupIndex] || '').trim();
      if (!sourceName) {
        sourceName = `线路 ${groupIndex + 1}`;
      }

      const parsedUrls: PlaybackURL[] = [];
      const rawEpisodes = urlsString.split('#');

      rawEpisodes.forEach((episodeStr, urlIdx) => {
        const trimmedEp = episodeStr.trim();
        if (!trimmedEp) return;

        const parts = trimmedEp.split('$');
        let name: string | undefined;
        let url: string | undefined;

        if (parts.length >= 2) {
          name = parts[0]?.trim();
          url = parts.slice(1).join('$').trim();
        } else if (parts.length === 1) {
          url = parts[0]?.trim();
        }

        if (!name) {
          name = `第${urlIdx + 1}集`;
        }

        if (url && url.length > 0) {
          parsedUrls.push({ name, url });
        }
      });

      if (parsedUrls.length > 0) {
        let uniqueName = sourceName;
        let dupCounter = 2;
        while (playbackSources.some(s => s.sourceName === uniqueName)) {
          uniqueName = `${sourceName} (${dupCounter})`;
          dupCounter++;
        }
        playbackSources.push({ sourceName: uniqueName, urls: parsedUrls });
      }
    }
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
  
  let posterUrl = apiItem.vod_pic || `https://placehold.co/400x600.png?text=${encodeURIComponent(apiItem.vod_name || 'Poster')}`;
  // 针对加密图片（如黄果短剧 wirqed.cn）或已知无法直接客户端加载的图片，自动转换为走本地图片代理
  if (posterUrl && (posterUrl.includes('wirqed.cn') || posterUrl.includes('huangguo'))) {
    posterUrl = `/api/proxy?url=${encodeURIComponent(posterUrl)}`;
  }
  let backdropUrl = apiItem.vod_pic_slide || posterUrl.replace('400x600', '1280x720');
  if (backdropUrl && (backdropUrl.includes('wirqed.cn') || backdropUrl.includes('huangguo')) && !backdropUrl.startsWith('/api/proxy')) {
    backdropUrl = `/api/proxy?url=${encodeURIComponent(backdropUrl)}`;
  }


  return {
    id: encodeIdIfNeeded(String(apiItem.vod_id)),
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
    availableQualities: apiItem.vod_quality
      ? String(apiItem.vod_quality).split(',')
      : (String(apiItem.vod_remarks || '').match(/[0-9]+[pP]/g) || undefined),
    playbackSources: playbackSources.length > 0 ? playbackSources : undefined,
  };
}

async function fetchViaProxy(
  targetUrl: string,
  options: { sourceName?: string; revalidate?: number; signal?: AbortSignal } = {}
): Promise<any> {
  const { sourceName, revalidate, signal } = options;
  const proxyRequestUrl = `${PROXY_API_PATH}?url=${encodeURIComponent(targetUrl)}`;
  
  try {
    const fetchOptions: RequestInit = {
      next: revalidate !== undefined ? { revalidate } : undefined,
      signal,
    };
    const response = await fetch(proxyRequestUrl, fetchOptions);

    if (!response.ok) {
      let errorDetails = `Status: ${response.status}`;
      let errorTextFromServer = '';
      try {
        const errorData = await response.json();
        errorDetails = errorData.error || errorData.message || errorDetails;
        if (errorData.details) {
            errorTextFromServer = String(errorData.details);
        }
      } catch (e) { /* ignore */ }
      const errorMessage = `Error fetching from ${sourceName || 'source'} (via proxy): ${errorDetails}`;
      
      const logFn = (response.status >= 500) ? console.warn : console.error;
      logFn(`fetchViaProxy: ${errorMessage}`, errorTextFromServer ? `\nUpstream Details: ${errorTextFromServer.substring(0, 500)}` : '');
      
      const errorToThrow = new Error(errorMessage);
      (errorToThrow as any).details = errorTextFromServer;
      throw errorToThrow;
    }
    
    const proxyResponseData = await response.json();

    if (proxyResponseData.error && !proxyResponseData.nonJsonData) {
        const errorToThrow = new Error(proxyResponseData.error + (proxyResponseData.details ? `: ${proxyResponseData.details}` : ''));
        (errorToThrow as any).details = proxyResponseData.details;
        throw errorToThrow;
    }

    if (typeof proxyResponseData.nonJsonData === 'string') {
      throw new Error(`Target source (${sourceName || 'resource'}) returned non-JSON data: "${proxyResponseData.nonJsonData.substring(0, 100)}"`);
    }
    
    return proxyResponseData;

  } catch (error) {
    throw error; 
  }
}

export async function fetchApiCategories(sourceUrl: string): Promise<ApiCategory[]> {
  try {
    let data: any;
    if (isJsRuleSource(sourceUrl)) {
      const resp = await fetch(`${RULE_API_PATH}?rule=${encodeURIComponent(sourceUrl)}&ac=home`, {
        cache: 'no-store',
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.json();
    } else {
      data = await fetchViaProxy(sourceUrl, {
        sourceName: `categories from ${sourceUrl}`,
        revalidate: 3600, // Cache categories for 1 hour
      });
    }
    
    if (data && Array.isArray(data.class)) {
      let categories: ApiCategory[] = data.class.map((cat: any) => ({
        id: String(cat.type_id),
        name: cat.type_name,
      })).filter((cat: ApiCategory | null): cat is ApiCategory => cat !== null && cat.id !== '' && cat.name !== '');
      
      if (!categories.some(c => c.id === 'all')) {
        categories.unshift({ id: 'all', name: '全部' });
      }
      return categories;
    }
    return [{ id: 'all', name: '全部 (默认)' }]; 
  } catch (error) {
    return [{ id: 'all', name: '全部 (错误)' }]; 
  }
}

export async function fetchApiContentList(
  sourceUrl: string,
  params: { page?: number; categoryId?: string; searchTerm?: string; ids?: string; signal?: AbortSignal }
): Promise<PaginatedContentResponse> {
  try {
    let actualData: any;
    const isJs = isJsRuleSource(sourceUrl);

    if (isJs) {
      const query = new URLSearchParams();
      query.set('rule', sourceUrl);

      if (params.ids) {
        query.set('ac', 'detail');
        query.set('ids', decodeIdIfNeeded(params.ids));
      } else if (params.searchTerm) {
        query.set('ac', 'search');
        query.set('wd', params.searchTerm);
        if (params.page) query.set('pg', String(params.page));
      } else {
        query.set('ac', 'list');
        if (params.categoryId && params.categoryId !== 'all') {
          query.set('t', params.categoryId);
        }
        if (params.page) query.set('pg', String(params.page));
      }

      const resp = await fetch(`${RULE_API_PATH}?${query.toString()}`, {
        signal: params.signal,
        cache: 'no-store',
      });
      if (!resp.ok) throw new Error(`Rule runner HTTP ${resp.status}`);
      actualData = await resp.json();
    } else {
      const apiUrl = new URL(sourceUrl);
      apiUrl.searchParams.set('ac', 'detail'); 

      if (params.ids) {
        apiUrl.searchParams.set('ids', decodeIdIfNeeded(params.ids));
      } else {
        if (params.page) apiUrl.searchParams.set('pg', String(params.page));
        if (params.categoryId && params.categoryId !== 'all') apiUrl.searchParams.set('t', params.categoryId);
        if (params.searchTerm) apiUrl.searchParams.set('wd', params.searchTerm);
      }

      // Cache search results and lists for a shorter duration
      const revalidateDuration = params.ids ? 86400 : 60; // 1 day for specific items, 1 minute for lists/searches
      actualData = await fetchViaProxy(apiUrl.toString(), {
        sourceName: `content list/item from ${sourceUrl}`,
        revalidate: revalidateDuration,
        signal: params.signal,
      });
    }
        
    const items = (actualData && actualData.list && Array.isArray(actualData.list))
      ? actualData.list.map(mapApiItemToContentItem).filter((item: ContentItem | null): item is ContentItem => item !== null)
      : [];
    
    const page = parseInt(String(actualData?.page || params.page || 1), 10) || 1;
    const pageCount = parseInt(String(actualData?.pagecount || actualData?.page_count || 1), 10) || 1;
    const total = parseInt(String(actualData?.total || (items.length > 0 ? items.length : 0)), 10) || (items.length > 0 ? items.length : 0); 
    const limit = parseInt(String(actualData?.limit || (items.length > 0 ? items.length : 20)), 10) || (items.length > 0 ? items.length : 20);

    return {
      items,
      page,
      pageCount,
      limit,
      total,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (params.searchTerm && (errorMessage.includes('暂不支持搜索') || errorMessage.includes('returned non-JSON data: "暂不支持搜索"'))) {
      console.warn(`API Search Not Supported: ${sourceUrl}. Error: ${errorMessage}`);
    } else if (!errorMessage.includes('Error fetching from')) { 
      console.error(`Failed to fetch or parse content list from ${sourceUrl}. Error:`, errorMessage);
    }
    return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 };
  }
}

export async function fetchContentItemById(sourceUrl: string, itemId: string): Promise<ContentItem | null> {
  try {
    const response = await fetchApiContentList(sourceUrl, { ids: itemId });
    if (response.items && response.items.length > 0) {
      return response.items[0];
    }
    return null;
  } catch (error) {
     return null;
  }
}

export async function resolvePlayUrl(
  sourceUrl: string,
  rawUrl: string,
  flag: string = ''
): Promise<{ url: string; headers?: Record<string, string>; error?: string }> {
  const isDirectMedia = /\.(m3u8|mp4|flv|webm|m4v)($|\?)/i.test(rawUrl);
  const isDownloadProtocol = /^(magnet:|thunder:|ftp:|ed2k:)/i.test(rawUrl);

  if (isDownloadProtocol) {
    return { url: rawUrl };
  }

  if (!isJsRuleSource(sourceUrl)) {
    return { url: rawUrl };
  }
  try {
    const playReqUrl = `${RULE_API_PATH}?rule=${encodeURIComponent(sourceUrl)}&ac=play&url=${encodeURIComponent(rawUrl)}&flag=${encodeURIComponent(flag)}`;
    const resp = await fetch(playReqUrl, { cache: 'no-store' });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.url && String(data.url).trim().length > 0) {
        return { url: data.url, headers: data.headers };
      }
      if (data && data.msg) {
        return { url: '', error: data.msg };
      }
    }
  } catch (err) {
    console.warn(`Failed to resolve play URL from ${sourceUrl}:`, err);
  }

  if (isDirectMedia) {
    return { url: rawUrl };
  }
  return { url: '', error: '该线路未能解析到可播放的视频流，请尝试切换线路或刷新重试' };
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
