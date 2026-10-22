'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Camera as Instagram,
  Workflow,
  MessageCircle,
  Download,
  Users,
  ShoppingBag,
  GraduationCap,
  GitBranch,
  BarChart3,
  CreditCard,
  Settings,
  LifeBuoy,
  ChevronDown,
  Search,
  Bell,
  Sun,
  Moon,
  LogOut,
  Menu,
  FileText,
} from 'lucide-react';
import { api, send, ApiError, date } from '@/lib/api';
import { Logo, Loading, ErrorState, Empty, Badge } from './shared';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { useToast } from './providers';
export type WorkspaceContext = { workspaceId: string; role: string; workspace: any; user: any };
const titleRole = (role: string) => role.charAt(0) + role.slice(1).toLowerCase();
const Workspace = createContext<WorkspaceContext | null>(null);
export const useWorkspace = () => {
  const context = useContext(Workspace);
  if (!context) throw new Error('Workspace context unavailable');
  return context;
};
export const navItems = [
  { label: 'Overview', slug: '', icon: LayoutDashboard },
  { label: 'Social accounts', slug: 'social-accounts', icon: Instagram },
  { label: 'Automations', slug: 'automations', icon: Workflow },
  { label: 'AutoDM', slug: 'autodm', icon: MessageCircle },
  { label: 'Lead magnets', slug: 'lead-magnets', icon: Download },
  { label: 'Lead forms', slug: 'forms', icon: FileText },
  { label: 'Leads & CRM', slug: 'leads', icon: Users },
  { label: 'Store', slug: 'store', icon: ShoppingBag },
  { label: 'Courses', slug: 'courses', icon: GraduationCap },
  { label: 'Workflows', slug: 'workflows', icon: GitBranch },
  { label: 'Analytics', slug: 'analytics', icon: BarChart3 },
  { label: 'Billing', slug: 'billing', icon: CreditCard },
  { label: 'Team', slug: 'team', icon: Users },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter(),
    path = usePathname(),
    toast = useToast(),
    client = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState(''),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(''),
    [notifications, setNotifications] = useState(false),
    [dark, setDark] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  useEffect(() => {
    setWorkspaceId(localStorage.getItem('creatorflow-workspace') || '');
    setDark(document.documentElement.dataset.theme === 'dark');
  }, []);
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
    if (me.data?.user.isSuperAdmin) router.replace('/admin');
    else if (me.data && !me.data.memberships.length) router.replace('/onboarding');
  }, [me.data, me.error, router]);
  const member =
    me.data?.memberships.find((m: any) => m.workspaceId === workspaceId) || me.data?.memberships[0];
  const notices = useQuery({
    queryKey: ['notifications', member?.workspaceId],
    queryFn: () => api(`/workspaces/${member.workspaceId}/notifications`),
    enabled: !!member && notifications && !me.data?.user.isSuperAdmin,
  });
  if (me.isPending) return <Loading />;
  if (me.error) return <ErrorState error={me.error} retry={() => me.refetch()} />;
  if (me.data?.user.isSuperAdmin) return <Loading />;
  if (!member) return <Loading />;
  const user = me.data.user;
  const current =
    navItems.find((n) => path === `/app${n.slug ? '/' + n.slug : ''}`)?.label ||
    path.split('/').at(-1) ||
    'Workspace';
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('creatorflow-theme', next ? 'dark' : 'light');
  }
  async function logout() {
    await send('/auth/logout', {});
    await client.cancelQueries();
    client.clear();
    localStorage.removeItem('creatorflow-workspace');
    window.location.replace('/login');
  }
  return (
    <Workspace.Provider
      value={{
        workspaceId: member.workspaceId,
        role: member.role,
        workspace: member.workspace,
        user,
      }}
    >
      <div className="app-shell">
        {mobile && (
          <button
            aria-label="Close menu"
            className="sidebar-backdrop"
            onClick={() => setMobile(false)}
          />
        )}
        <aside
          className={`sidebar ${mobile ? 'sidebar-open' : ''}`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setMobile(false);
          }}
        >
          <Link className="sidebar-logo" href="/">
            <Logo />
          </Link>
          <div className="workspace-switch">
            <span className="avatar workspace-avatar">{member.workspace.name[0]}</span>
            <div>
              <select
                aria-label="Switch workspace"
                value={member.workspaceId}
                onChange={(e) => {
                  setWorkspaceId(e.target.value);
                  localStorage.setItem('creatorflow-workspace', e.target.value);
                  client.invalidateQueries();
                }}
              >
                {me.data.memberships.map((m: any) => (
                  <option key={m.id} value={m.workspaceId}>
                    {m.workspace.name}
                  </option>
                ))}
              </select>
              <small>{member.role.toLowerCase()} workspace</small>
            </div>
            <ChevronDown size={14} />
          </div>
          <nav aria-label="Workspace navigation">
            {[
              { title: 'Workspace', slugs: ['', 'leads', 'analytics'] },
              {
                title: 'Create & automate',
                slugs: ['automations', 'autodm', 'forms', 'lead-magnets', 'workflows'],
              },
              {
                title: 'Business',
                slugs: ['social-accounts', 'store', 'courses', 'billing', 'team'],
              },
            ].map((group) => (
              <div className="workspace-nav-group" key={group.title}>
                <div className="nav-label">{group.title}</div>
                {group.slugs.map((slug) => {
                  const item = navItems.find((item) => item.slug === slug)!;
                  const active = path === `/app${slug ? '/' + slug : ''}`;
                  return (
                    <Link
                      key={slug}
                      href={`/app${slug ? '/' + slug : ''}`}
                      className={`nav-item${active ? ' active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobile(false)}
                    >
                      <item.icon size={18} />
                      <span>{item.label}</span>
                      {active && <span className="nav-active-dot" />}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Link
              className={`nav-item ${path === '/app/settings' ? 'active' : ''}`}
              href="/app/settings"
            >
              <Settings size={18} />
              Settings
            </Link>
            <Link
              className={`nav-item ${path === '/app/support' ? 'active' : ''}`}
              href="/app/support"
            >
              <LifeBuoy size={18} />
              Help & support
            </Link>
            <div className="sidebar-profile">
              <span className="avatar">{user.name[0]}</span>
              <div>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
              <button
                aria-label="Sign out"
                onClick={() => logout().catch((e) => toast(e.message, true))}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="app-topbar">
            <div className="breadcrumbs">
              <button
                className="mobile-toggle"
                aria-label="Open menu"
                onClick={() => setMobile(true)}
              >
                <Menu size={21} />
              </button>
              <span>{member.workspace.name}</span>
              <span>/</span>
              <strong>{current}</strong>
            </div>
            <div className="topbar-actions">
              <form
                className="global-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  router.push(`/app/leads?search=${encodeURIComponent(search)}`);
                }}
              >
                <Search size={16} />
                <input
                  aria-label="Search leads"
                  placeholder="Search your leads…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <kbd>↵</kbd>
              </form>
              <button aria-label="Toggle theme" onClick={toggleTheme}>
                {dark ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <button aria-label="Notifications" onClick={() => setNotifications(true)}>
                <Bell size={19} />
              </button>
              <span className="topbar-divider" />
              <Link
                href="/app/settings"
                aria-label="Your profile"
                className="workspace-profile-link"
              >
                <span className="avatar small">{user.name[0]}</span>
                <span className="workspace-profile-copy">
                  <strong>{user.name}</strong>
                  <small>{titleRole(member.role)} workspace</small>
                </span>
                <ChevronDown size={14} />
              </Link>
            </div>
          </header>
          <main id="main-content" className="app-content">
            {children}
            <footer className="app-footer">
              <span>Made for your next chapter.</span>
              <span>
                CreatorFlow <i>✦</i>
              </span>
            </footer>
          </main>
        </div>
      </div>
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="Notifications"
        description="Updates from this workspace."
      >
        {notices.isPending ? (
          <Loading />
        ) : notices.error ? (
          <ErrorState error={notices.error} />
        ) : (
          <>
            {notices.data?.length ? (
              <>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await send(`/workspaces/${member.workspaceId}/notifications/read`, {});
                    notices.refetch();
                  }}
                >
                  Mark all as read
                </Button>
                {notices.data.map((n: any) => (
                  <div className="notification" key={n.id}>
                    <strong>
                      {n.title} {!n.readAt && <Badge tone="violet">New</Badge>}
                    </strong>
                    <p>{n.body}</p>
                    <small>{date(n.createdAt)}</small>
                  </div>
                ))}
              </>
            ) : (
              <Empty
                title="You’re all caught up"
                description="Workspace updates will appear here."
              />
            )}
          </>
        )}
      </Modal>
    </Workspace.Provider>
  );
}
