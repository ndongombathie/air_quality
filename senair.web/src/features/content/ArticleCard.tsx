import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { formatDateTime, type ArticleSummary } from '@senair/core';
import { Badge } from '../../shared/ui/Badge';
import { ARTICLE_CATEGORY_LABELS } from '../../shared/lib/labels';
import { coverOf } from './ArticleMedia';

export function ArticleCard({ article }: { article: ArticleSummary }) {
  const cover = coverOf(article);
  const hasVideo = article.media.some((item) => item.kind === 'video');
  return (
    <article className="article-card">
      {(cover || hasVideo) && (
        <div className="article-card__media">
          {cover ? (
            <img className="article-card__cover" src={cover.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
          ) : (
            <div className="article-card__placeholder" aria-hidden="true">
              <PlayCircle size={40} />
            </div>
          )}
          {hasVideo && (
            <span className="article-card__flag">
              <PlayCircle size={14} aria-hidden="true" /> Vidéo
            </span>
          )}
        </div>
      )}
      <div className="article-card__body">
        <p className="row">
          <Badge tone={article.category === 'alert' ? 'danger' : 'info'}>{ARTICLE_CATEGORY_LABELS[article.category]}</Badge>
          {article.featured && <Badge tone="success">À la une</Badge>}
        </p>
        <h2 className="article-card__title">
          <Link to={`/articles/${encodeURIComponent(article.slug)}`}>{article.title}</Link>
        </h2>
        <p className="muted">{article.excerpt}</p>
        <p className="small muted">
          {article.author.name} · <time dateTime={article.publishedAt ?? undefined}>{formatDateTime(article.publishedAt)}</time>
        </p>
      </div>
    </article>
  );
}
