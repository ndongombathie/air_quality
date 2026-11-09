import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { formatDateTime, type ArticleStatus, type ArticleSummary } from '@senair/core';
import { useApi } from '../../shared/api/ApiProvider';
import { queryKeys } from '../../shared/api/queryKeys';
import { Badge } from '../../shared/ui/Badge';
import { Button, ButtonLink } from '../../shared/ui/Button';
import { DataTable } from '../../shared/ui/DataTable';
import { SelectField, TextField } from '../../shared/ui/Field';
import { Modal } from '../../shared/ui/Modal';
import { PageHeader } from '../../shared/ui/PageHeader';
import { QueryState } from '../../shared/ui/QueryState';
import { useFeedbackMutation } from '../../shared/hooks/useFeedbackMutation';
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue';
import { ARTICLE_CATEGORY_LABELS, ARTICLE_STATUS_LABELS, optionsOf } from '../../shared/lib/labels';
import { useAdminArticles } from './hooks';

const STATUS_TONE = { draft: 'warning', published: 'success', archived: 'neutral' } as const;

export function ArticlesAdminPage() {
  const api = useApi();
  const [status, setStatus] = useState<ArticleStatus | ''>('');
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim());
  const query = useAdminArticles({ ...(status ? { status } : {}), ...(term ? { search: term } : {}) });
  const [deleting, setDeleting] = useState<ArticleSummary | null>(null);
  const remove = useFeedbackMutation({
    mutationFn: (id: string) => api.admin.deleteArticle(id),
    invalidate: [queryKeys.admin.articlesAll, queryKeys.articles.all, queryKeys.admin.dashboard],
    successMessage: 'Article supprimé.',
    onSuccess: () => setDeleting(null),
  });

  return (
    <div className="stack">
      <PageHeader
        title="Articles"
        description="Publications destinées au public : alertes, rapports, sensibilisation."
        actions={
          <ButtonLink to="/admin/articles/nouveau" icon={<Plus size={16} aria-hidden="true" />}>
            Nouvel article
          </ButtonLink>
        }
      />
      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <TextField label="Rechercher" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectField label="Statut" value={status} placeholder="Tous" options={optionsOf(ARTICLE_STATUS_LABELS)} onChange={(e) => setStatus(e.target.value as ArticleStatus | '')} />
      </form>
      <QueryState query={query} isEmpty={(page) => page.items.length === 0} emptyMessage="Aucun article.">
        {(page) => (
          <DataTable
            caption="Articles"
            rows={page.items}
            rowKey={(a) => a.id}
            columns={[
              { key: 'title', header: 'Titre', render: (a) => <Link to={`/admin/articles/${encodeURIComponent(a.id)}`}>{a.title}</Link> },
              { key: 'category', header: 'Catégorie', render: (a) => ARTICLE_CATEGORY_LABELS[a.category] },
              { key: 'status', header: 'Statut', render: (a) => <Badge tone={STATUS_TONE[a.status]}>{ARTICLE_STATUS_LABELS[a.status]}</Badge> },
              { key: 'author', header: 'Auteur', render: (a) => a.author.name },
              { key: 'updated', header: 'Modifié', render: (a) => formatDateTime(a.updatedAt) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                render: (a) => (
                  <div className="row">
                    <ButtonLink to={`/admin/articles/${encodeURIComponent(a.id)}`} size="sm" variant="ghost" icon={<Pencil size={16} aria-hidden="true" />} aria-label={`Modifier ${a.title}`} />
                    <Button size="sm" variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} aria-label={`Supprimer ${a.title}`} onClick={() => setDeleting(a)} />
                  </div>
                ),
              },
            ]}
          />
        )}
      </QueryState>
      <Modal
        open={deleting !== null}
        title="Supprimer cet article ?"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>
              Supprimer
            </Button>
          </>
        }
      >
        <p>« {deleting?.title} » sera définitivement supprimé. Préférez l'archivage pour le retirer du site sans le perdre.</p>
      </Modal>
    </div>
  );
}
