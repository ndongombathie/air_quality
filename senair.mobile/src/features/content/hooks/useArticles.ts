import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ArticleCategory, ArticleQuery } from '@senair/core';
import { useApi } from '@/shared/api/AppProviders';
import { queryKeys } from '@/shared/api/queryKeys';

export function useArticles(category: ArticleCategory | null) {
  const api = useApi();
  const query: ArticleQuery = { limit: 10, ...(category ? { category } : {}) };
  return useInfiniteQuery({
    queryKey: queryKeys.articles.list(query),
    queryFn: ({ pageParam }) => api.articles.list({ ...query, cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Article « À la une » le plus récent. */
export function useFeaturedArticle() {
  const api = useApi();
  const query: ArticleQuery = { featured: true, limit: 1 };
  return useQuery({
    queryKey: queryKeys.articles.list(query),
    queryFn: async () => (await api.articles.list(query)).items[0] ?? null,
  });
}

export function useArticle(slug: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.articles.detail(slug),
    queryFn: () => api.articles.getBySlug(slug),
    enabled: slug.length > 0,
  });
}
