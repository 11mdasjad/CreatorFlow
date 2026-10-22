'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from './brand';
const items = [
  { title: 'Home', href: '/' },
  { title: 'AutoDM', href: '/instagram-autodm' },
  { title: 'Pricing', href: '/pricing' },
  { title: 'Learn', href: '/guides' },
];
export function MarketingHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      {(path === '/' || path === '/pricing') && (
        <div className="public-announcement">
          Your audience. Your ideas. Your next chapter.{' '}
          <Link href="/register">
            Start creating <ArrowRight size={13} />
          </Link>
        </div>
      )}
      <div className="public-header-shell">
        <header className="marketing-nav reference-header">
          <Link href="/" aria-label="CreatorFlow home">
            <Logo />
          </Link>
          <nav aria-label="Main navigation">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={path === item.href ? 'page' : undefined}
              >
                {item.title}
              </Link>
            ))}
          </nav>
          <div className="public-account-links">
            <Link className="login-link" href="/login">
              Sign In
            </Link>
            <Link className="public-start" href="/register">
              Start for Free
            </Link>
            <button
              className="public-menu-toggle"
              aria-label={open ? 'Close navigation' : 'Open navigation'}
              aria-expanded={open}
              aria-controls="public-mobile-menu"
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </header>
        {open && (
          <nav
            className="public-mobile-menu"
            id="public-mobile-menu"
            aria-label="Mobile navigation"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={path === item.href ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.title}
                <ArrowRight size={17} />
              </Link>
            ))}
            <Link href="/login" onClick={() => setOpen(false)}>
              Sign In <ArrowRight size={17} />
            </Link>
          </nav>
        )}
      </div>
    </>
  );
}
