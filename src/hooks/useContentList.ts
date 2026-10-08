import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fetchApiContentList } from '@/lib/content-loader';
import type { PaginatedContentResponse } from '@/types';

interface UseContentListParams {
  sourceUrl: string | null;
  categoryId: string;
  searchTerm: string;
}

export function useContentList({ sourceUrl, categoryId, searchTerm }: UseContentListParams) {
  return useInfiniteQuery<PaginatedContentResponse, Error>({
    queryKey: ['contentList', sourceUrl, categoryId, searchTerm],
    queryFn: async ({ pageParam = 1, signal }) => {
      if (!sourceUrl) {
        return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 };
      }
      return fetchApiContentList(sourceUrl, {
        page: pageParam as number,
        categoryId: categoryId === 'all' ? undefined : categoryId,
        searchTerm: searchTerm || undefined,
        signal,
      });
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.pageCount) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    enabled: !!sourceUrl,
    initialPageParam: 1,
    staleTime: 1000 * 60 * 2, // 2分钟内不重复发起请求
  });
}
