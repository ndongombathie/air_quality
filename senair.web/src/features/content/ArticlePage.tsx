import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatDateTime } from '@senair/core';
import { Badge } from '../../shared/ui/Badge';
import { Markdown } from '../../shared/ui/Markdown';
import { useDocumentTitle } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { ARTICLE_CATEGORY_LABELS } from '../../shared/lib/labels';
import { ArticleGallery, coverOf } from './ArticleMedia';
import { useArticle } from './hooks';

export function ArticlePage() {
  const { slug = '' } = useParams();
  const query = useArticle(slug);
  useDocumentTitle(query.data?.title ?? 'Article');

  return (
    <div className="stack">
      <Link to="/articles" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Actualités
      </Link>
      <QueryState query={query} loadingLabel="Chargement de l'article">
        {(article) => {
          const cover = coverOf(article);
          return (
            <article className="card article">
              <p className="row">
                <Badge tone="info">{ARTICLE_CATEGORY_LABELS[article.category]}</Badge>
                {article.tags.map((tag) => (
                  <Badge key={tag}>#{tag}</Badge>
                ))}
              </p>
              <h1 className="h2">{article.title}</h1>
              <p className="muted small">
                {article.author.name} ({article.author.role}) · publié le{' '}
                <time dateTime={article.publishedAt ?? undefined}>{formatDateTime(article.publishedAt)}</time>
                {article.updatedAt !== article.publishedAt && <> · mis à jour le {formatDateTime(article.updatedAt)}</>}
              </p>
              {cover && <img className="article__cover" src={cover.url} alt={cover.alt} referrerPolicy="no-referrer" />}
              <p className="lead">{article.excerpt}</p>
              <Markdown content={article.content} />
              <ArticleGallery media={article.media} coverUrl={cover?.url ?? null} />
            </article>
          );
        }}
      </QueryState>
    </div>
  );
}
