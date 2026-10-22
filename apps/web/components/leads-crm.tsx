'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  FileText,
  Camera as Instagram,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
  UserCheck,
  X,
} from 'lucide-react';
import { api, date, send } from '@/lib/api';
import { useWorkspace } from './shell';
import { useToast } from './providers';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { Empty, ErrorState, Loading } from './shared';

type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  instagram?: string | null;
  source: string;
  tags: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
};
type LeadPage = { items: Lead[]; pages: number; total: number };
const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'];
const label = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
const initial = {
  name: '',
  email: '',
  phone: '',
  instagram: '',
  source: 'Manual',
  tags: '',
  status: 'NEW',
};
const dayFormatters = new Map<string, Intl.DateTimeFormat>();
function dayKey(value: string | Date, timezone: string) {
  if (!dayFormatters.has(timezone)) {
    dayFormatters.set(
      timezone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    );
  }
  return dayFormatters.get(timezone)!.format(new Date(value));
}
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

// Load every page so source/tag filters, totals and exports never silently use a sample.
async function loadLeads(base: string, signal: AbortSignal): Promise<Lead[]> {
  const first = await api<LeadPage>(`${base}/resources/leads?limit=100`, { signal });
  const rows = [...first.items];
  for (let page = 2; page <= first.pages; page += 3) {
    const pages = await Promise.all(
      Array.from({ length: Math.min(3, first.pages - page + 1) }, (_, i) =>
        api<LeadPage>(`${base}/resources/leads?limit=100&page=${page + i}`, { signal }),
      ),
    );
    rows.push(...pages.flatMap((result) => result.items));
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function leadSeries(leads: Lead[], days: number, timezone: string) {
  const counts = new Map<string, { total: number; converted: number }>();
  for (const lead of leads) {
    const key = dayKey(lead.createdAt, timezone);
    const count = counts.get(key) || { total: 0, converted: 0 };
    count.total++;
    if (lead.status === 'CONVERTED') count.converted++;
    counts.set(key, count);
  }
  return Array.from({ length: days }, (_, i) => {
    const day = dayKey(new Date(Date.now() - (days - 1 - i) * 86400000), timezone);
    return { day, ...(counts.get(day) || { total: 0, converted: 0 }) };
  });
}

function MiniChart({ values }: { values: number[] }) {
  const id = useId();
  const max = Math.max(1, ...values);
  const points = values
    .map((n, i) => `${(i * 100) / Math.max(1, values.length - 1)},${40 - (n / max) * 33}`)
    .join(' ');
  return (
    <svg className="crm-spark" viewBox="0 0 100 44" aria-hidden="true">
      <defs>
        <linearGradient id={id} x2="0" y2="1">
          <stop stopColor="currentColor" stopOpacity=".16" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,44 ${points} 100,44`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function GrowthChart({ leads, timezone }: { leads: Lead[]; timezone: string }) {
  const [days, setDays] = useState(30);
  const id = useId();
  const series = useMemo(() => leadSeries(leads, days, timezone), [leads, days, timezone]);
  const max = Math.max(4, ...series.map((d) => d.total));
  const points = (key: 'total' | 'converted') =>
    series.map((d, i) => `${30 + (i * 600) / (days - 1)},${150 - (d[key] / max) * 125}`).join(' ');
  return (
    <section className="crm-card crm-growth">
      <div className="crm-section-heading">
        <h2>Leads growth</h2>
        <label>
          <span className="sr-only">Growth chart date range</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
      </div>
      <div className="crm-chart-key">
        <span>
          <i />
          New leads
        </span>
        <span>
          <i />
          Now converted
        </span>
      </div>
      <svg
        viewBox="0 0 650 185"
        role="img"
        aria-label={`Leads created daily in the last ${days} days and how many are now converted`}
      >
        <defs>
          <linearGradient id={id} x2="0" y2="1">
            <stop stopColor="#7047ff" stopOpacity=".14" />
            <stop offset="1" stopColor="#7047ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1="30" x2="630" y1={25 + i * 31.25} y2={25 + i * 31.25} />
            <text x="22" y={29 + i * 31.25} textAnchor="end">
              {Math.round((max * (4 - i)) / 4)}
            </text>
          </g>
        ))}
        <polygon points={`30,150 ${points('total')} 630,150`} fill={`url(#${id})`} />
        <polyline points={points('total')} stroke="#7047ff" fill="none" strokeWidth="2" />
        <polyline points={points('converted')} stroke="#40a2ff" fill="none" strokeWidth="2" />
        {series.map((d, i) => (
          <g key={d.day}>
            <circle
              cx={30 + (i * 600) / (days - 1)}
              cy={150 - (d.total / max) * 125}
              r="4"
              fill="transparent"
            >
              <title>
                {d.day}: {d.total} new leads, {d.converted} now converted
              </title>
            </circle>
            {(i === 0 || i === days - 1 || (i % Math.ceil(days / 5) === 0 && i < days - 3)) && (
              <text
                x={30 + (i * 600) / (days - 1)}
                y="174"
                textAnchor={i === 0 ? 'start' : i === days - 1 ? 'end' : 'middle'}
              >
                {new Date(d.day + 'T12:00:00Z').toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                })}
              </text>
            )}
          </g>
        ))}
      </svg>
      <p className="crm-caption">
        Created date · {timezone}. Converted reflects each lead’s current status.
      </p>
    </section>
  );
}

function LeadProfile({
  lead,
  base,
  canWrite,
  edit,
  close,
}: {
  lead: Lead;
  base: string;
  canWrite: boolean;
  edit: () => void;
  close: () => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [allEvents, setAllEvents] = useState(false);
  const [allNotes, setAllNotes] = useState(false);
  const timeline = useQuery({
    queryKey: ['detail', base, 'leads', lead.id],
    queryFn: ({ signal }) => api(`${base}/leads/${lead.id}/timeline`, { signal }),
  });
  const phone = lead.phone?.replace(/[^\d+]/g, '') || '';
  const username = lead.instagram?.replace(/^@/, '') || '';
  const validInstagram = /^[a-zA-Z0-9._]{1,30}$/.test(username);
  const notes = timeline.data?.notes || [];
  const events = [
    {
      id: 'created',
      title: 'Lead added',
      body: `Source: ${lead.source}`,
      createdAt: lead.createdAt,
      icon: Users,
    },
    ...(lead.updatedAt !== lead.createdAt
      ? [
          {
            id: 'updated',
            title: 'Lead details updated',
            body: `Current status: ${label(lead.status)}`,
            createdAt: lead.updatedAt,
            icon: Pencil,
          },
        ]
      : []),
    ...notes.map((n: any) => ({
      id: n.id,
      title: 'Note added',
      body: n.body,
      createdAt: n.createdAt,
      icon: FileText,
    })),
    ...(timeline.data?.consents || []).map((c: any) => ({
      id: c.id,
      title: c.granted ? 'Consent granted' : 'Consent declined',
      body: c.purpose,
      createdAt: c.createdAt,
      icon: CheckCheck,
    })),
    ...(timeline.data?.submissions || []).map((s: any) => ({
      id: s.id,
      title: 'Lead form submitted',
      body: '',
      createdAt: s.createdAt,
      icon: Send,
    })),
  ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      await send(`${base}/leads/${lead.id}/notes`, { body: note.trim() });
      setNote('');
      setAdding(false);
      await timeline.refetch();
      toast('Note saved');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="crm-card crm-profile" aria-label="Selected lead details" tabIndex={-1}>
      <button className="crm-close" aria-label="Close lead details" onClick={close}>
        <X size={17} />
      </button>
      <div className="crm-profile-header">
        <span className="crm-profile-avatar">{initials(lead.name)}</span>
        <div>
          <h2>{lead.name}</h2>
          <span className={`crm-status status-${lead.status.toLowerCase()}`}>
            {label(lead.status)}
          </span>
          {lead.instagram && (
            <p>{lead.instagram.startsWith('@') ? lead.instagram : '@' + lead.instagram}</p>
          )}
        </div>
      </div>
      <div className="crm-profile-meta">
        <span>
          <CalendarDays size={13} />
          Added {date(lead.createdAt)}
        </span>
        <span>
          <Users size={13} />
          {lead.source}
        </span>
      </div>
      <div className="crm-contact-info">
        <a href={`mailto:${lead.email}`}>
          <Mail size={15} />
          <span>{lead.email}</span>
        </a>
        {lead.phone && (
          <a href={`tel:${phone}`}>
            <Phone size={15} />
            <span>{lead.phone}</span>
          </a>
        )}
        {validInstagram && (
          <a
            href={`https://www.instagram.com/${encodeURIComponent(username)}/`}
            target="_blank"
            rel="noreferrer"
          >
            <Instagram size={15} />
            <span>@{username}</span>
            <ChevronRight size={13} />
          </a>
        )}
      </div>
      <div className="crm-profile-tags">
        {lead.tags.map((tag, i) => (
          <span className={`crm-tag tag-${i % 4}`} key={tag}>
            {tag}
          </span>
        ))}
        {canWrite && (
          <button onClick={edit} aria-label="Edit lead tags">
            <Plus size={14} />
          </button>
        )}
      </div>
      <div className="crm-contact-actions">
        {phone && (
          <a href={`tel:${phone}`}>
            <Phone size={14} />
            Call
          </a>
        )}
        {phone && /^\+?\d{8,15}$/.test(phone) && (
          <a
            className="crm-whatsapp"
            href={`https://wa.me/${phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={14} />
            WhatsApp
          </a>
        )}
        <a href={`mailto:${lead.email}`}>
          <Mail size={14} />
          Email
        </a>
        {canWrite && (
          <button onClick={edit}>
            <Pencil size={13} />
            Edit
          </button>
        )}
      </div>
      <section className="crm-notes">
        <div className="crm-section-heading">
          <h3>
            Notes <span>{notes.length || ''}</span>
          </h3>
          {canWrite && (
            <button onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add note'}</button>
          )}
        </div>
        {timeline.isPending ? (
          <p className="crm-muted">Loading notes…</p>
        ) : timeline.error ? (
          <div className="crm-inline-error">
            Couldn’t load notes. <button onClick={() => timeline.refetch()}>Retry</button>
          </div>
        ) : notes.length ? (
          <>
            {notes.slice(0, allNotes ? undefined : 2).map((n: any) => (
              <div className="crm-note" key={n.id}>
                <p>{n.body}</p>
                <time dateTime={n.createdAt}>{date(n.createdAt)}</time>
              </div>
            ))}
            {notes.length > 2 && (
              <button className="crm-text-button" onClick={() => setAllNotes((v) => !v)}>
                {allNotes ? 'Show fewer notes' : `View all ${notes.length} notes`}
              </button>
            )}
          </>
        ) : (
          <p className="crm-muted">Keep the details that make your next conversation personal.</p>
        )}
        {adding && (
          <form onSubmit={saveNote} className="crm-note-form">
            <textarea
              autoFocus
              aria-label="Lead note"
              required
              maxLength={5000}
              value={note}
              placeholder="Add a helpful detail or next step…"
              onChange={(e) => setNote(e.target.value)}
            />
            <Button size="sm" disabled={busy || !note.trim()}>
              {busy ? <Loader2 className="spin" size={14} /> : <Check size={14} />}Save note
            </Button>
          </form>
        )}
      </section>
      <section className="crm-timeline">
        <div className="crm-section-heading">
          <h3>Activity timeline</h3>
          {events.length > 4 && (
            <button onClick={() => setAllEvents((v) => !v)}>
              {allEvents ? 'Show less' : 'View all'}
              <ArrowRight size={12} />
            </button>
          )}
        </div>
        {events.slice(0, allEvents ? undefined : 4).map((event) => (
          <div className="crm-timeline-event" key={event.id}>
            <span>
              <event.icon size={13} />
            </span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.body}</p>
              <time dateTime={event.createdAt}>
                {new Date(event.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
            </div>
          </div>
        ))}
      </section>
    </aside>
  );
}

export function LeadsCRM() {
  const { workspaceId, workspace, role } = useWorkspace();
  const params = useSearchParams();
  const client = useQueryClient();
  const toast = useToast();
  const base = `/workspaces/${workspaceId}`;
  const timezone = workspace.timezone || 'Asia/Kolkata';
  const canWrite = role !== 'VIEWER';
  const [search, setSearch] = useState(params.get('search') || '');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [range, setRange] = useState(0);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null | undefined>();
  const [checked, setChecked] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Lead | null>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const query = useQuery({
    queryKey: ['leads', workspaceId, 'crm'],
    queryFn: ({ signal }) => loadLeads(base, signal),
  });
  const leads: Lead[] = query.data || [];
  const globalSearch = params.get('search');
  useEffect(() => {
    setSearch(globalSearch || '');
  }, [globalSearch]);
  useEffect(() => {
    setPage(1);
    setChecked([]);
  }, [search, source, status, tag, range, sort, workspaceId]);
  useEffect(() => {
    setSelectedId(undefined);
    setOpen(false);
    setDeleting(null);
  }, [workspaceId]);
  const sources = useMemo(() => [...new Set(leads.map((l) => l.source))].sort(), [leads]);
  const tags = useMemo(() => [...new Set(leads.flatMap((l) => l.tags))].sort(), [leads]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const since = Date.now() - range * 86400000;
    return leads
      .filter(
        (l) =>
          (!term ||
            [l.name, l.email, l.instagram || '', l.phone || '', ...l.tags].some((v) =>
              v.toLowerCase().includes(term),
            )) &&
          (!source || l.source === source) &&
          (!status || l.status === status) &&
          (!tag || l.tags.includes(tag)) &&
          (!range || +new Date(l.createdAt) >= since),
      )
      .sort((a, b) =>
        sort === 'name'
          ? a.name.localeCompare(b.name)
          : sort === 'oldest'
            ? +new Date(a.createdAt) - +new Date(b.createdAt)
            : +new Date(b.createdAt) - +new Date(a.createdAt),
      );
  }, [leads, search, source, status, tag, range, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  const checkedRows = filtered.filter((l) => checked.includes(l.id));
  const allChecked = rows.length > 0 && rows.every((l) => checked.includes(l.id));
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate = !allChecked && rows.some((l) => checked.includes(l.id));
  }, [checked, rows, allChecked]);
  const selected =
    selectedId === null ? null : filtered.find((l) => l.id === selectedId) || rows[0] || null;
  const stats = [
    { name: 'Total leads', status: '', icon: Users, tone: 'purple' },
    { name: 'New leads', status: 'NEW', icon: Send, tone: 'pink' },
    { name: 'Contacted', status: 'CONTACTED', icon: MessageCircle, tone: 'blue' },
    { name: 'Converted', status: 'CONVERTED', icon: UserCheck, tone: 'green' },
  ];
  const statData = useMemo(
    () =>
      stats.map((s) => {
        const matching = s.status ? leads.filter((l) => l.status === s.status) : leads;
        return {
          ...s,
          count: matching.length,
          values: leadSeries(matching, 30, timezone).map((d) => d.total),
        };
      }),
    [leads, timezone],
  );
  function resetFilters() {
    setSearch('');
    setSource('');
    setStatus('');
    setTag('');
    setRange(0);
  }
  function create() {
    setEditing(null);
    setForm(initial);
    setError('');
    setOpen(true);
  }
  function edit(lead: Lead) {
    setEditing(lead);
    setForm({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || '',
      instagram: lead.instagram || '',
      source: lead.source,
      tags: lead.tags.join(', '),
      status: lead.status,
    });
    setError('');
    setOpen(true);
  }
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['leads'] }),
      client.invalidateQueries({ queryKey: ['analytics'] }),
      client.invalidateQueries({ queryKey: ['detail'] }),
      client.invalidateQueries({ queryKey: ['billing', workspaceId] }),
    ]);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        tags: [
          ...new Set(
            form.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
          ),
        ],
      };
      const result = await send(
        `${base}/resources/leads${editing ? '/' + editing.id : ''}`,
        payload,
        editing ? 'PATCH' : 'POST',
      );
      await refresh();
      setSelectedId(result.id);
      setOpen(false);
      toast(editing ? 'Lead updated' : 'Lead added');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportCsv() {
    const records = checkedRows.length ? checkedRows : filtered;
    const cell = (v: string) => {
      const safe = /^[\s]*[=+@\-\t\r]/.test(v) ? "'" + v : v;
      return '"' + safe.replaceAll('"', '""') + '"';
    };
    const csv = [
      ['Name', 'Email', 'Phone', 'Instagram', 'Source', 'Tags', 'Status', 'Created'],
      ...records.map((l) => [
        l.name,
        l.email,
        l.phone || '',
        l.instagram || '',
        l.source,
        l.tags.join(', '),
        l.status,
        l.createdAt,
      ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `creatorflow-${checkedRows.length ? 'selected-' : ''}leads.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`${records.length} leads exported`);
  }
  function choose(lead: Lead) {
    setSelectedId(lead.id);
    requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('.crm-profile');
      panel?.focus({ preventScroll: true });
      if (innerWidth <= 1180)
        panel?.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
          block: 'start',
        });
    });
  }
  const filtersActive = !!(search || source || status || tag || range);
  if (query.isPending) return <Loading />;
  if (query.error) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  return (
    <div className="leads-crm">
      <header className="crm-heading">
        <div>
          <span>CONNECTIONS THAT COUNT</span>
          <h1>Leads & CRM</h1>
          <p>Know your audience. Build relationships. Grow your business.</p>
        </div>
        <div className="crm-live">
          <i />
          Your audience, all together
        </div>
      </header>
      <div className="crm-stats">
        {statData.map((s) => (
          <button
            key={s.name}
            className={`crm-stat crm-tone-${s.tone} ${status === s.status ? 'is-current' : ''}`}
            onClick={() => {
              resetFilters();
              setStatus(s.status);
            }}
            aria-label={`Show ${s.name.toLowerCase()}`}
            aria-pressed={status === s.status}
          >
            <span className="crm-stat-icon">
              <s.icon size={25} />
            </span>
            <span className="crm-stat-copy">
              <span>{s.name}</span>
              <strong>{s.count.toLocaleString()}</strong>
              <small>
                {s.status
                  ? `${leads.length ? Math.round((s.count / leads.length) * 100) : 0}% of your audience`
                  : 'All-time connections'}
              </small>
            </span>
            <MiniChart values={s.values} />
          </button>
        ))}
      </div>
      <section className="crm-toolbar" aria-label="Lead filters">
        <label className="crm-search">
          <Search size={17} />
          <input
            aria-label="Search leads"
            placeholder="Search name, email, username or tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </label>
        <select
          aria-label="Filter by source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by lead status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
        <select aria-label="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <label className="crm-date-filter">
          <CalendarDays size={15} />
          <select
            aria-label="Lead created date"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value="0">All dates</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
        <div className="crm-toolbar-actions">
          <Button variant="secondary" onClick={exportCsv} disabled={!filtered.length}>
            <Download size={15} />
            Export{checkedRows.length ? ` (${checkedRows.length})` : ''}
          </Button>
          <label className="crm-sort">
            <ArrowDownUp size={15} />
            <select aria-label="Sort leads" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          {canWrite && (
            <Button onClick={create}>
              <Plus size={17} />
              Add lead
            </Button>
          )}
        </div>
      </section>
      {(filtersActive || checkedRows.length > 0) && (
        <div className="crm-filter-summary">
          <span>
            {filtered.length} matching leads
            {checkedRows.length ? ` · ${checkedRows.length} selected` : ''}
          </span>
          {filtersActive && (
            <button onClick={resetFilters}>
              Clear filters <X size={12} />
            </button>
          )}
          {checkedRows.length > 0 && (
            <button onClick={() => setChecked([])}>Clear selection</button>
          )}
        </div>
      )}
      <div className={`crm-layout ${selected ? '' : 'crm-no-profile'}`}>
        <div className="crm-main">
          <section className="crm-card crm-table-card" aria-label="Lead list">
            {filtered.length ? (
              <>
                <div className="crm-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th className="crm-check-cell">
                          <input
                            ref={selectAll}
                            type="checkbox"
                            aria-label="Select all leads on this page"
                            checked={allChecked}
                            onChange={(e) =>
                              setChecked(
                                e.target.checked
                                  ? [...new Set([...checked, ...rows.map((l) => l.id)])]
                                  : checked.filter((id) => !rows.some((l) => l.id === id)),
                              )
                            }
                          />
                        </th>
                        <th>Name</th>
                        <th>Source</th>
                        <th>Tags</th>
                        <th>Status</th>
                        <th>Added</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((lead, i) => (
                        <tr
                          key={lead.id}
                          className={selected?.id === lead.id ? 'crm-selected-row' : ''}
                        >
                          <td className="crm-check-cell">
                            <input
                              type="checkbox"
                              aria-label={`Select ${lead.name}`}
                              checked={checked.includes(lead.id)}
                              onChange={(e) =>
                                setChecked(
                                  e.target.checked
                                    ? [...checked, lead.id]
                                    : checked.filter((id) => id !== lead.id),
                                )
                              }
                            />
                          </td>
                          <td>
                            <button
                              className="crm-lead-name"
                              onClick={() => choose(lead)}
                              aria-label={`View ${lead.name}`}
                              aria-pressed={selected?.id === lead.id}
                            >
                              <span className={`crm-avatar avatar-${i % 4}`}>
                                {initials(lead.name)}
                              </span>
                              <span>
                                <strong>{lead.name}</strong>
                                <small>
                                  {lead.instagram
                                    ? '@' + lead.instagram.replace(/^@/, '')
                                    : lead.email}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <span
                              className={`crm-source ${lead.source.toLowerCase().includes('instagram') ? 'source-instagram' : lead.source.toLowerCase().includes('form') ? 'source-form' : ''}`}
                              title={lead.source}
                            >
                              {lead.source}
                            </span>
                          </td>
                          <td>
                            <div className="crm-table-tags">
                              {lead.tags.slice(0, 1).map((t) => (
                                <button
                                  className={`crm-tag tag-${i % 4}`}
                                  key={t}
                                  onClick={() => setTag(t)}
                                  title={`Filter by ${t}`}
                                >
                                  {t}
                                </button>
                              ))}
                              {lead.tags.length > 1 && (
                                <span title={lead.tags.slice(1).join(', ')}>
                                  +{lead.tags.length - 1}
                                </span>
                              )}
                              {!lead.tags.length && <span className="crm-dash">—</span>}
                            </div>
                          </td>
                          <td>
                            <span className={`crm-status status-${lead.status.toLowerCase()}`}>
                              {label(lead.status)}
                            </span>
                          </td>
                          <td>
                            <time dateTime={lead.createdAt}>{date(lead.createdAt)}</time>
                          </td>
                          <td>
                            <div className="crm-row-actions">
                              {canWrite ? (
                                <>
                                  <button
                                    aria-label={`Edit ${lead.name}`}
                                    onClick={() => edit(lead)}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    aria-label={`Delete ${lead.name}`}
                                    onClick={() => setDeleting(lead)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <button
                                  aria-label={`Open details for ${lead.name}`}
                                  onClick={() => choose(lead)}
                                >
                                  <ChevronRight size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="crm-pagination">
                  <span>
                    {(currentPage - 1) * 8 + 1}–{Math.min(currentPage * 8, filtered.length)} of{' '}
                    {filtered.length.toLocaleString()} leads
                  </span>
                  <div>
                    <button
                      aria-label="Previous page"
                      disabled={currentPage === 1}
                      onClick={() => setPage(currentPage - 1)}
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <span>
                      {currentPage} / {pages}
                    </span>
                    <button
                      aria-label="Next page"
                      disabled={currentPage === pages}
                      onClick={() => setPage(currentPage + 1)}
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <Empty
                title={
                  leads.length ? 'No matching leads' : 'Your audience starts with one connection'
                }
                description={
                  leads.length
                    ? 'Try a different search or clear your filters.'
                    : 'Add a lead to start building relationships in your workspace.'
                }
                action={
                  leads.length ? (
                    <Button variant="secondary" onClick={resetFilters}>
                      Clear filters
                    </Button>
                  ) : canWrite ? (
                    <Button onClick={create}>
                      <Plus size={15} />
                      Add your first lead
                    </Button>
                  ) : undefined
                }
              />
            )}
          </section>
          <div className="crm-bottom-grid">
            <GrowthChart leads={filtered} timezone={timezone} />
            <section className="crm-card crm-pipeline">
              <div className="crm-section-heading">
                <h2>Leads pipeline</h2>
                <span>{filtered.length} leads</span>
              </div>
              <div className="crm-pipeline-list">
                {statuses.map((s) => {
                  const count = filtered.filter((l) => l.status === s).length;
                  const pct = filtered.length ? Math.round((count / filtered.length) * 100) : 0;
                  return (
                    <button
                      key={s}
                      className={`pipeline-${s.toLowerCase()}`}
                      onClick={() => setStatus(status === s ? '' : s)}
                      aria-label={`Filter ${label(s)} pipeline`}
                    >
                      <span>
                        <i />
                        {label(s)}
                      </span>
                      <span className="crm-pipeline-track">
                        <i style={{ width: `${pct}%` }} />
                      </span>
                      <strong>{count}</strong>
                      <small>{pct}%</small>
                    </button>
                  );
                })}
              </div>
              <p className="crm-caption">
                Current status
                {filtersActive ? ' · matches your filters' : ' · across your workspace'}
              </p>
            </section>
          </div>
        </div>
        {selected && (
          <LeadProfile
            key={`${workspaceId}-${selected.id}`}
            lead={selected}
            base={base}
            canWrite={canWrite}
            edit={() => edit(selected)}
            close={() => setSelectedId(null)}
          />
        )}
      </div>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={editing ? 'Edit lead' : 'Add a new lead'}
        description="Keep the details you need for a more personal conversation."
      >
        <form className="stack-form crm-edit-form" onSubmit={save}>
          <div className="crm-form-grid">
            {[
              { key: 'name', label: 'Full name', required: true, max: 120 },
              { key: 'email', label: 'Email address', required: true, max: 254 },
              { key: 'phone', label: 'Phone number', max: 30 },
              { key: 'instagram', label: 'Instagram username', max: 80 },
              { key: 'source', label: 'Source', max: 100 },
              { key: 'tags', label: 'Tags (comma separated)', max: 619 },
            ].map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type={f.key === 'email' ? 'email' : f.key === 'phone' ? 'tel' : 'text'}
                  required={f.required}
                  maxLength={f.max}
                  minLength={f.key === 'name' ? 2 : undefined}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={
                    f.key === 'tags'
                      ? 'Course, Interested'
                      : f.key === 'instagram'
                        ? '@username'
                        : undefined
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Status
            <select
              aria-label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button disabled={busy}>
              {busy ? <Loader2 className="spin" size={15} /> : <Check size={15} />}
              {editing ? 'Save changes' : 'Add lead'}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={() => {
          if (!busy) setDeleting(null);
        }}
        title="Delete this lead?"
        description="This permanently removes the lead and its notes. This cannot be undone."
      >
        <p className="delete-name">{deleting?.name}</p>
        <div className="form-actions">
          <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>
            Keep lead
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!deleting || busy) return;
              setBusy(true);
              try {
                await api(`${base}/resources/leads/${deleting.id}`, { method: 'DELETE' });
                setChecked((v) => v.filter((id) => id !== deleting.id));
                setDeleting(null);
                setSelectedId(undefined);
                await refresh();
                toast('Lead deleted');
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="spin" size={14} />}Delete permanently
          </Button>
        </div>
      </Modal>
    </div>
  );
}
