import { useId, useState, type DragEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2, Upload } from 'lucide-react';
import {
  ACCEPTED_MEDIA_TYPES,
  formatFileSize,
  MAX_MEDIA_PER_ARTICLE,
  mediaKindOf,
  toUserMessage,
  validateMediaFile,
  type MediaAsset,
  type MediaKind,
} from '@senair/core';
import { useApi } from '../../../shared/api/ApiProvider';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { cx } from '../../../shared/lib/cx';
import { safeMediaUrl } from '../../../shared/lib/labels';

/** Un média de l'article : déjà envoyé (`asset`) ou fichier local en cours d'envoi. */
export interface MediaItem {
  key: string;
  kind: MediaKind;
  fileName: string;
  sizeBytes: number;
  alt: string;
  previewUrl: string;
  file: File | null;
  status: 'uploading' | 'ready' | 'error';
  asset: MediaAsset | null;
  error: string | null;
}

export function itemFromAsset(asset: MediaAsset): MediaItem {
  return {
    key: asset.id,
    kind: asset.kind,
    fileName: asset.fileName,
    sizeBytes: asset.sizeBytes,
    alt: asset.alt,
    previewUrl: asset.url,
    file: null,
    status: 'ready',
    asset,
    error: null,
  };
}

/** Libère les aperçus locaux (URL blob:) quand l'éditeur se ferme. */
export function revokeLocalPreviews(items: readonly MediaItem[]) {
  items.filter((item) => item.file).forEach((item) => URL.revokeObjectURL(item.previewUrl));
}

/** Média au format d'affichage public (aperçu de l'article avant enregistrement). */
export function previewAsset(item: MediaItem): MediaAsset {
  return (
    item.asset ?? {
      id: item.key,
      kind: item.kind,
      url: item.previewUrl,
      mimeType: item.file?.type ?? '',
      sizeBytes: item.sizeBytes,
      fileName: item.fileName,
      alt: item.alt,
      width: null,
      height: null,
      durationSec: null,
      posterUrl: null,
      createdAt: new Date().toISOString(),
    }
  );
}

/** Identifiants dans l'ordre d'affichage, ou `null` si un média n'est pas encore envoyé. */
export function readyMediaIds(items: readonly MediaItem[]): string[] | null {
  if (items.some((item) => item.status !== 'ready' || !item.asset)) return null;
  return items.map((item) => item.asset?.id ?? '');
}

let sequence = 0;

interface MediaManagerProps {
  items: readonly MediaItem[];
  onChange: (updater: (items: MediaItem[]) => MediaItem[]) => void;
}

export function MediaManager({ items, onChange }: MediaManagerProps) {
  const api = useApi();
  const inputId = useId();
  const [rejected, setRejected] = useState<{ name: string; message: string }[]>([]);
  const [dragging, setDragging] = useState(false);

  const upload = useMutation({
    mutationFn: ({ file, alt }: { key: string; file: File; alt: string }) => api.admin.uploadMedia(file, { fileName: file.name, alt }),
  });

  const patch = (key: string, changes: Partial<MediaItem>) => onChange((list) => list.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  /** Envoi dès la sélection : aucune étape ni légende à saisir. */
  const send = (item: MediaItem) => {
    if (!item.file) return;
    patch(item.key, { status: 'uploading', error: null });
    // mutateAsync : chaque envoi a sa propre promesse (les callbacks de mutate ne suivent que le dernier appel).
    upload
      .mutateAsync({ key: item.key, file: item.file, alt: item.alt.trim() })
      .then((asset) => patch(item.key, { status: 'ready', asset, error: null }))
      .catch((error: unknown) => patch(item.key, { status: 'error', error: toUserMessage(error) }));
  };

  const addFiles = (files: readonly File[]) => {
    const problems: { name: string; message: string }[] = [];
    const accepted: MediaItem[] = [];
    let room = MAX_MEDIA_PER_ARTICLE - items.length;
    for (const file of files) {
      const problem = validateMediaFile(file);
      const kind = mediaKindOf(file.type);
      if (problem || !kind) {
        problems.push({ name: file.name, message: problem ?? 'Format non pris en charge.' });
        continue;
      }
      if (room <= 0) {
        problems.push({ name: file.name, message: `${MAX_MEDIA_PER_ARTICLE} médias maximum par article.` });
        continue;
      }
      room -= 1;
      const previewUrl = URL.createObjectURL(file);
      accepted.push({
        key: `local-${++sequence}`,
        kind,
        fileName: file.name,
        sizeBytes: file.size,
        alt: '',
        previewUrl,
        file,
        status: 'uploading',
        asset: null,
        error: null,
      });
    }
    setRejected(problems);
    if (accepted.length === 0) return;
    onChange((list) => [...list, ...accepted]);
    accepted.forEach(send);
  };

  const move = (index: number, delta: number) =>
    onChange((list) => {
      const next = [...list];
      const target = index + delta;
      const current = next[index];
      const other = next[target];
      if (!current || !other) return list;
      next[index] = other;
      next[target] = current;
      return next;
    });

  const makeCover = (key: string) =>
    onChange((list) => {
      const item = list.find((entry) => entry.key === key);
      return item ? [item, ...list.filter((entry) => entry.key !== key)] : list;
    });

  const remove = (item: MediaItem) => {
    if (item.file) URL.revokeObjectURL(item.previewUrl);
    onChange((list) => list.filter((entry) => entry.key !== item.key));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const coverKey = items.find((item) => item.kind === 'image')?.key ?? null;
  const full = items.length >= MAX_MEDIA_PER_ARTICLE;

  return (
    <div className="media-manager">
      <div
        className={cx('dropzone', dragging && 'dropzone--active', full && 'dropzone--disabled')}
        onDragOver={(event) => {
          event.preventDefault();
          if (!full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <ImagePlus size={28} aria-hidden="true" />
        <p className="strong">Glissez vos photos et vidéos ici</p>
        <p className="caption">
          Photo JPEG, PNG ou WebP (5 Mo maximum), vidéo MP4 ou WebM (50 Mo maximum). {items.length} / {MAX_MEDIA_PER_ARTICLE} médias.
        </p>
        <label htmlFor={inputId} className={cx('btn', 'btn--secondary', full && 'is-disabled')} aria-disabled={full || undefined}>
          <Upload size={16} aria-hidden="true" />
          Ajouter une photo ou une vidéo
        </label>
        {/* Sur mobile, le sélecteur propose aussi l'appareil photo (types image/vidéo acceptés). */}
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept={ACCEPTED_MEDIA_TYPES}
          multiple
          disabled={full}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>

      {rejected.length > 0 && (
        <ul className="media-rejected" role="alert">
          {rejected.map((entry) => (
            <li key={entry.name}>
              <strong>{entry.name}</strong> : {entry.message}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ol className="media-list" aria-label="Médias de l'article, dans l'ordre d'affichage">
          {items.map((item, index) => (
            <MediaRow
              key={item.key}
              item={item}
              index={index}
              count={items.length}
              isCover={item.key === coverKey}
              onSend={() => send(item)}
              onMove={(delta) => move(index, delta)}
              onCover={() => makeCover(item.key)}
              onRemove={() => remove(item)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

interface MediaRowProps {
  item: MediaItem;
  index: number;
  count: number;
  isCover: boolean;
  onSend: () => void;
  onMove: (delta: number) => void;
  onCover: () => void;
  onRemove: () => void;
}

const STATUS = {
  uploading: { label: 'Envoi en cours', tone: 'info' },
  ready: { label: 'Envoyé', tone: 'success' },
  error: { label: 'Échec', tone: 'danger' },
} as const;

function MediaRow({ item, index, count, isCover, onSend, onMove, onCover, onRemove }: MediaRowProps) {
  const preview = safeMediaUrl(item.previewUrl);
  const status = STATUS[item.status];
  return (
    <li className="media-row">
      <div className="media-row__thumb">
        {preview && item.kind === 'image' && <img src={preview} alt="" />}
        {preview && item.kind === 'video' && <video src={preview} muted playsInline preload="metadata" aria-hidden="true" />}
      </div>
      <div className="media-row__body">
        <div className="row">
          <span className="strong media-row__name">{item.fileName}</span>
          <span className="caption">
            {item.kind === 'image' ? 'Photo' : 'Vidéo'}, {formatFileSize(item.sizeBytes)}
          </span>
          <Badge tone={status.tone}>{status.label}</Badge>
          {isCover && (
            <Badge tone="info">
              <Star size={12} aria-hidden="true" /> Couverture
            </Badge>
          )}
        </div>
        {item.alt && <p className="small muted">Légende : {item.alt}</p>}
        {item.error && (
          <p className="small field__error" role="alert">
            {item.error}
          </p>
        )}
        {item.status === 'uploading' && (
          <p className="row small" role="status">
            <span className="spinner" aria-hidden="true" /> Envoi de {item.fileName}
          </p>
        )}
      </div>
      <div className="media-row__actions">
        {item.status === 'error' && (
          <Button size="sm" icon={<Upload size={16} aria-hidden="true" />} onClick={onSend}>
            Réessayer
          </Button>
        )}
        {item.kind === 'image' && !isCover && (
          <Button size="sm" variant="ghost" icon={<Star size={16} aria-hidden="true" />} onClick={onCover}>
            Couverture
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={<ArrowUp size={16} aria-hidden="true" />} disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Monter ${item.fileName}`} />
        <Button size="sm" variant="ghost" icon={<ArrowDown size={16} aria-hidden="true" />} disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Descendre ${item.fileName}`} />
        <Button size="sm" variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} disabled={item.status === 'uploading'} onClick={onRemove} aria-label={`Retirer ${item.fileName}`} />
      </div>
    </li>
  );
}
