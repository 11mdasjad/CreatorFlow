'use client';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Activity,
  LifeBuoy,
  Settings,
  ArrowLeft,
  Plus,
  LogOut,
} from 'lucide-react';
import { api, send, date, ApiError } from '@/lib/api';
import { Logo, PageHeading, Loading, ErrorState, Badge, Empty } from './shared';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { useToast } from './providers';
export function AdminPanel({ section = 'overview' }: { section?: string }) {
  const router = useRouter();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me'), staleTime: 0 });
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
    if (me.data && !me.data.user.isSuperAdmin) router.replace('/app');
    else if (me.data && !me.data.user.verifiedAt) router.replace('/login');
  }, [me.data, me.error, router]);
  if (me.error && !(me.error instanceof ApiError && me.error.status === 401))
    return <ErrorState error={me.error} retry={() => me.refetch()} />;
  if (!me.data?.user.isSuperAdmin || !me.data.user.verifiedAt) return <Loading />;
  return <AuthorizedAdminPanel section={section} user={me.data.user} />;
}
function AuthorizedAdminPanel({
  section,
  user,
}: {
  section: string;
  user: { name: string; email: string };
}) {
  const toast = useToast();
  const client = useQueryClient();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  async function logout() {
    setSigningOut(true);
    try {
      await send('/auth/logout', {});
      await client.cancelQueries();
      client.clear();
      localStorage.removeItem('creatorflow-workspace');
      window.location.replace('/login');
    } catch (e) {
      toast((e as Error).message, true);
      setSigningOut(false);
    }
  }
  const [search, setSearch] = useState(''),
    [edit, setEdit] = useState<any>(null),
    [json, setJson] = useState(''),
    [password, setPassword] = useState(''),
    [key, setKey] = useState(''),
    [reply, setReply] = useState('');
  const q = useQuery({
    queryKey: ['admin', section, search],
    queryFn: () =>
      api(`/admin/${section}${section === 'users' ? `?search=${encodeURIComponent(search)}` : ''}`),
  });
  const sections = [
    { slug: 'overview', label: 'Platform overview', icon: LayoutDashboard },
    { slug: 'users', label: 'Users', icon: Users },
    { slug: 'workspaces', label: 'Workspaces', icon: Building2 },
    { slug: 'plans', label: 'Plans & subscriptions', icon: CreditCard },
    { slug: 'monitoring', label: 'Integration health', icon: Activity },
    { slug: 'support', label: 'Support', icon: LifeBuoy },
    { slug: 'settings', label: 'Platform settings', icon: Settings },
  ];
  useEffect(() => {
    if (q.error instanceof ApiError && [401, 403].includes(q.error.status)) {
      client.removeQueries({ queryKey: ['admin'] });
      router.replace('/login');
    }
  }, [q.error, client, router]);
  async function mutate() {
    try {
      if (section === 'plans') {
        const data = JSON.parse(json);
        await api('/admin/plans', {
          method: 'POST',
          body: JSON.stringify({ ...data, password }),
          headers: { 'x-admin-action-key': key },
        });
      } else if (section === 'users' || section === 'workspaces') {
        await api(`/admin/${section}/${edit.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ password, suspended: !edit.suspendedAt }),
          headers: { 'x-admin-action-key': key },
        });
      } else if (section === 'support')
        await send(`/admin/support/${edit.id}`, { response: reply, status: 'RESOLVED' }, 'PATCH');
      else if (section === 'settings') {
        const data = JSON.parse(json);
        await api('/admin/settings', {
          method: 'POST',
          body: JSON.stringify({ ...data, password }),
          headers: { 'x-admin-action-key': key },
        });
      }
      setEdit(null);
      setPassword('');
      setKey('');
      q.refetch();
      toast('Platform change saved and audited');
    } catch (e) {
      toast((e as Error).message, true);
    }
  }
  return (
    <div className="admin-layout">
      <aside>
        <Link href="/">
          <Logo />
        </Link>
        <div className="admin-label">
          <ShieldCheck size={17} />
          PLATFORM ADMIN
        </div>
        <nav>
          {sections.map((s) => (
            <Link
              key={s.slug}
              href={s.slug === 'overview' ? '/admin' : `/admin/${s.slug}`}
              className={section === s.slug ? 'active' : ''}
            >
              <s.icon size={18} />
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="admin-identity">
          <strong>{user.name}</strong>
          <small>{user.email}</small>
        </div>
        <Button variant="secondary" onClick={logout} disabled={signingOut}>
          <LogOut size={16} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
        <Link className="back-link" href="/">
          <ArrowLeft size={15} />
          Back to website
        </Link>
      </aside>
      <main id="main-content">
        <PageHeading
          eyebrow="ADMIN PORTAL"
          title={sections.find((s) => s.slug === section)?.label || 'Platform'}
          description="Platform visibility with explicit authorization and an audit trail."
          action={
            ['plans', 'settings'].includes(section) && (
              <Button
                onClick={() => {
                  setEdit({});
                  setJson(
                    JSON.stringify(
                      section === 'plans'
                        ? {
                            name: 'New plan',
                            description: '',
                            priceMinor: null,
                            currency: 'INR',
                            published: false,
                            stripePriceId: null,
                            limits: {
                              accounts: 1,
                              automations: 3,
                              executions: 100,
                              leads: 100,
                              team: 3,
                              workflows: 3,
                            },
                            features: [],
                          }
                        : { key: 'maintenanceBanner', value: '' },
                      null,
                      2,
                    ),
                  );
                }}
              >
                <Plus size={16} />
                Add configuration
              </Button>
            )
          }
        />
        {section === 'users' && (
          <input
            className="admin-search"
            aria-label="Search users"
            placeholder="Search email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}{' '}
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : section === 'overview' ? (
          <>
            <div className="metric-grid">
              {[
                ['Registered users', q.data.users],
                ['Workspaces', q.data.workspaces],
                ['Active subscriptions', q.data.subscriptions],
                ['Automation errors', q.data.errors],
              ].map(([label, value]) => (
                <div className="metric-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <div className="info-strip">
              Worker heartbeat:{' '}
              {q.data.workerHeartbeat || 'Not available — start the Redis worker to process jobs.'}
            </div>
            <section className="panel">
              <div className="panel-heading">
                <h3>Audit trail</h3>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Actor</th>
                      <th>Workspace</th>
                      <th>Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.audits.map((a: any) => (
                      <tr key={a.id}>
                        <td>{a.action}</td>
                        <td>{a.actorId}</td>
                        <td>{a.workspaceId || 'Platform'}</td>
                        <td>{date(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : section === 'monitoring' ? (
          <div className="monitoring-grid">
            {Object.entries(q.data).map(([key, value]) => (
              <section className="panel" key={key}>
                <h3>{key}</h3>
                {Array.isArray(value) && value.length ? (
                  <pre>{JSON.stringify(value, null, 2)}</pre>
                ) : (
                  <Empty title="No records" description="Events will appear here when recorded." />
                )}
              </section>
            ))}
          </div>
        ) : (
          <section className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{section === 'settings' ? 'Setting' : 'Name'}</th>
                    <th>Details</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data.map((row: any) => (
                    <tr key={row.id || row.key}>
                      <td>
                        <strong>{row.name || row.subject || row.key}</strong>
                      </td>
                      <td>
                        {row.email ||
                          row.description ||
                          row.body ||
                          JSON.stringify(row.value || row._count || {})}
                      </td>
                      <td>
                        <Badge tone={row.suspendedAt ? 'red' : 'neutral'}>
                          {row.suspendedAt
                            ? 'Suspended'
                            : row.status ||
                              ('published' in row
                                ? row.published
                                  ? 'Published'
                                  : 'Draft'
                                : 'Active')}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEdit(row);
                            if (section === 'plans') {
                              const {
                                id,
                                name,
                                description,
                                priceMinor,
                                currency,
                                published,
                                stripePriceId,
                                limits,
                                features,
                              } = row;
                              setJson(
                                JSON.stringify(
                                  {
                                    id,
                                    name,
                                    description,
                                    priceMinor,
                                    currency,
                                    published,
                                    stripePriceId,
                                    limits,
                                    features,
                                  },
                                  null,
                                  2,
                                ),
                              );
                            }
                            if (section === 'settings')
                              setJson(JSON.stringify({ key: row.key, value: row.value }, null, 2));
                          }}
                        >
                          {section === 'users' || section === 'workspaces'
                            ? row.suspendedAt
                              ? 'Reactivate'
                              : 'Suspend'
                            : section === 'support'
                              ? 'Reply'
                              : 'Edit'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!q.data.length && (
              <Empty
                title="Nothing to review yet"
                description="New platform records will appear here."
              />
            )}
          </section>
        )}
        <Modal
          open={!!edit}
          onOpenChange={() => setEdit(null)}
          title={section === 'support' ? 'Resolve support ticket' : 'Review privileged change'}
          description={
            section === 'support'
              ? 'Your response is visible in the workspace.'
              : 'Your password and the server’s privileged-action key are required. This change is audited.'
          }
          wide
        >
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              mutate();
            }}
          >
            {['plans', 'settings'].includes(section) && (
              <label>
                Configuration JSON
                <textarea
                  className="json-editor"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                />
              </label>
            )}
            {section === 'support' ? (
              <label>
                Response
                <textarea required value={reply} onChange={(e) => setReply(e.target.value)} />
              </label>
            ) : (
              <>
                <label>
                  Your password
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Privileged action key
                  <input
                    type="password"
                    required
                    autoComplete="off"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                  />
                </label>
              </>
            )}
            <Button>Apply change</Button>
          </form>
        </Modal>
      </main>
    </div>
  );
}
