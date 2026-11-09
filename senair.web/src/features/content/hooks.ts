import { useQuery } from '@tanstack/react-query';
import type { ArticleQuery } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';

export function useArticles(query: ArticleQuery) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.articles.list(query),
    queryFn: () => api.articles.list(query),
  });
}

export function useArticle(slug: string) {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.articles.detail(slug),
    queryFn: () => api.articles.getBySlug(slug),
  });
}
