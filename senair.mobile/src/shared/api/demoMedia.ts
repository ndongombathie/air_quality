/**
 * DÉVELOPPEMENT UNIQUEMENT (mode mock + EXPO_PUBLIC_DEMO_MEDIA=1).
 * Les articles de démonstration de core n'ont pas de média : ce décorateur en ajoute
 * (photos picsum.photos, vidéo CC0 de MDN) pour vérifier l'affichage, sans modifier core.
 */
import type { Article, ArticleSummary, MediaAsset, SenairApi } from '@senair/core';

const now = '2026-11-01T08:00:00Z';

function image(id: string, seed: string, alt: string): MediaAsset {
  return {
    id,
    kind: 'image',
    url: `https://picsum.photos/seed/${seed}/1200/800`,
    mimeType: 'image/jpeg',
    sizeBytes: 180_000,
    fileName: `${seed}.jpg`,
    alt,
    width: 1200,
    height: 800,
    durationSec: null,
    posterUrl: null,
    createdAt: now,
  };
}

const VIDEO: MediaAsset = {
  id: 'demo-video',
  kind: 'video',
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 1_100_000,
  fileName: 'flower.mp4',
  alt: "Vidéo de démonstration (aucun lien avec l'article)",
  width: 1280,
  height: 720,
  durationSec: 5,
  posterUrl: null,
  createdAt: now,
};

function mediaFor(index: number): MediaAsset[] {
  const base = [
    image(`demo-${index}-a`, `senair-${index}-a`, 'Photo de démonstration : rue de Thiès'),
    image(`demo-${index}-b`, `senair-${index}-b`, 'Photo de démonstration : quartier résidentiel'),
    image(`demo-${index}-c`, `senair-${index}-c`, 'Photo de démonstration : capteur sur un toit'),
  ];
  return index === 0 ? [...base, VIDEO] : index % 2 === 0 ? base.slice(0, 1) : [...base.slice(0, 2), VIDEO];
}

function decorate<T extends ArticleSummary | Article>(article: T, index: number): T {
  const media = mediaFor(index);
  return { ...article, media, coverImageUrl: media[0]?.url ?? null };
}

export function withDemoMedia(api: SenairApi): SenairApi {
  const order = new Map<string, number>();
  const indexOf = (slug: string) => {
    if (!order.has(slug)) order.set(slug, order.size);
    return order.get(slug) ?? 0;
  };
  return {
    ...api,
    articles: {
      list: async (query) => {
        const page = await api.articles.list(query);
        return { ...page, items: page.items.map((a) => decorate(a, indexOf(a.slug))) };
      },
      getBySlug: async (slug) => decorate(await api.articles.getBySlug(slug), indexOf(slug)),
    },
  };
}
