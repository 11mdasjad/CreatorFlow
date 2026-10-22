'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Download,
  Pencil,
  Trash2,
  Copy,
  Play,
  ExternalLink,
  FileText,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  Loader2,
  MessageCircle,
  ShoppingBag,
  GraduationCap,
  Send,
} from 'lucide-react';
import { useWorkspace } from './shell';
import { api, send, date, money } from '@/lib/api';
import { PageHeading, Loading, ErrorState, Empty, Badge } from './shared';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { useToast } from './providers';
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
};
const resources: Record<
  string,
  { title: string; singular: string; description: string; fields: Field[]; initial: any }
> = {
  leads: {
    title: 'Your audience, a little closer.',
    singular: 'lead',
    description: 'Keep every connection in one thoughtful place.',
    initial: { name: '', email: '', phone: '', source: 'Manual', tags: [], status: 'NEW' },
    fields: [
      { key: 'name', label: 'Full name', required: true },
      { key: 'email', label: 'Email address', type: 'email', required: true },
      { key: 'phone', label: 'Phone number' },
      { key: 'source', label: 'Source' },
      { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'Creator, Newsletter' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'],
      },
    ],
  },
  forms: {
    title: 'Give your audience a place to land.',
    singular: 'form',
    description: 'Capture interest with a clear form and meaningful consent.',
    initial: {
      name: '',
      slug: '',
      description: '',
      consentText:
        'I agree to receive updates and marketing emails. I can unsubscribe at any time.',
      published: false,
    },
    fields: [
      { key: 'name', label: 'Form name', required: true },
      { key: 'slug', label: 'Public URL slug', required: true, placeholder: 'the-creative-guide' },
      { key: 'description', label: 'Description', type: 'textarea' },
      {
        key: 'consentText',
        label: 'Optional marketing consent wording',
        type: 'textarea',
        required: true,
      },
      { key: 'published', label: 'Publish this form', type: 'checkbox' },
    ],
  },
  magnets: {
    title: 'Share a little of what you know.',
    singular: 'lead magnet',
    description: 'Turn a useful resource into your next meaningful connection.',
    initial: {
      name: '',
      description: '',
      resourceUrl: '',
      fileId: '',
      formId: '',
      published: false,
    },
    fields: [
      { key: 'name', label: 'Resource title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'resourceUrl', label: 'Resource URL (HTTPS)', type: 'url' },
      { key: 'fileId', label: 'Or choose an uploaded file', type: 'fileSelect' },
      { key: 'formId', label: 'Lead form', type: 'formSelect' },
      { key: 'published', label: 'Publish and deliver after form submissions', type: 'checkbox' },
    ],
  },
  products: {
    title: 'Your expertise. Your storefront.',
    singular: 'product',
    description: 'Create digital products that help your audience take the next step.',
    initial: {
      name: '',
      description: '',
      kind: 'DOWNLOAD',
      priceMinor: 10000,
      currency: 'INR',
      fileId: '',
      courseId: '',
      published: false,
    },
    fields: [
      { key: 'name', label: 'Product name', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'kind', label: 'Product type', type: 'select', options: ['DOWNLOAD', 'COURSE'] },
      {
        key: 'priceMinor',
        label: 'Price in minor units (100 = ₹1 / $1)',
        type: 'number',
        required: true,
      },
      { key: 'currency', label: 'Currency', type: 'select', options: ['INR', 'USD', 'EUR', 'GBP'] },
      { key: 'fileId', label: 'Digital download file', type: 'fileSelect' },
      { key: 'courseId', label: 'Course', type: 'courseSelect' },
      { key: 'published', label: 'Publish product', type: 'checkbox' },
    ],
  },
  courses: {
    title: 'Make your knowledge go further.',
    singular: 'course',
    description: 'A home for the lessons only you can teach.',
    initial: { name: '', description: '', free: false, published: false },
    fields: [
      { key: 'name', label: 'Course name', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'free', label: 'Free enrollment', type: 'checkbox' },
      { key: 'published', label: 'Publish course', type: 'checkbox' },
    ],
  },
  automations: {
    title: 'Good conversations, on autopilot.',
    singular: 'automation',
    description: 'A thoughtful first reply. A more connected audience.',
    initial: {
      name: '',
      accountId: '',
      mediaId: '',
      keywords: [],
      matchMode: 'CONTAINS',
      message: '',
      status: 'DRAFT',
    },
    fields: [
      { key: 'name', label: 'Automation name', required: true },
      { key: 'accountId', label: 'Instagram account', type: 'accountSelect' },
      {
        key: 'mediaId',
        label: 'Instagram post or reel ID',
        placeholder: 'Choose a connected account and use an eligible media ID',
      },
      {
        key: 'keywords',
        label: 'Comment keywords',
        type: 'tags',
        required: true,
        placeholder: 'GUIDE, START',
      },
      {
        key: 'matchMode',
        label: 'Keyword matching',
        type: 'select',
        options: ['CONTAINS', 'EXACT'],
      },
      {
        key: 'message',
        label: 'Private reply (maximum 1,000 characters)',
        type: 'textarea',
        required: true,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'],
      },
    ],
  },
  support: {
    title: 'A little help goes a long way.',
    singular: 'support ticket',
    description: 'Tell us what’s happening. Keep the conversation in your workspace.',
    initial: { subject: '', body: '' },
    fields: [
      { key: 'subject', label: 'Subject', required: true },
      { key: 'body', label: 'How can we help?', type: 'textarea', required: true },
    ],
  },
};
export function ResourcePage({ kind }: { kind: string }) {
  const def = resources[kind],
    { workspaceId, role } = useWorkspace(),
    toast = useToast(),
    client = useQueryClient(),
    params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || ''),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(''),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<any>(null),
    [form, setForm] = useState<any>(def.initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState<any>(null),
    [detail, setDetail] = useState<any>(null),
    [comment, setComment] = useState('GUIDE'),
    [simulation, setSimulation] = useState<any>(null),
    [note, setNote] = useState('');
  const base = `/workspaces/${workspaceId}`;
  const globalSearch = params.get('search');
  useEffect(() => {
    if (globalSearch !== null) {
      setSearch(globalSearch);
      setPage(1);
    }
  }, [globalSearch]);
  useEffect(() => {
    if (params.get('new') === '1') create();
  }, []);
  const query = useQuery({
    queryKey: [kind, workspaceId, search, page, status],
    queryFn: () =>
      api(
        `${base}/resources/${kind}?search=${encodeURIComponent(search)}&page=${page}${status ? `&status=${status}` : ''}`,
      ),
  });
  const options = useQuery({
    queryKey: ['resource-options', workspaceId, kind],
    queryFn: async () => {
      const [accounts, forms, files, courses] = await Promise.all([
        api(`${base}/integrations`),
        api(`${base}/resources/forms`),
        api(`${base}/files`),
        api(`${base}/resources/courses`),
      ]);
      return {
        accountSelect: accounts.accounts.map((x: any) => ({ id: x.id, name: `@${x.username}` })),
        formSelect: forms.items,
        fileSelect: files
          .filter((x: any) => x.status === 'READY')
          .map((x: any) => ({ id: x.id, name: x.filename })),
        courseSelect: courses.items,
      };
    },
    enabled: open && ['automations', 'magnets', 'products'].includes(kind),
  });
  const timeline = useQuery({
    queryKey: ['detail', workspaceId, kind, detail?.id],
    queryFn: () =>
      api(
        kind === 'leads'
          ? `${base}/leads/${detail.id}/timeline`
          : kind === 'automations'
            ? `${base}/automations/${detail.id}/executions`
            : `${base}/courses/${detail.id}/curriculum`,
      ),
    enabled: !!detail && ['leads', 'automations', 'courses'].includes(kind),
  });
  function refresh() {
    client.invalidateQueries({ queryKey: [kind] });
    client.invalidateQueries({ queryKey: ['analytics'] });
  }
  function create() {
    setEditing(null);
    setForm({ ...def.initial });
    setError('');
    setOpen(true);
  }
  function edit(row: any) {
    setEditing(row);
    setForm(Object.fromEntries(def.fields.map((f) => [f.key, row[f.key] ?? def.initial[f.key]])));
    setError('');
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = { ...form };
      for (const f of def.fields) {
        if (f.type === 'tags' && typeof data[f.key] === 'string')
          data[f.key] = data[f.key]
            .split(',')
            .map((x: string) => x.trim())
            .filter(Boolean);
        if (f.type === 'number') data[f.key] = Number(data[f.key]);
        if (
          ['fileId', 'formId', 'accountId', 'mediaId', 'courseId', 'resourceUrl'].includes(f.key) &&
          !data[f.key]
        )
          data[f.key] = null;
      }
      await send(
        `${base}/resources/${kind}${editing ? '/' + editing.id : ''}`,
        data,
        editing ? 'PATCH' : 'POST',
      );
      setOpen(false);
      refresh();
      toast(`${def.singular[0].toUpperCase() + def.singular.slice(1)} saved`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const canWrite = role !== 'VIEWER';
  function rowActions(row: any) {
    return (
      <div className="row-actions">
        {kind === 'forms' && row.published && (
          <Link href={`/f/${row.slug}`} aria-label={`Open ${row.name}`}>
            <ExternalLink size={16} />
          </Link>
        )}
        {canWrite && kind !== 'support' && (
          <button aria-label={`Edit ${row.name}`} onClick={() => edit(row)}>
            <Pencil size={16} />
          </button>
        )}
        {kind === 'automations' && canWrite && (
          <button
            aria-label={`Duplicate ${row.name}`}
            onClick={async () => {
              try {
                await send(`${base}/automations/${row.id}/duplicate`, {});
                refresh();
                toast('Draft copy created');
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          >
            <Copy size={16} />
          </button>
        )}
        {canWrite && (
          <button aria-label={`Delete ${row.name || row.subject}`} onClick={() => setDeleting(row)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      <PageHeading
        eyebrow={
          kind === 'automations' ? 'CONVERSATIONS THAT CONNECT' : 'BUILT AROUND YOUR AUDIENCE'
        }
        title={def.title}
        description={def.description}
        action={
          <div className="heading-actions">
            {kind === 'leads' && (
              <Button variant="secondary" asChild>
                <a href={`/api${base}/resources/leads/export`}>
                  <Download size={16} />
                  Export CSV
                </a>
              </Button>
            )}
            {canWrite && (
              <Button onClick={create}>
                <Plus size={16} />
                New {def.singular}
              </Button>
            )}
          </div>
        }
      />
      {kind === 'automations' && (
        <div className="info-strip">
          <InstagramGlyph />
          <span>
            Official Instagram comment replies. Draft freely; activation requires an approved,
            connected account.
          </span>
          <Link href="/app/social-accounts">
            Manage connections <ExternalLink size={13} />
          </Link>
        </div>
      )}
      {kind === 'products' && <StoreSettings />}
      {kind === 'magnets' && <FileUpload />}
      <section className="panel resource-panel">
        <div className="table-toolbar">
          <div className="tab-title">
            All {kind === 'magnets' ? 'resources' : kind}
            <span>{query.data?.total || 0}</span>
          </div>
          <div className="table-controls">
            <label className="table-search">
              <Search size={16} />
              <input
                aria-label={`Search ${kind}`}
                placeholder={`Search ${kind}…`}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            {kind === 'leads' && (
              <select
                aria-label="Filter by lead status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <ErrorState error={query.error} retry={() => query.refetch()} />
        ) : !query.data.items.length ? (
          <Empty
            title={search ? 'No matches yet' : `Your first ${def.singular} starts here`}
            description={
              search
                ? 'Try another search or clear your filters.'
                : `Create a ${def.singular} and make this space your own.`
            }
            action={
              canWrite && !search ? (
                <Button variant="secondary" onClick={create}>
                  <Plus size={16} />
                  Create {def.singular}
                </Button>
              ) : undefined
            }
          />
        ) : kind === 'products' || kind === 'courses' ? (
          <div className="catalog-grid">
            {query.data.items.map((row: any, index: number) => (
              <article className="catalog-card" key={row.id}>
                <button
                  className={`catalog-cover cover-${index % 4}`}
                  aria-label={`Open ${row.name}`}
                  onClick={() => setDetail(row)}
                >
                  <span className="catalog-cover-icon">
                    {kind === 'courses' || row.kind === 'COURSE' ? (
                      <GraduationCap size={33} />
                    ) : (
                      <ShoppingBag size={33} />
                    )}
                  </span>
                  <span>
                    {kind === 'courses' || row.kind === 'COURSE'
                      ? 'THE LEARNING COLLECTION'
                      : 'THE CREATOR COLLECTION'}
                  </span>
                  <strong>{row.name}</strong>
                </button>
                <div className="catalog-body">
                  <button className="catalog-name" onClick={() => setDetail(row)}>
                    {row.name}
                  </button>
                  <p>
                    {row.description ||
                      (kind === 'courses'
                        ? 'Your next learning experience.'
                        : 'A digital product, made by you.')}
                  </p>
                  <div className="catalog-meta">
                    <strong>
                      {kind === 'courses'
                        ? row.free
                          ? 'Free enrollment'
                          : 'Paid access'
                        : money(row.priceMinor, row.currency)}
                    </strong>
                    <Badge tone={row.published ? 'green' : 'neutral'}>
                      {row.published ? 'Published' : 'Draft'}
                    </Badge>
                  </div>
                  <div className="catalog-footer">
                    <span>
                      {kind === 'courses'
                        ? 'Course'
                        : row.kind === 'COURSE'
                          ? 'Online course'
                          : 'Digital download'}
                    </span>
                    {rowActions(row)}
                  </div>
                </div>
              </article>
            ))}
            {canWrite && (
              <button className="catalog-add" onClick={create}>
                <span>
                  <Plus size={25} />
                </span>
                Create new {def.singular}
              </button>
            )}
          </div>
        ) : kind === 'automations' ? (
          <div className="automation-list">
            {query.data.items.map((row: any) => (
              <article className="automation-list-item" key={row.id}>
                <span className="automation-symbol">
                  <Send size={24} />
                </span>
                <div className="automation-copy">
                  <button
                    className="table-name"
                    onClick={() => {
                      setDetail(row);
                      setSimulation(null);
                    }}
                  >
                    <span className="sr-only">{row.name[0]} </span>
                    <span>
                      {row.name}
                      <small>Instagram comment</small>
                    </span>
                  </button>
                  <p>
                    When a comment includes{' '}
                    {row.keywords.map((keyword: string) => (
                      <span className="tag" key={keyword}>
                        {keyword}
                      </span>
                    ))}
                  </p>
                </div>
                <Badge
                  tone={
                    row.status === 'ACTIVE' ? 'green' : row.status === 'FAILED' ? 'red' : 'neutral'
                  }
                >
                  {row.status}
                </Badge>
                {rowActions(row)}
              </article>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{kind === 'support' ? 'Subject' : 'Name'}</th>
                  <th>
                    {kind === 'leads'
                      ? 'Email'
                      : kind === 'automations'
                        ? 'Keywords'
                        : kind === 'products'
                          ? 'Price'
                          : 'Details'}
                  </th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row: any) => (
                  <tr key={row.id}>
                    <td>
                      <button
                        className="table-name"
                        onClick={() => {
                          setDetail(row);
                          setSimulation(null);
                        }}
                      >
                        <span
                          className={`avatar table-avatar ${kind === 'automations' ? 'violet' : ''}`}
                        >
                          {(row.name || row.subject)[0]}
                        </span>
                        <span>
                          {row.name || row.subject}
                          <small>
                            {kind === 'leads'
                              ? row.source
                              : kind === 'automations'
                                ? 'Instagram comment'
                                : kind === 'products'
                                  ? row.kind.replace('_', ' ')
                                  : row.slug
                                    ? `/f/${row.slug}`
                                    : ''}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      {kind === 'leads' ? (
                        row.email
                      ) : kind === 'automations' ? (
                        row.keywords.map((k: string) => (
                          <span className="tag" key={k}>
                            {k}
                          </span>
                        ))
                      ) : kind === 'products' ? (
                        money(row.priceMinor, row.currency)
                      ) : (
                        <span className="truncate">{row.description || row.body || '—'}</span>
                      )}
                    </td>
                    <td>
                      <Badge
                        tone={
                          ['ACTIVE', 'CONVERTED', 'RESOLVED'].includes(row.status) || row.published
                            ? 'green'
                            : row.status === 'FAILED'
                              ? 'red'
                              : 'neutral'
                        }
                      >
                        {row.status || (row.published ? 'Published' : 'Draft')}
                      </Badge>
                    </td>
                    <td className="muted">{date(row.createdAt)}</td>
                    <td>{rowActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data && query.data.total > 0 && (
          <div className="table-pagination">
            <span>
              Page {page} of {query.data.pages} · {query.data.total} records
            </span>
            <div>
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ArrowLeft size={14} />
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= query.data.pages}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </section>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={`${editing ? 'Edit' : 'Create'} ${def.singular}`}
        description={
          kind === 'automations'
            ? 'Start with a draft. You can simulate keyword matching before connecting a live account.'
            : 'Thoughtful details make a better experience.'
        }
      >
        <form onSubmit={save} className="stack-form">
          {def.fields.map((f) => (
            <label key={f.key} className={f.type === 'checkbox' ? 'check-field' : ''}>
              {f.type !== 'checkbox' && (
                <span>
                  {f.label}
                  {f.required && ' *'}
                </span>
              )}
              {f.type === 'textarea' ? (
                <textarea
                  required={f.required}
                  maxLength={f.key === 'message' ? 1000 : 5000}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              ) : f.type === 'checkbox' ? (
                <>
                  <input
                    type="checkbox"
                    checked={!!form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                  />
                  {f.label}
                </>
              ) : f.type === 'select' ? (
                <select
                  aria-label={f.label}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                >
                  {f.options?.map((o) => (
                    <option key={o} value={o}>
                      {o.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              ) : f.type?.endsWith('Select') ? (
                <select
                  aria-label={f.label}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                >
                  <option value="">Select when ready</option>
                  {(options.data as any)?.[f.type]?.map((o: any) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'tags' ? 'text' : f.type || 'text'}
                  required={f.required}
                  placeholder={f.placeholder}
                  value={Array.isArray(form[f.key]) ? form[f.key].join(', ') : (form[f.key] ?? '')}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
          {options.error && <p className="form-error">{options.error.message}</p>}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy}>
              {busy ? <Loader2 size={16} className="spin" /> : null}
              {editing ? 'Save changes' : `Create ${def.singular}`}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title={`Delete ${def.singular}?`}
        description="This permanently removes the record and its dependent data. This cannot be undone."
      >
        <p className="delete-name">{deleting?.name || deleting?.subject}</p>
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Keep record
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                await api(`${base}/resources/${kind}/${deleting.id}`, { method: 'DELETE' });
                setDeleting(null);
                refresh();
                toast('Record deleted');
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          >
            Delete permanently
          </Button>
        </div>
      </Modal>
      <Modal
        wide
        open={!!detail}
        onOpenChange={() => setDetail(null)}
        title={detail?.name || detail?.subject || 'Details'}
        description={detail?.description || 'Record details and activity.'}
      >
        {detail && (
          <div className="detail-content">
            {kind === 'automations' ? (
              <>
                <div className="message-preview">
                  <small>PRIVATE REPLY PREVIEW</small>
                  <p>{detail.message}</p>
                </div>
                <label className="field">
                  Test comment
                  <input value={comment} onChange={(e) => setComment(e.target.value)} />
                </label>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      setSimulation(
                        await send(`${base}/automations/${detail.id}/simulate`, { comment }),
                      );
                    } catch (e) {
                      toast((e as Error).message, true);
                    }
                  }}
                >
                  <Play size={15} />
                  Run simulation
                </Button>
                {simulation && (
                  <div className="info-strip">
                    <div>
                      <Badge tone="amber">Simulation</Badge>
                      <p>
                        {simulation.matched ? 'Keyword matched' : 'No keyword matched'}.{' '}
                        {simulation.notice}
                      </p>
                    </div>
                  </div>
                )}
                <h3>Execution history</h3>
                {timeline.data?.length ? (
                  timeline.data.map((e: any) => (
                    <div className="list-line" key={e.id}>
                      <Badge>{e.status}</Badge>
                      <span>{e.errorCode || e.providerMessageId || 'Queued'}</span>
                      <small>{date(e.createdAt)}</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">No live executions yet.</p>
                )}
              </>
            ) : kind === 'leads' ? (
              <>
                <div className="detail-summary">
                  <p>
                    <strong>Email</strong>
                    {detail.email}
                  </p>
                  <p>
                    <strong>Status</strong>
                    {detail.status}
                  </p>
                  <p>
                    <strong>Source</strong>
                    {detail.source}
                  </p>
                </div>
                <h3>Notes</h3>
                {timeline.data?.notes?.map((n: any) => (
                  <div className="note" key={n.id}>
                    <p>{n.body}</p>
                    <small>{date(n.createdAt)}</small>
                  </div>
                ))}
                {canWrite && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        await send(`${base}/leads/${detail.id}/notes`, { body: note });
                        setNote('');
                        timeline.refetch();
                      } catch (error) {
                        toast((error as Error).message, true);
                      }
                    }}
                    className="stack-form"
                  >
                    <textarea
                      aria-label="Lead note"
                      placeholder="Add a thoughtful note…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      required
                    />
                    <Button>Add note</Button>
                  </form>
                )}
                <h3>Consent history</h3>
                {timeline.data?.consents?.length ? (
                  timeline.data.consents.map((c: any) => (
                    <div className="note" key={c.id}>
                      <Badge tone={c.granted ? 'green' : 'neutral'}>
                        {c.granted ? 'Granted' : 'Declined'}
                      </Badge>
                      <p>{c.wording}</p>
                      <small>{date(c.createdAt)}</small>
                    </div>
                  ))
                ) : (
                  <p className="muted">No consent recorded. Do not assume marketing permission.</p>
                )}
              </>
            ) : kind === 'courses' ? (
              <CourseEditor
                course={detail}
                modules={timeline.data || []}
                reload={() => timeline.refetch()}
              />
            ) : (
              <>
                <p>{detail.body || detail.description || 'No description yet.'}</p>
                {detail.response && (
                  <div className="note">
                    <strong>Support response</strong>
                    <p>{detail.response}</p>
                  </div>
                )}
                {kind === 'forms' && (
                  <Button asChild variant="secondary">
                    <Link href={`/f/${detail.slug}`}>
                      Open public form
                      <ExternalLink size={15} />
                    </Link>
                  </Button>
                )}
              </>
            )}
            {timeline.error && <p className="form-error">{timeline.error.message}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
export function FileUpload() {
  const { workspaceId, role } = useWorkspace(),
    toast = useToast();
  const [busy, setBusy] = useState(false);
  if (role === 'VIEWER') return null;
  return (
    <div className="info-strip">
      <FileText size={19} />
      <span>Have a PDF, video, or downloadable resource? Add it to your secure library.</span>
      <label className="btn btn-secondary btn-sm">
        {busy ? 'Uploading…' : 'Upload file'}
        <input
          className="sr-only"
          type="file"
          disabled={busy}
          accept=".pdf,.zip,.png,.jpg,.txt,.mp4"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              const upload = await send(`/workspaces/${workspaceId}/files/upload`, {
                filename: file.name,
                mimeType: file.type || 'application/zip',
                size: file.size,
              });
              const response = await fetch(upload.url, {
                method: 'PUT',
                body: file,
                headers: upload.headers,
              });
              if (!response.ok) throw new Error('Storage rejected the upload');
              await send(`/workspaces/${workspaceId}/files/${upload.id}/complete`, {});
              toast('File uploaded. You can attach it to a resource.');
            } catch (error) {
              toast((error as Error).message, true);
            } finally {
              setBusy(false);
              e.target.value = '';
            }
          }}
        />
      </label>
    </div>
  );
}
function InstagramGlyph() {
  return <MessageCircle size={19} />;
}
function StoreSettings() {
  const { workspaceId, role } = useWorkspace(),
    toast = useToast();
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<any>({}),
    [country, setCountry] = useState('');
  const q = useQuery({
    queryKey: ['store', workspaceId],
    queryFn: () => api(`/workspaces/${workspaceId}/store`),
  });
  return (
    <>
      <div className="info-strip">
        <ShoppingIcon />
        <span>
          {q.data?.published
            ? 'Your storefront is published.'
            : 'Your storefront is a draft. Publish when your products are ready.'}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setDraft(q.data || {});
            setOpen(true);
          }}
        >
          Store settings
        </Button>
        {q.data?.published && (
          <Link href={`/store/${q.data.slug}`}>
            View store <ExternalLink size={14} />
          </Link>
        )}
      </div>
      <StorePayments />
      <FileUpload />
      <Modal open={open} onOpenChange={setOpen} title="Your storefront">
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const { name, description, accent, published } = draft;
              await send(
                `/workspaces/${workspaceId}/store`,
                { name, description, accent, published },
                'PATCH',
              );
              q.refetch();
              setOpen(false);
              toast('Store updated');
            } catch (error) {
              toast((error as Error).message, true);
            }
          }}
        >
          <label>
            Store name
            <input
              required
              value={draft.name || ''}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              value={draft.description || ''}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label>
            Accent color
            <input
              type="color"
              value={draft.accent || '#7062ef'}
              onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={!!draft.published}
              onChange={(e) => setDraft({ ...draft, published: e.target.checked })}
            />
            Publish storefront
          </label>
          <Button disabled={!['OWNER', 'ADMIN'].includes(role)}>Save storefront</Button>
          <div className="setup-note">
            <p>
              Payments require an approved Stripe Connect merchant account. Availability depends on
              your country and the platform operator’s configuration.
            </p>
          </div>
        </form>
      </Modal>
    </>
  );
}
function ShoppingIcon() {
  return <FileText size={19} />;
}
function CourseEditor({
  course,
  modules,
  reload,
}: {
  course: any;
  modules: any[];
  reload: () => void;
}) {
  const { workspaceId, role } = useWorkspace(),
    toast = useToast();
  const [name, setName] = useState(''),
    [lesson, setLesson] = useState({ moduleId: '', name: '', body: '', videoUrl: '' });
  const canWrite = role !== 'VIEWER';
  return (
    <div className="stack-form">
      {modules.map((m) => (
        <section className="curriculum-module" key={m.id}>
          <h3>
            {m.position + 1}. {m.name}
          </h3>
          {m.lessons.map((l: any) => (
            <details key={l.id}>
              <summary>
                {l.position + 1}. {l.name}
              </summary>
              <p className="preserve-lines">{l.body}</p>
              {l.videoUrl && (
                <a href={l.videoUrl} target="_blank" rel="noreferrer">
                  Open video
                </a>
              )}
            </details>
          ))}
        </section>
      ))}
      {canWrite && (
        <>
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await send(`/workspaces/${workspaceId}/courses/${course.id}/modules`, {
                  name,
                  position: modules.length,
                });
                setName('');
                reload();
              } catch (error) {
                toast((error as Error).message, true);
              }
            }}
          >
            <input
              aria-label="Module name"
              placeholder="Module name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button variant="secondary">Add module</Button>
          </form>
          {modules.length > 0 && (
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await send(
                    `/workspaces/${workspaceId}/courses/modules/${lesson.moduleId}/lessons`,
                    {
                      name: lesson.name,
                      body: lesson.body,
                      videoUrl: lesson.videoUrl || null,
                      position: modules.find((m) => m.id === lesson.moduleId)?.lessons.length || 0,
                    },
                  );
                  setLesson({ ...lesson, name: '', body: '', videoUrl: '' });
                  reload();
                } catch (error) {
                  toast((error as Error).message, true);
                }
              }}
            >
              <h3>Add a lesson</h3>
              <label>
                Module
                <select
                  required
                  value={lesson.moduleId}
                  onChange={(e) => setLesson({ ...lesson, moduleId: e.target.value })}
                >
                  <option value="">Choose module</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Lesson title
                <input
                  required
                  value={lesson.name}
                  onChange={(e) => setLesson({ ...lesson, name: e.target.value })}
                />
              </label>
              <label>
                Lesson text
                <textarea
                  value={lesson.body}
                  onChange={(e) => setLesson({ ...lesson, body: e.target.value })}
                />
              </label>
              <label>
                Video resource URL (HTTPS)
                <input
                  type="url"
                  value={lesson.videoUrl}
                  onChange={(e) => setLesson({ ...lesson, videoUrl: e.target.value })}
                />
              </label>
              <Button>Add lesson</Button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

function StorePayments() {
  const { workspaceId, role } = useWorkspace(),
    toast = useToast();
  const [country, setCountry] = useState(''),
    [busy, setBusy] = useState(false);
  if (role !== 'OWNER') return null;
  return (
    <details className="panel payment-setup">
      <summary>Set up storefront payments</summary>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await send(`/workspaces/${workspaceId}/store/connect-payments`, {
              country: country.toUpperCase(),
            });
            location.assign(r.url);
          } catch (e) {
            toast((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Merchant country code
          <input
            aria-label="Merchant country code"
            placeholder="IN, US, GB…"
            required
            minLength={2}
            maxLength={2}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </label>
        <Button disabled={busy}>Continue to Stripe</Button>
      </form>
      <p>
        Only operator-approved merchant countries are enabled. Returning from onboarding does not
        enable checkout until Stripe confirms charge and payout readiness.
      </p>
    </details>
  );
}
