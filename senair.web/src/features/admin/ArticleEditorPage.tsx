import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { articleSchema, toUserMessage, type Article, type ArticleCategory, type ArticleInput, type ArticleStatus } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Button } from '../../shared/ui/Button';
import { Card } from '../../shared/ui/Card';
import { CheckboxField, SelectField, TextAreaField, TextField } from '../../shared/ui/Field';
import { Markdown } from '../../shared/ui/Markdown';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { Tabs } from '../../shared/ui/Tabs';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { serverFieldErrors, validate, type FieldErrors } from '../../shared/lib/forms';
import { ARTICLE_CATEGORY_LABELS, ARTICLE_STATUS_LABELS, optionsOf } from '../../shared/lib/labels';
import { useAdminArticle } from './hooks';
import { MediaManager, itemFromAsset, previewAsset, readyMediaIds, revokeLocalPreviews, type MediaItem } from './components/MediaManager';
import { ArticleGallery, coverOf } from '../content/ArticleMedia';

interface EditorValues {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: ArticleCategory;
  status: ArticleStatus;
  featured: boolean;
  coverImageUrl: string;
  tags: string;
}

const toValues = (article: Article | null): EditorValues => ({
  title: article?.title ?? '',
  slug: article?.slug ?? '',
  excerpt: article?.excerpt ?? '',
  content: article?.content ?? '',
  category: article?.category ?? 'info',
  status: article?.status ?? 'draft',
  featured: article?.featured ?? false,
  // Seule une URL HTTPS saisie à la main est éditable ici ; sinon la couverture est la première photo.
  coverImageUrl: article?.coverImageUrl?.startsWith('https://') && !article.media.some((m) => m.url === article.coverImageUrl) ? article.coverImageUrl : '',
  tags: article?.tags.join(', ') ?? '',
});

const TABS = [
  { value: 'edit' as const, label: 'Rédaction' },
  { value: 'preview' as const, label: 'Aperçu' },
];

function EditorPreview({ values, media }: { values: EditorValues; media: readonly MediaItem[] }) {
  const assets = media.map(previewAsset);
  const cover = coverOf({ coverImageUrl: values.coverImageUrl.trim() || null, media: assets });
  return (
    <article className="article stack stack--sm">
      {cover && <img className="article__cover" src={cover.url} alt={cover.alt} />}
      <h1 className="h2">{values.title || 'Sans titre'}</h1>
      <p className="lead">{values.excerpt}</p>
      <Markdown content={values.content} />
      <ArticleGallery media={assets} coverUrl={cover?.url ?? null} />
    </article>
  );
}

function ArticleEditor({ article }: { article: Article | null }) {
  const api = useApi();
  const navigate = useNavigate();
  const [values, setValues] = useState(() => toValues(article));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [media, setMedia] = useState<MediaItem[]>(() => article?.media.map(itemFromAsset) ?? []);
  const mediaRef = useRef(media);
  useEffect(() => {
    mediaRef.current = media;
  }, [media]);
  useEffect(() => () => revokeLocalPreviews(mediaRef.current), []);
  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const save = useFeedbackMutation({
    mutationFn: (input: ArticleInput) => (article ? api.admin.updateArticle(article.id, input) : api.admin.createArticle(input)),
    invalidate: [queryKeys.admin.articlesAll, queryKeys.articles.all, queryKeys.admin.dashboard, ...(article ? [queryKeys.admin.article(article.id)] : [])],
    successMessage: (saved) => (saved.status === 'published' ? 'Article publié.' : 'Article enregistré.'),
    onSuccess: () => navigate('/admin/articles'),
    silentError: true,
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cover = values.coverImageUrl.trim();
    const mediaIds = readyMediaIds(media);
    if (!mediaIds) {
      setTab('edit');
      setFormError("Patientez pendant l'envoi des médias, ou retirez ceux dont l'envoi a échoué, avant d'enregistrer.");
      return;
    }
    const result = validate(articleSchema, {
      ...values,
      mediaIds,
      coverImageUrl: cover === '' ? null : cover,
      tags: values.tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setErrors(result.errors ?? {});
    setFormError(result.errors ? 'Corrigez les champs signalés.' : null);
    if (!result.data) {
      setTab('edit');
      return;
    }
    const { slug, ...rest } = result.data;
    save.mutate(
      { ...rest, ...(slug ? { slug } : {}) },
      {
        onError: (error) => {
          const fields = serverFieldErrors(error);
          setErrors(fields);
          setFormError(Object.keys(fields).length ? 'Corrigez les champs signalés.' : toUserMessage(error));
        },
      },
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      <Tabs label="Mode d'édition" items={TABS} value={tab} onChange={setTab} panelId="editor-panel" />
      <div id="editor-panel" role="tabpanel">
        {tab === 'edit' ? (
          <div className="editor-grid">
            <div className="stack">
            <Card title="Contenu">
              <TextField label="Titre" value={values.title} onChange={(e) => set('title', e.target.value)} error={errors.title} required />
              <TextField label="Identifiant d'URL (slug)" hint="Laisser vide pour le générer depuis le titre." value={values.slug} onChange={(e) => set('slug', e.target.value)} error={errors.slug} />
              <TextAreaField label="Chapeau" rows={3} value={values.excerpt} onChange={(e) => set('excerpt', e.target.value)} error={errors.excerpt} required />
              <TextAreaField
                label="Corps (Markdown)"
                hint="Titres (##), listes, liens. Le HTML n'est pas interprété."
                rows={16}
                className="textarea--code"
                value={values.content}
                onChange={(e) => set('content', e.target.value)}
                error={errors.content}
                required
              />
            </Card>
            <Card title="Photos et vidéos">
              <MediaManager items={media} onChange={setMedia} />
              {errors.mediaIds && <p className="field__error">{errors.mediaIds}</p>}
            </Card>
            </div>
            <Card title="Publication">
              <SelectField label="Statut" value={values.status} options={optionsOf(ARTICLE_STATUS_LABELS)} onChange={(e) => set('status', e.target.value as ArticleStatus)} error={errors.status} />
              <SelectField label="Catégorie" value={values.category} options={optionsOf(ARTICLE_CATEGORY_LABELS)} onChange={(e) => set('category', e.target.value as ArticleCategory)} error={errors.category} />
              <CheckboxField label="Mettre à la une" checked={values.featured} onChange={(e) => set('featured', e.target.checked)} />
              <TextField label="Mots-clés" hint="Séparés par des virgules (10 maximum)." value={values.tags} onChange={(e) => set('tags', e.target.value)} error={errors.tags ?? errors['tags.0']} />
              <details className="disclosure" open={Boolean(errors.coverImageUrl) || values.coverImageUrl !== ''}>
                <summary>Options avancées</summary>
                <TextField
                  label="Image de couverture externe (URL HTTPS)"
                  hint="Facultatif. Par défaut, la couverture est la première photo de la liste."
                  type="url"
                  value={values.coverImageUrl}
                  onChange={(e) => set('coverImageUrl', e.target.value)}
                  error={errors.coverImageUrl}
                />
              </details>
            </Card>
          </div>
        ) : (
          <Card title="Aperçu">
            <EditorPreview values={values} media={media} />
          </Card>
        )}
      </div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <div className="row row--end">
        <Link to="/admin/articles" className="btn btn--ghost">
          Annuler
        </Link>
        <Button type="submit" loading={save.isPending}>
          {values.status === 'published' ? 'Publier' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}

export function ArticleEditorPage() {
  const { articleId } = useParams();
  const isNew = !articleId || articleId === 'nouveau';
  const query = useAdminArticle(isNew ? null : articleId);

  return (
    <div className="stack">
      <Link to="/admin/articles" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Articles
      </Link>
      <PageHeader title={isNew ? 'Nouvel article' : "Modifier l'article"} />
      {isNew ? <ArticleEditor article={null} /> : <QueryState query={query}>{(article) => <ArticleEditor key={article.id} article={article} />}</QueryState>}
    </div>
  );
}
