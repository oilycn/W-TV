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
    queryFn: async ({ pageParam = 1 }) => {
      if (!sourceUrl) {
        return { items: [], page: 1, pageCount: 1, limit: 20, total: 0 };
      }
      return fetchApiContentList(sourceUrl, {
        page: pageParam as number,
        categoryId: categoryId === 'all' ? undefined : categoryId,
        searchTerm: searchTerm || undefined,
      });
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.pageCount) {
        return lastPage.page + 1;
      }
      return undefined;
    },
    enabled: !!sourceUrl, // Only run the query if sourceUrl is present
    initialPageParam: 1,
  });
}
