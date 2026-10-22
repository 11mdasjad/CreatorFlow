'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowRight,
  Users,
  MessageCircle,
  Workflow,
  ShoppingBag,
  Plus,
  Check,
  MousePointer2,
  Download,
  Activity,
  CalendarDays,
  Sparkles,
} from 'lucide-react';
import { api, money, date } from '@/lib/api';
import { Button } from './ui/button';
import { Badge, Empty, Loading, ErrorState, PageHeading } from './shared';
import { CreatorDashboard } from './creator-dashboard';
import { useWorkspace } from './shell';
import { DateRange, presetRange, todayInZone } from '@/lib/date-range';
const emptyData = {
  leads: 0,
  accounts: 0,
  automations: 0,
  accepted: 0,
  failed: 0,
  attempts: 0,
  successRate: null,
  revenue: [],
  recent: [],
  series: [],
  timezone: 'Asia/Kolkata',
  days: 30,
};
export function MetricCards({ data = emptyData, days = 30 }: { data?: any; days?: number }) {
  return (
    <div className="metric-grid">
      {[
        {
          name: 'Total leads',
          value: data.leads,
          icon: Users,
          tone: 'violet',
          detail: 'People in your audience CRM',
          period: 'All time',
        },
        {
          name: 'Replies accepted',
          value: data.accepted,
          icon: MessageCircle,
          tone: 'blue',
          detail: 'Accepted by Instagram; delivery unconfirmed',
          period: `Last ${days} days`,
        },
        {
          name: 'Active automations',
          value: data.automations,
          icon: Workflow,
          tone: 'amber',
          detail: 'Automations currently switched on',
          period: 'Current',
        },
        {
          name: 'Product revenue',
          value: data.revenue.length
            ? data.revenue.map((r: any) => money(r._sum.amountMinor || 0, r.currency)).join(' · ')
            : '—',
          icon: ShoppingBag,
          tone: 'green',
          detail: data.revenue.length ? 'Verified paid orders' : 'No paid orders in this period',
          period: `Last ${days} days`,
        },
      ].map((item) => (
        <div className={`metric-card metric-${item.tone}`} key={item.name}>
          <div className="metric-top">
            <span>{item.name}</span>
            <span className={`icon-tile ${item.tone}`}>
              <item.icon size={17} />
            </span>
          </div>
          <strong>
            {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
          </strong>
          <small>{item.detail}</small>
          <span className="metric-period">{item.period}</span>
        </div>
      ))}
    </div>
  );
}
function Chart({ series = [], compact = false }: { series?: any[]; compact?: boolean }) {
  const gradientId = useId();
  const max = Math.max(4, ...series.map((d) => d.leads));
  const points = series
    .map(
      (d, i) => `${40 + i * (720 / Math.max(1, series.length - 1))},${180 - (d.leads / max) * 140}`,
    )
    .join(' ');
  const hasData = series.some((d) => d.leads);
  return (
    <div className={`chart ${compact ? 'chart-compact' : ''}`}>
      <svg
        viewBox="0 0 800 220"
        role="img"
        aria-label={hasData ? 'Lead growth by date' : 'No lead growth data yet'}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="40"
              y1={40 + i * 35}
              x2="770"
              y2={40 + i * 35}
              stroke="currentColor"
              className="chart-grid"
              strokeDasharray="3 5"
            />
            <text x="10" y={44 + i * 35} className="chart-label">
              {Math.round((max * (4 - i)) / 4)}
            </text>
          </g>
        ))}
        {hasData && (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8775f5" stopOpacity=".28" />
                <stop offset="100%" stopColor="#8775f5" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`40,180 ${points} 760,180`} fill={`url(#${gradientId})`} />
            <polyline
              points={points}
              fill="none"
              stroke="#8570ef"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </>
        )}
        {series.map((d, i) => {
          const x = 40 + i * (720 / Math.max(1, series.length - 1));
          const showLabel =
            i === 0 ||
            i === series.length - 1 ||
            (i % Math.max(1, Math.floor(series.length / 4)) === 0 && i < series.length - 3);
          return (
            <g key={d.day}>
              {hasData && (
                <circle
                  cx={x}
                  cy={180 - (d.leads / max) * 140}
                  r={d.leads ? 4 : 2}
                  fill="#6b5aeb"
                  stroke="var(--surface)"
                  strokeWidth="2"
                >
                  <title>
                    {d.day}: {d.leads} new leads
                  </title>
                </circle>
              )}
              {showLabel && (
                <text
                  x={x}
                  y="213"
                  textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'}
                  className="chart-label"
                >
                  {new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {!hasData && (
        <div className="chart-empty">
          <span className="chart-empty-dot" />
          <strong>Your next chapter starts here</strong>
          <span>Capture your first lead to see your growth.</span>
        </div>
      )}
    </div>
  );
}
export function ProductPreview() {
  return (
    <div className="product-preview">
      <div className="preview-sidebar">
        <div className="preview-workspace">
          A
          <span>
            Your workspace<small>Creator account</small>
          </span>
        </div>
        {[
          ['Overview', Activity],
          ['Automations', Workflow],
          ['Leads', Users],
          ['Store', ShoppingBag],
        ].map(([name, Icon]: any, i) => (
          <span key={name} className={i === 0 ? 'active' : ''}>
            <Icon size={15} />
            {name}
          </span>
        ))}
      </div>
      <div className="preview-body">
        <div className="preview-title">
          <div>
            <small>YOUR CREATOR WORKSPACE</small>
            <h3>A little less busy. A lot more flow.</h3>
          </div>
          <Badge tone="violet">Product preview</Badge>
        </div>
        <MetricCards />
        <div className="panel">
          <div className="panel-heading">
            <strong>Audience growth</strong>
            <span className="muted">Last 30 days</span>
          </div>
          <Chart compact />
        </div>
      </div>
    </div>
  );
}
export function Overview({
  workspaceId,
  name,
  analytics = false,
}: {
  workspaceId: string;
  name: string;
  analytics?: boolean;
}) {
  const [days, setDays] = useState(30);
  const { workspace } = useWorkspace();
  const timezone = workspace.timezone || 'Asia/Kolkata';
  const [selection, setSelection] = useState<{ workspaceId: string; range: DateRange } | null>(
    null,
  );
  const range =
    selection?.workspaceId === workspaceId
      ? selection.range
      : presetRange('last30', todayInZone(timezone));
  const query = useQuery({
    queryKey: [
      'analytics',
      workspaceId,
      analytics ? days : range.startDate,
      analytics ? '' : range.endDate,
    ],
    queryFn: () =>
      api(
        `/workspaces/${workspaceId}/analytics?${analytics ? `days=${days}` : `startDate=${range.startDate}&endDate=${range.endDate}`}`,
      ),
  });
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const data = query.data;
  if (!analytics)
    return (
      <CreatorDashboard
        data={data}
        days={data.days}
        range={range}
        setRange={(range) => setSelection({ workspaceId, range })}
        name={name}
        workspaceId={workspaceId}
      />
    );
  const completed = [data.accounts > 0, data.automations > 0, data.leads > 0].filter(
    Boolean,
  ).length;
  const newLeads = data.series.reduce((total: number, day: any) => total + day.leads, 0);
  return (
    <div className="creator-overview">
      <PageHeading
        eyebrow={analytics ? 'UNDERSTAND YOUR MOMENTUM' : 'WORKSPACE OVERVIEW'}
        title={analytics ? 'Every connection counts.' : `Welcome back, ${name.split(' ')[0]}.`}
        description={
          analytics
            ? 'Clear signals from your real activity. No vanity metrics.'
            : 'Here’s how your creator business is doing.'
        }
        action={
          <div className="heading-actions">
            <label className="select-button">
              <CalendarDays size={15} />
              <select
                aria-label="Date range"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </label>
            <Button asChild>
              <Link href="/app/automations?new=1">
                <Plus size={16} />
                Create automation
              </Link>
            </Button>
          </div>
        }
      />
      <MetricCards data={data} days={days} />
      {!analytics && (
        <section className="dashboard-next-step">
          <div className="next-step-symbol">
            <Sparkles size={27} />
          </div>
          <div className="next-step-copy">
            <span>YOUR NEXT STEP</span>
            <h2>
              {data.accounts
                ? 'Make your next connection count.'
                : 'Turn conversations into connections.'}
            </h2>
            <p>
              {data.accounts
                ? 'Give your audience a simple way to reach you with a lead form.'
                : 'Connect Instagram to start building your first conversation flow.'}
            </p>
          </div>
          <Link href={data.accounts ? '/app/forms' : '/app/social-accounts'}>
            {data.accounts ? 'Create a lead form' : 'Connect Instagram'}
            <ArrowUpRight size={17} />
          </Link>
        </section>
      )}
      <div className="dashboard-grid">
        <section className="panel growth-panel">
          <div className="panel-heading">
            <div>
              <h3>Audience growth</h3>
              <p>New leads captured over the last {days} days.</p>
            </div>
            <Badge tone="violet">● Leads</Badge>
          </div>
          <div className="growth-summary">
            <strong>{newLeads.toLocaleString()}</strong>
            <span>new leads this period</span>
            <Link href="/app/leads">
              View leads <ArrowUpRight size={14} />
            </Link>
          </div>
          <Chart series={data.series} />
          <div className="panel-foot">
            Recorded in {data.timezone}
            <span>{days}-day view</span>
          </div>
        </section>
        <section className="panel launch-panel">
          <div className="panel-heading">
            <div>
              <h3>Your launch checklist</h3>
              <p>
                {completed === 3
                  ? 'You’re ready to grow.'
                  : `${3 - completed} steps to build your foundation.`}
              </p>
            </div>
            <span className="setup-count">
              {completed}
              <span>/3</span>
            </span>
          </div>
          <div
            className="setup-progress"
            role="progressbar"
            aria-label="Launch checklist completed"
            aria-valuemin={0}
            aria-valuemax={3}
            aria-valuenow={completed}
          >
            <span style={{ width: `${(completed / 3) * 100}%` }} />
          </div>
          <div className="checklist">
            {[
              {
                done: data.accounts > 0,
                title: 'Connect Instagram',
                text: 'Bring your conversations together',
                href: 'social-accounts',
              },
              {
                done: data.automations > 0,
                title: 'Activate an automation',
                text: 'Connect your account, then publish a flow',
                href: 'automations',
              },
              {
                done: data.leads > 0,
                title: 'Capture your first lead',
                text: 'Start building an audience you own',
                href: 'forms',
              },
            ].map((step, i) => (
              <Link key={step.title} href={`/app/${step.href}`}>
                <span className={step.done ? 'step done' : 'step'}>
                  {step.done ? <Check size={14} /> : i + 1}
                </span>
                <div>
                  <strong>{step.title}</strong>
                  <small>{step.text}</small>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
          <div className="checklist-note">
            <span>✦</span> Build at your own pace. Your progress is saved.
          </div>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent activity</h3>
              <p>The latest in your workspace.</p>
            </div>
            <Activity size={18} />
          </div>
          {data.recent.length ? (
            <div className="activity-list">
              {data.recent.slice(0, 5).map((event: any) => (
                <div key={event.id}>
                  <span className="event-icon">
                    <Activity size={16} />
                  </span>
                  <div>
                    <strong>{event.action.toLowerCase().replaceAll('_', ' ')}</strong>
                    <small>{date(event.createdAt)}</small>
                  </div>
                  <span className="activity-status">
                    Saved <Check size={12} />
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="A fresh start"
              description="Your workspace activity will appear here as you create."
            />
          )}
        </section>
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h3>Quick actions</h3>
              <p>Your most useful tools, one click away.</p>
            </div>
            <ArrowUpRight size={18} />
          </div>
          {[
            {
              icon: MousePointer2,
              title: 'Create a lead form',
              text: 'Collect details from your audience',
              href: 'forms',
            },
            {
              icon: Download,
              title: 'Share a lead magnet',
              text: 'Offer a useful download',
              href: 'lead-magnets',
            },
            {
              icon: ShoppingBag,
              title: 'Build your storefront',
              text: 'Manage your digital products',
              href: 'store',
            },
          ].map((a) => (
            <Link className="quick-link" key={a.title} href={`/app/${a.href}`}>
              <span className="icon-tile violet">
                <a.icon size={18} />
              </span>
              <div>
                <strong>{a.title}</strong>
                <small>{a.text}</small>
              </div>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>
      </div>
      {analytics && (
        <section className="panel definitions">
          <h3>What these numbers mean</h3>
          <p>
            Replies: {data.accepted} API accepted · {data.failed} failed · {data.attempts}{' '}
            attempted. Success rate:{' '}
            {data.successRate === null ? 'Not enough data' : `${data.successRate}%`}.
          </p>
          <p>
            API acceptance does not confirm delivery or reading. Revenue includes verified paid
            orders and is grouped by currency. Trial and draft activity is never presented as live
            delivery.
          </p>
        </section>
      )}
    </div>
  );
}
