'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Camera as Instagram,
  ArrowUpRight,
  Link2,
  Unplug,
  Check,
  Users,
  Plus,
  Download,
  ShieldCheck,
  Mail,
  Cloud,
  Wallet,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from './shell';
import { api, send, date, money } from '@/lib/api';
import { useToast } from './providers';
import { PageHeading, Loading, ErrorState, Empty, Badge } from './shared';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
export function Connections() {
  const { workspaceId, role } = useWorkspace(),
    toast = useToast();
  const q = useQuery({
    queryKey: ['connections', workspaceId],
    queryFn: () => api(`/workspaces/${workspaceId}/integrations`),
  });
  const [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<any>(null),
    [media, setMedia] = useState<any>(null);
  return (
    <>
      <PageHeading
        eyebrow="YOUR TOOLS, IN GOOD COMPANY"
        title="Bring your world together."
        description="Secure connections. Clear permissions. You stay in control."
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => q.refetch()} />
      ) : (
        <>
          <section className="connection-hero panel">
            <span className="instagram-tile">
              <Instagram size={36} />
            </span>
            <div>
              <div className="connection-title">
                <h2>Instagram</h2>
                <Badge tone={q.data.accounts.length ? 'green' : 'neutral'}>
                  {q.data.accounts.length ? 'Connected' : 'Not connected'}
                </Badge>
              </div>
              <p>Turn eligible comments into useful conversations through the official Meta API.</p>
              <div className="connection-perks">
                <span>
                  <Check size={14} />
                  Professional accounts
                </span>
                <span>
                  <Check size={14} />
                  Encrypted access tokens
                </span>
                <span>
                  <Check size={14} />
                  No password sharing
                </span>
              </div>
            </div>
            <Button
              disabled={busy || !['OWNER', 'ADMIN'].includes(role)}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await send(
                    `/workspaces/${workspaceId}/integrations/instagram/connect`,
                    {},
                  );
                  location.assign(r.url);
                } catch (e) {
                  toast((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Link2 size={16} />
              {busy ? 'Connecting…' : 'Connect Instagram'}
            </Button>
          </section>
          {!q.data.instagram.configured && (
            <div className="setup-note">
              <ShieldCheck size={21} />
              <div>
                <strong>Connection setup is required</strong>
                <p>
                  The deployment needs a Meta app, supported Graph API version, encrypted-token key,
                  and approved permissions. Your dashboard will never claim a successful connection
                  without Meta authorization.
                </p>
              </div>
            </div>
          )}
          {q.data.accounts.map((a: any) => (
            <div className="panel account-card" key={a.id}>
              <Instagram size={24} />
              <div>
                <h3>@{a.username}</h3>
                <p>
                  Token expires {date(a.expiresAt)} · Webhook{' '}
                  {a.webhookSubscribed ? 'subscribed' : 'needs attention'}
                </p>
                {a.diagnostic && <p className="form-error">{a.diagnostic}</p>}
              </div>
              <Badge tone={a.status === 'CONNECTED' ? 'green' : 'amber'}>{a.status}</Badge>
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    setMedia(
                      await api(`/workspaces/${workspaceId}/integrations/instagram/${a.id}/media`),
                    );
                  } catch (e) {
                    toast((e as Error).message, true);
                  }
                }}
              >
                View media
              </Button>
              <Button
                variant="ghost"
                disabled={!['OWNER', 'ADMIN'].includes(role)}
                onClick={() => setDeleting(a)}
              >
                <Unplug size={16} />
                Disconnect
              </Button>
            </div>
          ))}
          <h2 className="section-title">The rest of your toolkit</h2>
          <div className="integration-grid">
            {[
              {
                name: 'File storage',
                icon: Cloud,
                text: 'Private files and short-lived download links.',
                configured: q.data.storage.configured,
              },
              {
                name: 'Stripe',
                icon: Wallet,
                text: 'Verified payments, with merchant readiness checks.',
                configured: q.data.stripe.configured && q.data.stripe.enabled,
              },
              {
                name: 'Transactional email',
                icon: Mail,
                text: q.data.email.live
                  ? 'Provider configured; delivery is recorded by the worker.'
                  : 'Local outbox only. No email has been sent externally.',
                configured: q.data.email.live,
              },
            ].map((i) => (
              <section className="panel integration-card" key={i.name}>
                <span className="icon-tile violet">
                  <i.icon size={23} />
                </span>
                <h3>{i.name}</h3>
                <p>{i.text}</p>
                <Badge tone={i.configured ? 'green' : 'neutral'}>
                  {i.configured ? 'Configured' : 'Not configured'}
                </Badge>
              </section>
            ))}
          </div>
        </>
      )}
      <Modal
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Disconnect Instagram?"
        description="Automations for this account will be paused and its local access token will be removed."
      >
        <Button
          variant="danger"
          onClick={async () => {
            try {
              await api(`/workspaces/${workspaceId}/integrations/instagram/${deleting.id}`, {
                method: 'DELETE',
              });
              setDeleting(null);
              q.refetch();
              toast('Account disconnected');
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        >
          Disconnect account
        </Button>
      </Modal>
      <Modal
        open={!!media}
        onOpenChange={() => setMedia(null)}
        title="Available Instagram media"
        description="Use an eligible post or reel ID in your automation."
      >
        {media?.data?.map((m: any) => (
          <div className="note" key={m.id}>
            <strong>{m.media_type}</strong>
            <p>{m.caption || 'Untitled media'}</p>
            <code>{m.id}</code>
            <a href={m.permalink} target="_blank" rel="noreferrer">
              View post
            </a>
          </div>
        ))}
      </Modal>
    </>
  );
}
export function Team() {
  const { workspaceId, role } = useWorkspace(),
    toast = useToast();
  const q = useQuery({
    queryKey: ['team', workspaceId],
    queryFn: () => api(`/workspaces/${workspaceId}/team`),
  });
  const [open, setOpen] = useState(false),
    [email, setEmail] = useState(''),
    [inviteRole, setInviteRole] = useState('EDITOR'),
    [deleting, setDeleting] = useState<any>(null);
  return (
    <>
      <PageHeading
        title="Better, together."
        description="Give your collaborators the right level of access."
        action={
          ['OWNER', 'ADMIN'].includes(role) && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              Invite teammate
            </Button>
          )
        }
      />
      <section className="panel">
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.map((m: any) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.user.name}</strong>
                    </td>
                    <td>{m.user.email}</td>
                    <td>
                      {role === 'OWNER' && m.role !== 'OWNER' ? (
                        <select
                          aria-label={`Role for ${m.user.name}`}
                          value={m.role}
                          onChange={async (e) => {
                            try {
                              await send(
                                `/workspaces/${workspaceId}/team/${m.id}`,
                                { role: e.target.value },
                                'PATCH',
                              );
                              q.refetch();
                              toast('Role updated');
                            } catch (error) {
                              toast((error as Error).message, true);
                            }
                          }}
                        >
                          {['ADMIN', 'EDITOR', 'VIEWER'].map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone="violet">{m.role}</Badge>
                      )}
                    </td>
                    <td>{date(m.createdAt)}</td>
                    <td>
                      {role === 'OWNER' && m.role !== 'OWNER' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${m.user.name}`}
                          onClick={() => setDeleting(m)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="role-guide">
        <h3>A place for everyone. Clear boundaries.</h3>
        <p>
          <strong>Owners</strong> manage billing and the team. <strong>Admins</strong> manage
          workspace settings. <strong>Editors</strong> create and manage content.{' '}
          <strong>Viewers</strong> have read-only access.
        </p>
      </div>
      <Modal open={open} onOpenChange={setOpen} title="Invite a teammate">
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await send(`/workspaces/${workspaceId}/team/invite`, { email, role: inviteRole });
              setOpen(false);
              toast('Invitation queued for email delivery');
            } catch (error) {
              toast((error as Error).message, true);
            }
          }}
        >
          <label>
            Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Role
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {(role === 'OWNER' ? ['ADMIN', 'EDITOR', 'VIEWER'] : ['EDITOR', 'VIEWER']).map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
          </label>
          <Button>Send invitation</Button>
        </form>
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={() => setDeleting(null)}
        title="Remove this teammate?"
        description="Their workspace access will end immediately."
      >
        <Button
          variant="danger"
          onClick={async () => {
            try {
              await api(`/workspaces/${workspaceId}/team/${deleting.id}`, { method: 'DELETE' });
              setDeleting(null);
              q.refetch();
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        >
          Remove teammate
        </Button>
      </Modal>
    </>
  );
}
export function Billing() {
  const { workspaceId, role } = useWorkspace(),
    toast = useToast();
  const q = useQuery({
    queryKey: ['billing', workspaceId],
    queryFn: () => api(`/workspaces/${workspaceId}/billing`),
  });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} />;
  const data = q.data;
  return (
    <>
      <PageHeading
        title="Room for your next chapter."
        description="A clear view of your plan, usage, and billing."
      />
      <section className="panel current-plan">
        <div>
          <div className="eyebrow">YOUR CURRENT PLAN</div>
          <h2>{data.subscription?.plan.name || 'No plan assigned'}</h2>
          <p>
            {data.subscription?.trialEndsAt
              ? `Trial ends ${date(data.subscription.trialEndsAt)}`
              : data.subscription?.plan.priceMinor === 0
                ? 'Your free plan has no expiry. No payment required.'
                : 'Manage your subscription securely through the billing provider.'}
          </p>
        </div>
        <Badge tone="violet">{data.subscription?.status || 'INACTIVE'}</Badge>
        <Button
          variant="secondary"
          disabled={role !== 'OWNER'}
          onClick={async () => {
            try {
              const r = await send(`/workspaces/${workspaceId}/billing/portal`, {});
              location.assign(r.url);
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        >
          Manage billing <ExternalLink size={15} />
        </Button>
      </section>
      {!data.configured && (
        <div className="info-strip">
          Billing is not configured. No payment will be collected. Plan prices are set by the
          platform administrator.
        </div>
      )}
      <div className="usage-grid">
        {Object.entries(data.subscription?.plan.limits || {}).map(([key, value]: any) => (
          <div className="panel usage-card" key={key}>
            <span>{key}</span>
            <strong>
              {data.usage.find((u: any) => u.metric === key)?.count || 0}
              <small> / {value.toLocaleString()}</small>
            </strong>
            <progress
              max={Math.max(value, 1)}
              value={data.usage.find((u: any) => u.metric === key)?.count || 0}
            />
            <small>Monthly metered usage where applicable</small>
          </div>
        ))}
      </div>
      <h2 className="section-title">Find your fit</h2>
      <div className="pricing-grid">
        {data.plans
          .filter((p: any) => p.name !== 'Free Trial')
          .map((p: any) => (
            <section className="panel pricing-card" key={p.id}>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <strong className="plan-price">
                {p.priceMinor === null
                  ? 'Let’s talk'
                  : p.priceMinor === 0
                    ? 'FREE'
                    : `${money(p.priceMinor, p.currency)} / month`}
              </strong>
              <ul>
                {(p.features as string[]).map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="secondary"
                disabled={role !== 'OWNER' || !data.configured || !p.stripePriceId}
                onClick={async () => {
                  try {
                    const r = await send(`/workspaces/${workspaceId}/billing/checkout`, {
                      planId: p.id,
                    });
                    location.assign(r.url);
                  } catch (e) {
                    toast((e as Error).message, true);
                  }
                }}
              >
                Choose {p.name}
              </Button>
            </section>
          ))}
      </div>
    </>
  );
}
export function Settings() {
  const { workspaceId, workspace, user, role } = useWorkspace(),
    toast = useToast(),
    client = useQueryClient();
  const [name, setName] = useState(workspace.name),
    [timezone, setTimezone] = useState(workspace.timezone),
    [displayName, setDisplayName] = useState(user.name),
    [email, setEmail] = useState(user.notificationEmail ?? true),
    [deleting, setDeleting] = useState(false),
    [confirm, setConfirm] = useState('');
  return (
    <>
      <PageHeading
        title="Make yourself at home."
        description="The details that make this workspace yours."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <h3>Workspace details</h3>
          <p>How your team sees this space.</p>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await send(`/workspaces/${workspaceId}/settings`, { name, timezone }, 'PATCH');
                client.invalidateQueries({ queryKey: ['me'] });
                toast('Workspace settings saved');
              } catch (error) {
                toast((error as Error).message, true);
              }
            }}
          >
            <label>
              Workspace name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Timezone
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                required
                list="timezones"
              />
              <datalist id="timezones">
                <option>Asia/Kolkata</option>
                <option>UTC</option>
                <option>America/New_York</option>
                <option>Europe/London</option>
              </datalist>
            </label>
            <Button disabled={!['OWNER', 'ADMIN'].includes(role)}>Save workspace</Button>
          </form>
        </section>
        <section className="panel settings-card">
          <h3>Your profile</h3>
          <p>Personal details and notification preferences.</p>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await send(
                  '/auth/profile',
                  { name: displayName, notificationEmail: email },
                  'PATCH',
                );
                client.invalidateQueries({ queryKey: ['me'] });
                toast('Profile saved');
              } catch (error) {
                toast((error as Error).message, true);
              }
            }}
          >
            <label>
              Display name
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input value={user.email} disabled />
            </label>
            <label className="check-field">
              <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
              Email me optional workspace notifications
            </label>
            <Button>Save profile</Button>
          </form>
        </section>
        <section className="panel settings-card">
          <h3>Data and privacy</h3>
          <p>Export your workspace data or manage your account.</p>
          <Button asChild variant="secondary">
            <a href={`/api/workspaces/${workspaceId}/export`} download="creatorflow-data.json">
              <Download size={16} />
              Export workspace data
            </a>
          </Button>
          <p>
            <Link href="/forgot-password">Reset your password →</Link>
          </p>
          <p>
            <Link href="/privacy">Read the privacy notice →</Link>
          </p>
        </section>
        <section className="panel settings-card danger-zone">
          <h3>Delete workspace</h3>
          <p>
            Permanently delete your workspace and its associated records. Cancel billing and remove
            stored files first.
          </p>
          <Button variant="danger" disabled={role !== 'OWNER'} onClick={() => setDeleting(true)}>
            Delete workspace
          </Button>
        </section>
      </div>
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title="Permanently delete workspace?"
        description="All workspace records will be removed. This cannot be undone."
      >
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await send(`/workspaces/${workspaceId}`, { confirmation: confirm }, 'DELETE');
              client.clear();
              location.assign('/onboarding');
            } catch (error) {
              toast((error as Error).message, true);
            }
          }}
        >
          <label>
            Type DELETE WORKSPACE
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </label>
          <Button variant="danger" disabled={confirm !== 'DELETE WORKSPACE'}>
            Delete permanently
          </Button>
        </form>
      </Modal>
    </>
  );
}
