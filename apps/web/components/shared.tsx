import { Logo } from './brand';
export { Logo } from './brand';
import { MarketingHeader } from './marketing-header';
import Link from 'next/link';
import {
  ArrowUpRight,
  Workflow,
  MessageCircle,
  Plus,
  Inbox,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
export function Empty({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={24} />
      Loading your workspace…
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="error-panel" role="alert">
      <h3>We couldn’t load this view</h3>
      <p>{error.message}</p>
      {retry && (
        <Button variant="secondary" onClick={retry}>
          <RefreshCw size={16} />
          Try again
        </Button>
      )}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function MarketingNav() {
  return <MarketingHeader />;
}
export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Link href="/">
          <Logo />
        </Link>
        <p>Make more room for creating.</p>
        <small>© {new Date().getFullYear()} CreatorFlow</small>
      </div>
      <div>
        <strong>Product</strong>
        <Link href="/features">Features</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/preview">Product preview</Link>
      </div>
      <div>
        <strong>Resources</strong>
        <Link href="/faq">FAQ</Link>
        <Link href="/blog">Journal</Link>
        <Link href="/contact">Contact</Link>
      </div>
      <div>
        <strong>Company</strong>
        <Link href="/about">About</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </div>
    </footer>
  );
}
