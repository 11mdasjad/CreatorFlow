'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Crown,
  FileText,
  GraduationCap,
  LifeBuoy,
  MessageCircle,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import { api, date, money } from '@/lib/api';
import { useWorkspace } from './shell';
import { DateRangePicker } from './date-range-picker';
import { DateRange, displayDate } from '@/lib/date-range';

const colors = ['#7047ff', '#ff7097', '#44a3ff', '#c4c9df'];
const titleCase = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());

function PanelTitle({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="studio-panel-title">
      <h2>{title}</h2>
      {href ? (
        <Link href={href}>
          View all <ArrowRight size={13} />
        </Link>
      ) : (
        children
      )}
    </div>
  );
}

function QueryContent({
  query,
  empty,
  children,
}: {
  query: any;
  empty: string;
  children: React.ReactNode;
}) {
  if (query.isPending)
    return (
      <p className="studio-placeholder" role="status">
        Loading…
      </p>
    );
  if (query.error)
    return (
      <div className="studio-placeholder" role="status">
        Couldn’t load this section. <button onClick={() => query.refetch()}>Try again</button>
      </div>
    );
  if (!query.data?.items.length) return <p className="studio-placeholder">{empty}</p>;
  return <>{children}</>;
}

function Sparkline({ values }: { values: number[] }) {
  const id = useId();
  if (!values.length || !values.some(Boolean)) return null;
  const max = Math.max(...values, 1);
  const points = values
    .map((v, i) => `${(i * 104) / Math.max(values.length - 1, 1)},${42 - (v / max) * 37}`)
    .join(' ');
  return (
    <svg className="studio-sparkline" viewBox="0 0 104 46" aria-hidden="true">
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop stopColor="currentColor" stopOpacity=".2" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,46 ${points} 104,46`} fill={`url(#${id})`} />
      <polyline points={points} stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}

function PerformanceChart({ series }: { series: any[] }) {
  const id = useId();
  const [showReplies, setShowReplies] = useState(true);
  const max = Math.max(4, ...series.flatMap((d) => [d.leads, showReplies ? d.messages : 0]));
  const points = (key: string) =>
    series
      .map(
        (d, i) =>
          `${38 + (i * 596) / Math.max(series.length - 1, 1)},${184 - ((d[key] || 0) / max) * 154}`,
      )
      .join(' ');
  return (
    <>
      <div className="studio-chart-legend">
        <span>
          <i />
          New leads
        </span>
        <button
          aria-pressed={showReplies}
          onClick={() => setShowReplies((v) => !v)}
          className={showReplies ? '' : 'legend-off'}
        >
          <i />
          Replies accepted <Check size={11} />
        </button>
      </div>
      <svg
        className="studio-chart"
        viewBox="0 0 660 220"
        role="img"
        aria-label="Daily new leads and replies accepted by Instagram"
      >
        <defs>
          <linearGradient id={id} x2="0" y2="1">
            <stop stopColor="#7047ff" stopOpacity=".19" />
            <stop offset="1" stopColor="#7047ff" stopOpacity=".01" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="38"
              x2="634"
              y1={30 + i * 38.5}
              y2={30 + i * 38.5}
              className="studio-gridline"
            />
            <text x="27" y={34 + i * 38.5} textAnchor="end">
              {Math.round((max * (4 - i)) / 4)}
            </text>
          </g>
        ))}
        {series.length > 1 && (
          <polygon points={`38,184 ${points('leads')} 634,184`} fill={`url(#${id})`} />
        )}
        <polyline
          points={points('leads')}
          fill="none"
          stroke="#7047ff"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {showReplies && (
          <polyline
            points={points('messages')}
            fill="none"
            stroke="#44a3ff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {series.map((d, i) => (
          <g key={d.day}>
            <circle
              cx={38 + (i * 596) / Math.max(series.length - 1, 1)}
              cy={184 - (d.leads / max) * 154}
              r="5"
              fill={series.length === 1 ? '#7047ff' : 'transparent'}
            >
              <title>
                {date(d.day)}: {d.leads} new leads · {d.messages} replies accepted
              </title>
            </circle>
            {(i === 0 ||
              i === series.length - 1 ||
              (i % Math.ceil(series.length / 5) === 0 && i < series.length - 3)) && (
              <text
                x={38 + (i * 596) / Math.max(series.length - 1, 1)}
                y="212"
                textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
              >
                {new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </text>
            )}
          </g>
        ))}
      </svg>
    </>
  );
}

function AudienceSources({ leads }: { leads: any }) {
  const items = leads.data?.items || [];
  const counts: Record<string, number> = {};
  for (const lead of items) {
    const source = lead.source?.trim() || 'Other';
    counts[source] = (counts[source] || 0) + 1;
  }
  const all = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const groups =
    all.length > 4
      ? [
          ...all.slice(0, 3),
          ['Other sources', all.slice(3).reduce((n, [, v]) => n + v, 0)] as [string, number],
        ]
      : all;
  let position = 0;
  const stops = groups.map(([, count], i) => {
    const start = position;
    position += (count / items.length) * 100;
    return `${colors[i]} ${start}% ${position}%`;
  });
  return (
    <section className="studio-panel studio-sources">
      <PanelTitle title="Audience sources" />
      <QueryContent
        query={leads}
        empty="Capture your first lead to discover where your audience comes from."
      >
        <div className="studio-source-content">
          <div
            className="studio-donut"
            role="img"
            aria-label={groups.map(([name, count]) => `${name}: ${count} leads`).join(', ')}
            style={{ background: `conic-gradient(${stops.join(',')})` }}
          >
            <div>
              <strong>{items.length.toLocaleString()}</strong>
              <span>{leads.data?.total > items.length ? 'Recent leads' : 'Total leads'}</span>
            </div>
          </div>
          <ul className="studio-source-legend">
            {groups.map(([name, count], i) => (
              <li key={name}>
                <i style={{ background: colors[i] }} />
                <span title={name}>{name}</span>
                <strong>{Math.round((count / items.length) * 100)}%</strong>
              </li>
            ))}
          </ul>
        </div>
        <p className="studio-note">
          {leads.data?.total > items.length
            ? `Based on the latest ${items.length} of ${leads.data.total.toLocaleString()} leads`
            : 'Across all your leads'}{' '}
          · all time
        </p>
      </QueryContent>
    </section>
  );
}

function PlanCard({ workspaceId, role }: { workspaceId: string; role: string }) {
  const allowed = ['OWNER', 'ADMIN'].includes(role);
  const billing = useQuery({
    queryKey: ['billing', workspaceId],
    queryFn: () => api(`/workspaces/${workspaceId}/billing`),
    enabled: allowed,
  });
  const subscription = billing.data?.subscription;
  const limit = subscription?.plan.limits?.leads;
  const used = billing.data?.usage.find((u: any) => u.metric === 'leads')?.count || 0;
  return (
    <section className="studio-panel studio-plan">
      <PanelTitle title="Your plan">
        <Crown size={19} />
      </PanelTitle>
      {!allowed ? (
        <p className="studio-placeholder">Your workspace owner manages your plan.</p>
      ) : billing.isPending ? (
        <p className="studio-placeholder">Loading your plan…</p>
      ) : billing.error ? (
        <p className="studio-placeholder">
          Plan unavailable. <button onClick={() => billing.refetch()}>Try again</button>
        </p>
      ) : (
        <>
          <div className="studio-plan-name">
            <span>{subscription?.plan.name || 'No plan assigned'}</span>
            <small>{titleCase(subscription?.status || 'Inactive')}</small>
          </div>
          {typeof limit === 'number' && (
            <>
              <div className="studio-plan-usage">
                <strong>
                  {used.toLocaleString()} <span>/ {limit.toLocaleString()}</span>
                </strong>
                <span>Leads used</span>
              </div>
              <progress aria-label="Lead allowance used" max={Math.max(1, limit)} value={used} />
            </>
          )}
          <Link href="/app/billing">
            Manage your plan <ArrowRight size={14} />
          </Link>
        </>
      )}
    </section>
  );
}

export function CreatorDashboard({
  data,
  days,
  range,
  setRange,
  name,
  workspaceId,
}: {
  data: any;
  days: number;
  range: DateRange;
  setRange: (range: DateRange) => void;
  name: string;
  workspaceId: string;
}) {
  const { role } = useWorkspace();
  const leads = useQuery({
    queryKey: ['leads', workspaceId, 'dashboard'],
    queryFn: () => api(`/workspaces/${workspaceId}/resources/leads?limit=100`),
  });
  const products = useQuery({
    queryKey: ['products', workspaceId, 'dashboard'],
    queryFn: () => api(`/workspaces/${workspaceId}/resources/products?limit=3`),
  });
  const automations = useQuery({
    queryKey: ['automations', workspaceId, 'dashboard'],
    queryFn: () => api(`/workspaces/${workspaceId}/resources/automations?limit=4`),
  });
  const newLeads = data.series.reduce((n: number, d: any) => n + d.leads, 0);
  const completed = [data.accounts > 0, data.automations > 0, data.leads > 0].filter(
    Boolean,
  ).length;
  const metrics = [
    {
      label: 'Total leads',
      value: data.leads.toLocaleString(),
      icon: Users,
      tone: 'purple',
      detail: `${newLeads} new in this period`,
      period: 'All time',
      values: data.series.map((d: any) => d.leads),
    },
    {
      label: 'Replies accepted',
      value: data.accepted.toLocaleString(),
      icon: Send,
      tone: 'pink',
      detail: 'Delivery unconfirmed',
      period: range.label,
      values: data.series.map((d: any) => d.messages),
    },
    {
      label: 'Product revenue',
      value: data.revenue.length
        ? data.revenue.map((r: any) => money(r._sum.amountMinor || 0, r.currency)).join(' · ')
        : '—',
      icon: ShoppingBag,
      tone: 'mint',
      detail: data.revenue.length ? 'From paid orders' : 'No paid orders yet',
      period: range.label,
      values: [],
    },
    {
      label: 'Active automations',
      value: data.automations.toLocaleString(),
      icon: Workflow,
      tone: 'sky',
      detail: 'Currently switched on',
      period: 'Current',
      values: [],
    },
  ];
  return (
    <div className="creator-overview studio-dashboard">
      <div className="studio-main">
        <div className="studio-welcome">
          <div>
            <span className="studio-eyebrow">YOUR CREATOR WORKSPACE</span>
            <h1>
              Welcome back, {name.split(' ')[0]}.{' '}
              <span className="studio-wave" aria-hidden="true">
                👋
              </span>
            </h1>
            <p>Let’s turn your next connection into an opportunity.</p>
          </div>
          <DateRangePicker value={range} onApply={setRange} timezone={data.timezone} />
        </div>
        <div className="studio-metrics">
          {metrics.map((m) => (
            <section className={`studio-stat studio-tone-${m.tone}`} key={m.label}>
              <span className="studio-stat-icon">
                <m.icon size={24} strokeWidth={1.8} />
              </span>
              <div className="studio-stat-value">
                <h2>{m.label}</h2>
                <strong>{m.value}</strong>
              </div>
              <span className="studio-stat-detail">{m.detail}</span>
              <small>{m.period}</small>
              <Sparkline values={m.values} />
            </section>
          ))}
        </div>
        <div className="studio-chart-row">
          <section className="studio-panel studio-performance">
            <PanelTitle title="Leads & replies overview" />
            <div className="studio-chart-summary">
              <strong>{newLeads.toLocaleString()}</strong>
              <span>
                new leads <small>in this date range</small>
              </span>
            </div>
            <PerformanceChart series={data.series} />
            <div className="studio-chart-footer">
              <span>{data.timezone}</span>
              <span title={`${displayDate(range.startDate)} – ${displayDate(range.endDate)}`}>
                {displayDate(range.startDate)} – {displayDate(range.endDate)}
              </span>
            </div>
          </section>
          <AudienceSources leads={leads} />
        </div>
        <div className="studio-lower-grid">
          <section className="studio-panel studio-quick">
            <PanelTitle title="Quick actions" />
            <div className="studio-action-grid">
              {[
                {
                  title: 'Create automation',
                  href: '/app/automations?new=1',
                  icon: Send,
                  tone: 'pink',
                },
                { title: 'View leads', href: '/app/leads', icon: Users, tone: 'purple' },
                { title: 'Add product', href: '/app/store', icon: ShoppingBag, tone: 'mint' },
                { title: 'Create lead form', href: '/app/forms', icon: FileText, tone: 'sky' },
              ].map((a) => (
                <Link className={`studio-action studio-tone-${a.tone}`} href={a.href} key={a.title}>
                  <span>
                    <a.icon size={22} />
                  </span>
                  <strong>{a.title}</strong>
                  <ArrowRight size={15} />
                </Link>
              ))}
            </div>
          </section>
          <section className="studio-panel studio-products">
            <PanelTitle title="Your products" href="/app/store" />
            <QueryContent
              query={products}
              empty="Your next big idea belongs here. Add your first digital product."
            >
              <div className="studio-item-list">
                {products.data?.items.map((p: any, i: number) => (
                  <Link href="/app/store" key={p.id} className="studio-product-row">
                    <span className={`studio-product-art product-art-${i}`}>
                      {p.kind === 'COURSE' ? (
                        <GraduationCap size={23} />
                      ) : (
                        <ShoppingBag size={23} />
                      )}
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.published ? 'Published' : 'Draft'} ·{' '}
                        {p.kind === 'COURSE' ? 'Course' : 'Download'}
                      </small>
                    </span>
                    <b>{money(p.priceMinor, p.currency)}</b>
                  </Link>
                ))}
              </div>
            </QueryContent>
          </section>
          <section className="studio-panel studio-leads">
            <PanelTitle title="Recent leads" href="/app/leads" />
            <QueryContent
              query={leads}
              empty="No leads yet. Create a lead form to start growing your audience."
            >
              <div className="studio-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.data?.items.slice(0, 5).map((lead: any, i: number) => (
                      <tr key={lead.id}>
                        <td>
                          <Link href={`/app/leads?search=${encodeURIComponent(lead.email)}`}>
                            <span className={`studio-initial initial-${i % 3}`}>
                              {lead.name.charAt(0).toUpperCase()}
                            </span>
                            <span>{lead.name}</span>
                          </Link>
                        </td>
                        <td>{lead.source}</td>
                        <td>
                          <span className={`studio-status status-${lead.status.toLowerCase()}`}>
                            {titleCase(lead.status)}
                          </span>
                        </td>
                        <td>
                          <time dateTime={lead.createdAt}>{date(lead.createdAt)}</time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </QueryContent>
          </section>
          <section className="studio-panel studio-automations">
            <PanelTitle title="Your automations" href="/app/automations" />
            <QueryContent
              query={automations}
              empty="Start with a simple conversation. Create your first automation."
            >
              <div className="studio-item-list">
                {automations.data?.items.map((a: any) => (
                  <Link href="/app/automations" className="studio-automation-row" key={a.id}>
                    <span className="studio-flow-icon">
                      <Send size={18} />
                    </span>
                    <span>
                      <strong>{a.name}</strong>
                      <small>
                        {a.keywords?.length ? a.keywords.join(', ') : titleCase(a.trigger)}
                      </small>
                    </span>
                    <span className={`studio-state state-${a.status.toLowerCase()}`}>
                      <i />
                      {titleCase(a.status)}
                    </span>
                  </Link>
                ))}
              </div>
            </QueryContent>
          </section>
        </div>
        <section className="studio-launch">
          <div className="studio-launch-icon">
            <Sparkles size={24} />
          </div>
          <div>
            <h2>A little setup. A lot of possibility.</h2>
            <p>{completed} of 3 steps complete — build your business at your own pace.</p>
          </div>
          <div className="studio-launch-links">
            {[
              { label: 'Connect Instagram', done: data.accounts > 0, href: 'social-accounts' },
              { label: 'Activate a flow', done: data.automations > 0, href: 'automations' },
              { label: 'Capture a lead', done: data.leads > 0, href: 'forms' },
            ].map((step) => (
              <Link
                href={`/app/${step.href}`}
                key={step.href}
                className={step.done ? 'is-done' : ''}
              >
                {step.done ? <Check size={13} /> : <Plus size={13} />}
                {step.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
      <aside className="studio-rail" aria-label="Workspace updates">
        <section className="studio-panel studio-activity">
          <PanelTitle title="Recent activity">
            <Activity size={17} />
          </PanelTitle>
          {data.recent.length ? (
            <div className="studio-activity-list">
              {data.recent.slice(0, 5).map((event: any, i: number) => (
                <div key={event.id}>
                  <span
                    className={`studio-activity-icon studio-tone-${['purple', 'pink', 'sky', 'mint'][i % 4]}`}
                  >
                    {event.action.includes('LEAD') ? (
                      <Users size={19} />
                    ) : event.action.includes('PRODUCT') ? (
                      <ShoppingBag size={19} />
                    ) : event.action.includes('AUTOMATION') ? (
                      <Send size={19} />
                    ) : (
                      <Activity size={19} />
                    )}
                  </span>
                  <span>
                    <strong>{titleCase(event.action.replaceAll('.', ' '))}</strong>
                    <time dateTime={event.createdAt}>{date(event.createdAt)}</time>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="studio-placeholder">Your latest workspace activity will appear here.</p>
          )}
        </section>
        <PlanCard workspaceId={workspaceId} role={role} />
        <section className="studio-panel studio-help">
          <PanelTitle title="A little help goes a long way" />
          <div>
            <span>
              <LifeBuoy size={25} />
            </span>
            <p>Have a question? Get help with your workspace and next steps.</p>
          </div>
          <Link href="/app/support">
            Get support <ArrowRight size={14} />
          </Link>
        </section>
        <section className="studio-promo">
          <Image
            src="/images/creator-portrait.png"
            alt=""
            fill
            sizes="(max-width: 760px) 100vw, 280px"
          />
          <div>
            <span>MADE FOR YOUR NEXT CHAPTER</span>
            <h2>Turn your audience into customers.</h2>
            <Link href="/app/social-accounts">
              Connect Instagram <ArrowUpRight size={14} />
            </Link>
          </div>
          <Sparkles className="studio-promo-spark" size={25} />
        </section>
      </aside>
    </div>
  );
}
