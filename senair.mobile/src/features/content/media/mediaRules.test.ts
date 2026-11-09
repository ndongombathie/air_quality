import { describe, expect, it } from 'vitest';
import { coverOf, isSafeMediaUrl, readingMinutes, safeMedia, visualOf, type MediaTrust } from './mediaRules';
import type { MediaAsset } from '@senair/core';

const asset = (url: string, kind: MediaAsset['kind'] = 'image'): MediaAsset => ({
  id: url,
  kind,
  url,
  mimeType: kind === 'image' ? 'image/jpeg' : 'video/mp4',
  sizeBytes: 1,
  fileName: 'f',
  alt: 'texte',
  width: null,
  height: null,
  durationSec: null,
  posterUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
});

const STRICT: MediaTrust = { allowLocal: false, apiOrigin: null };
const DEMO: MediaTrust = { allowLocal: true, apiOrigin: null };
const LOCAL_API: MediaTrust = {
  allowLocal: false,
  apiOrigin: 'http://192.168.1.87:8000',
};

describe('règles des médias', () => {
  it("n'accepte que https, http de l'API, et blob ou file en démonstration", () => {
    expect(isSafeMediaUrl('https://exemple.sn/a.jpg', STRICT)).toBe(true);
    expect(isSafeMediaUrl('http://exemple.sn/a.jpg', STRICT)).toBe(false);
    expect(isSafeMediaUrl('http://192.168.1.87:8000/media/a.mp4', LOCAL_API)).toBe(true);
    expect(isSafeMediaUrl('http://192.168.1.87:9000/media/a.mp4', LOCAL_API)).toBe(false);
    expect(isSafeMediaUrl('http://exemple.sn/a.jpg', LOCAL_API)).toBe(false);
    expect(isSafeMediaUrl('javascript:alert(1)', DEMO)).toBe(false);
    expect(isSafeMediaUrl('blob:https://x/1', STRICT)).toBe(false);
    expect(isSafeMediaUrl('blob:https://x/1', DEMO)).toBe(true);
    expect(isSafeMediaUrl('pas une url', DEMO)).toBe(false);
  });

  it('filtre les médias et choisit la couverture', () => {
    const media = [asset('http://x/a.jpg'), asset('https://x/v.mp4', 'video'), asset('https://x/b.jpg')];
    expect(safeMedia(media, STRICT).map((m) => m.url)).toEqual(['https://x/v.mp4', 'https://x/b.jpg']);
    expect(coverOf({ coverImageUrl: null, media }, STRICT)?.url).toBe('https://x/b.jpg');
    expect(coverOf({ coverImageUrl: 'data:image/png;base64,AA', media: [] }, DEMO)).toBeNull();
  });

  it("illustre l'article par sa photo, sinon par sa vidéo", () => {
    const video = asset('https://x/v.mp4', 'video');
    expect(visualOf({ coverImageUrl: null, media: [video, asset('https://x/b.jpg')] }, STRICT)).toMatchObject({ kind: 'image', url: 'https://x/b.jpg' });
    expect(visualOf({ coverImageUrl: null, media: [video] }, STRICT)).toEqual({
      kind: 'video',
      video,
    });
    expect(visualOf({ coverImageUrl: null, media: [] }, STRICT)).toBeNull();
  });

  it('estime le temps de lecture', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes(Array(600).fill('mot').join(' '))).toBe(3);
  });
});
