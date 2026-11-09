import type { MediaAsset } from '@senair/core';
import { safeMediaUrl } from '../../shared/lib/labels';

/** Couverture : URL fournie par l'API, sinon la première photo de l'article. */
export function coverOf(article: { coverImageUrl: string | null; media: readonly MediaAsset[] }): { url: string; alt: string } | null {
  const firstPhoto = article.media.find((item) => item.kind === 'image' && safeMediaUrl(item.url));
  const url = safeMediaUrl(article.coverImageUrl) ?? (firstPhoto ? safeMediaUrl(firstPhoto.url) : null);
  if (!url) return null;
  const match = article.media.find((item) => item.url === url);
  return { url, alt: match?.alt ?? '' };
}

export function MediaVideo({ asset }: { asset: MediaAsset }) {
  const url = safeMediaUrl(asset.url);
  if (!url) return null;
  return (
    <figure className="media-figure">
      <video controls preload="metadata" playsInline poster={safeMediaUrl(asset.posterUrl) ?? undefined} aria-label={asset.alt || asset.fileName}>
        <source src={url} type={asset.mimeType} />
        Votre navigateur ne peut pas lire cette vidéo.
      </video>
      {asset.alt && <figcaption>{asset.alt}</figcaption>}
    </figure>
  );
}

/** Photos (légende = texte alternatif) puis vidéos ; la couverture n'est pas répétée. */
export function ArticleGallery({ media, coverUrl }: { media: readonly MediaAsset[]; coverUrl: string | null }) {
  const photos = media.filter((item) => item.kind === 'image' && item.url !== coverUrl && safeMediaUrl(item.url));
  const videos = media.filter((item) => item.kind === 'video' && safeMediaUrl(item.url));
  if (photos.length === 0 && videos.length === 0) return null;
  return (
    <section className="article-gallery" aria-label="Photos et vidéos">
      {videos.map((asset) => (
        <MediaVideo key={asset.id} asset={asset} />
      ))}
      {photos.length > 0 && (
        <div className="gallery-grid">
          {photos.map((asset) => (
            <figure key={asset.id} className="media-figure">
              <img src={safeMediaUrl(asset.url) ?? undefined} alt={asset.alt} loading="lazy" referrerPolicy="no-referrer" />
              {asset.alt && <figcaption>{asset.alt}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
