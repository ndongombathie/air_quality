import { useState } from 'react';
import type { ArticleCategory } from '@senair/core';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { TextField } from '../../shared/ui/Field';
import { cx } from '../../shared/lib/cx';
import { ARTICLE_CATEGORY_LABELS } from '../../shared/lib/labels';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { useArticles } from './hooks';
import { ArticleCard } from './ArticleCard';

const CATEGORIES = Object.keys(ARTICLE_CATEGORY_LABELS) as ArticleCategory[];

export function ArticlesPage() {
  const [category, setCategory] = useState<ArticleCategory | null>(null);
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 300);
  const query = useArticles({ ...(category ? { category } : {}), ...(term ? { search: term } : {}), limit: 30 });

  return (
    <div className="stack">
      <PageHeader title="Actualités" description="Alertes, rapports, réglementation et sensibilisation sur la qualité de l'air à Thiès." />
      <form role="search" className="toolbar" onSubmit={(event) => event.preventDefault()}>
        <TextField label="Rechercher un article" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex. harmattan" />
      </form>
      <div className="chip-list" role="group" aria-label="Catégories">
        <button type="button" className={cx('chip', category === null && 'chip--selected')} aria-pressed={category === null} onClick={() => setCategory(null)}>
          Toutes
        </button>
        {CATEGORIES.map((id) => (
          <button key={id} type="button" className={cx('chip', category === id && 'chip--selected')} aria-pressed={category === id} onClick={() => setCategory(id)}>
            {ARTICLE_CATEGORY_LABELS[id]}
          </button>
        ))}
      </div>
      <QueryState query={query} isEmpty={(page) => page.items.length === 0} emptyMessage="Aucun article ne correspond à votre recherche.">
        {(page) => (
          <div className="article-grid">
            {page.items.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
