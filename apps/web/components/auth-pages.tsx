'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Mail,
  ShieldCheck,
  Workflow,
  MessageCircle,
  Users,
  ShoppingBag,
  BarChart3,
} from 'lucide-react';
import { api, send } from '@/lib/api';
import { Logo, Badge, Loading, ErrorState } from './shared';
import { Button } from './ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
export function AuthPage({ mode }: { mode: string }) {
  const router = useRouter(),
    params = useSearchParams(),
    client = useQueryClient();
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const register = mode === 'register',
    login = mode === 'login',
    reset = mode === 'reset-password',
    verify = mode === 'verify',
    invite = mode === 'invite';
  const schema = z.object({
    name: register ? z.string().min(2, 'Please enter your name') : z.string().optional(),
    email:
      verify || reset || invite ? z.string().optional() : z.string().email('Enter a valid email'),
    password:
      register || reset
        ? z.string().min(12, 'Use at least 12 characters')
        : login
          ? z.string().min(1, 'Enter your password')
          : z.string().optional(),
  });
  const form = useForm({ resolver: zodResolver(schema) });
  const title = register
    ? 'Create your account'
    : login
      ? 'Welcome back'
      : verify
        ? 'One small step. Then you’re in.'
        : reset
          ? 'A fresh start for your password.'
          : invite
            ? 'You’ve been invited.'
            : 'Let’s get you back in.';
  async function submit(values: any) {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (register) {
        const r = await send('/auth/register', {
          name: values.name,
          email: values.email,
          password: values.password,
        });
        setMessage(r.message);
      } else if (login) {
        const result = await send('/auth/login', {
          email: values.email,
          password: values.password,
        });
        await client.cancelQueries();
        client.clear();
        localStorage.removeItem('creatorflow-workspace');
        // A full navigation also clears in-memory state belonging to the previous account.
        window.location.replace(result.portal === 'admin' ? '/admin' : '/app');
      } else if (verify) {
        const r = await send('/auth/verify', { token: params.get('token') || '' });
        setMessage(r.message);
      } else if (reset) {
        const r = await send('/auth/reset-password', {
          token: params.get('token') || '',
          password: values.password,
        });
        setMessage(r.message);
      } else if (invite) {
        await send('/workspaces/accept-invitation', { token: params.get('token') || '' });
        client.invalidateQueries({ queryKey: ['me'] });
        router.push('/app');
      } else {
        const r = await send('/auth/forgot-password', { email: values.email });
        setMessage(r.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="auth-layout">
      <aside className="auth-story">
        <Link href="/">
          <Logo />
        </Link>
        <div className="auth-benefits">
          <span className="eyebrow">MORE TIME TO CREATE</span>
          <h1>
            Turn your audience
            <br />
            into <em>customers.</em>
          </h1>
          <p>Everything you need to build the business behind your creativity.</p>
          <div className="auth-benefit-list">
            {[
              [
                MessageCircle,
                'Conversations that keep flowing',
                'Automate eligible Instagram replies.',
              ],
              [Users, 'An audience you actually know', 'Capture leads and build relationships.'],
              [
                ShoppingBag,
                'Your knowledge. Your storefront.',
                'Sell digital products and courses.',
              ],
              [BarChart3, 'A clearer picture of your growth', 'Bring your business into focus.'],
            ].map(([Icon, title, detail]: any) => (
              <div key={title}>
                <span>
                  <Icon size={23} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
        <small>Built for the business behind your creativity.</small>
      </aside>
      <section className="auth-form-side">
        <Link className="back-link" href="/">
          <ArrowLeft size={15} />
          Back to CreatorFlow
        </Link>
        <div className="auth-form-content">
          <Link href="/" className="auth-form-brand">
            <Logo />
          </Link>
          <span className="eyebrow">
            {register ? 'LET’S MAKE SOMETHING HAPPEN' : 'YOUR CREATORFLOW ACCOUNT'}
          </span>
          <h2>{title}</h2>
          <p>
            {register
              ? 'Create your account. Your workspace is waiting.'
              : invite
                ? 'Sign in with the invited email before accepting.'
                : verify
                  ? 'Confirm your email address to create your workspace.'
                  : 'Sign in to continue to your dashboard.'}
          </p>
          {message ? (
            <div className="success-panel" role="status">
              <Check size={24} />
              <h3>{register ? 'Check your email' : 'You’re all set'}</h3>
              <p>{message}</p>
              <Button asChild>
                <Link href="/login">
                  Go to sign in <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
          ) : (
            <form className="stack-form" onSubmit={form.handleSubmit(submit)}>
              {register && (
                <label>
                  Your name
                  <input autoComplete="name" {...form.register('name')} placeholder="Alex Morgan" />
                  {form.formState.errors.name && (
                    <small className="form-error">
                      {String(form.formState.errors.name.message)}
                    </small>
                  )}
                </label>
              )}
              {!verify && !reset && !invite && (
                <label>
                  Email address
                  <input
                    type="email"
                    autoComplete="email"
                    {...form.register('email')}
                    placeholder="you@example.com"
                  />
                  {form.formState.errors.email && (
                    <small className="form-error">
                      {String(form.formState.errors.email.message)}
                    </small>
                  )}
                </label>
              )}
              {(register || login || reset) && (
                <label>
                  <span>
                    Password{login && <Link href="/forgot-password">Forgot password?</Link>}
                  </span>
                  <input
                    type="password"
                    autoComplete={login ? 'current-password' : 'new-password'}
                    {...form.register('password')}
                    placeholder={register ? 'At least 12 characters' : 'Your password'}
                  />
                  {form.formState.errors.password && (
                    <small className="form-error">
                      {String(form.formState.errors.password.message)}
                    </small>
                  )}
                </label>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <Button disabled={busy}>
                {busy ? <Loader2 className="spin" size={17} /> : null}
                {register
                  ? 'Create your account'
                  : login
                    ? 'Sign in'
                    : verify
                      ? 'Verify email'
                      : reset
                        ? 'Reset password'
                        : invite
                          ? 'Accept invitation'
                          : 'Send reset link'}
                <ArrowRight size={16} />
              </Button>
              {register && (
                <p className="legal-copy">
                  By continuing, you acknowledge the <Link href="/terms">Terms</Link> and{' '}
                  <Link href="/privacy">Privacy notice</Link>.
                </p>
              )}
            </form>
          )}
          <div className="auth-switch">
            {login ? (
              <>
                New around here? <Link href="/register">Create an account</Link>
              </>
            ) : (
              <>
                Already have an account? <Link href="/login">Sign in</Link>
              </>
            )}
          </div>
          <p className="auth-secure">
            <ShieldCheck size={15} />
            Your account. Your data. Secure by design.
          </p>
        </div>
      </section>
    </main>
  );
}
export function Onboarding() {
  const router = useRouter(),
    client = useQueryClient();
  const q = useQuery({ queryKey: ['me'], queryFn: () => api('/auth/me') });
  const [step, setStep] = useState(1),
    [name, setName] = useState(''),
    [slug, setSlug] = useState(''),
    [category, setCategory] = useState('Creator'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [wid, setWid] = useState('');
  useEffect(() => {
    if (q.data?.user.isSuperAdmin) {
      router.replace('/admin');
      return;
    }
    if (q.data?.memberships[0]) {
      const w = q.data.memberships[0].workspace;
      setWid(w.id);
      setStep(Math.max(2, Math.min(4, w.onboardingStep)));
    }
  }, [q.data, router]);
  if (q.isPending) return <Loading />;
  if (q.data?.user.isSuperAdmin) return <Loading />;
  if (q.error)
    return (
      <div className="narrow-page">
        <ErrorState error={q.error} />
        <Link href="/login">Sign in →</Link>
      </div>
    );
  async function next() {
    setError('');
    setBusy(true);
    try {
      if (step === 1) {
        const w = await send('/workspaces', { name, slug, category });
        setWid(w.id);
        localStorage.setItem('creatorflow-workspace', w.id);
        await send(`/workspaces/${w.id}/settings`, { onboardingStep: 2 }, 'PATCH');
        setStep(2);
        client.invalidateQueries({ queryKey: ['me'] });
      } else if (step < 4) {
        await send(`/workspaces/${wid}/settings`, { onboardingStep: step + 1 }, 'PATCH');
        setStep(step + 1);
      } else {
        await send(`/workspaces/${wid}/settings`, { onboardingStep: 8 }, 'PATCH');
        router.push('/app');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="onboarding">
      <Link href="/">
        <Logo />
      </Link>
      <div className="onboarding-progress">
        {['Your workspace', 'Your plan', 'Connect', 'Create'].map((s, i) => (
          <div key={s} className={step > i ? 'current' : ''}>
            <span>{step > i + 1 ? <Check size={15} /> : i + 1}</span>
            <small>{s}</small>
          </div>
        ))}
      </div>
      <section className="panel onboarding-card">
        <div className="eyebrow">STEP {step} OF 4</div>
        <h1>
          {step === 1
            ? 'A space for your big ideas.'
            : step === 2
              ? 'Start small. Grow your way.'
              : step === 3
                ? 'Bring your conversations along.'
                : 'You’re ready to find your flow.'}
        </h1>
        <p>
          {step === 1
            ? 'Name your workspace and tell us what you create.'
            : step === 2
              ? 'Your workspace starts on Starter, our free plan with no expiry. No credit card required.'
              : step === 3
                ? 'Connect an eligible professional Instagram account from Social accounts when your integration is configured.'
                : 'Create a draft automation, build a lead form, or explore your dashboard.'}
        </p>
        {!q.data.user.verifiedAt ? (
          <div className="info-strip">
            Verify your email first. In local development, use <code>npm run mailbox</code> to open
            your verification link.
          </div>
        ) : (
          <form
            className="stack-form"
            onSubmit={(e) => {
              e.preventDefault();
              next();
            }}
          >
            {step === 1 ? (
              <>
                <label>
                  Workspace name
                  <input
                    required
                    minLength={2}
                    value={name}
                    placeholder="The Creative Studio"
                    onChange={(e) => {
                      setName(e.target.value);
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, ''),
                      );
                    }}
                  />
                </label>
                <label>
                  Store URL slug
                  <div className="slug-input">
                    <span>/store/</span>
                    <input
                      required
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                      minLength={3}
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                    />
                  </div>
                </label>
                <label>
                  What do you create?
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {['Creator', 'Educator', 'Coach', 'Artist', 'Small business', 'Agency'].map(
                      (c) => (
                        <option key={c}>{c}</option>
                      ),
                    )}
                  </select>
                </label>
              </>
            ) : step === 2 ? (
              <div className="onboarding-plan">
                <Badge tone="violet">Free Trial</Badge>
                <h3>Make your first connection.</h3>
                <p>1 Instagram account · 3 automations · 100 leads · 3 teammates</p>
                <small>
                  Quotas are configurable by your platform administrator. Live integrations require
                  approval.
                </small>
              </div>
            ) : step === 3 ? (
              <Link className="quick-link" href="/app/social-accounts">
                <span className="icon-tile violet">
                  <Workflow size={22} />
                </span>
                <div>
                  <strong>Set up Instagram</strong>
                  <small>Optional now. Available from your dashboard.</small>
                </div>
                <ArrowRight size={16} />
              </Link>
            ) : (
              <div className="onboarding-links">
                <Link href="/app/automations?new=1">
                  Create a draft automation <ArrowUpRightIcon />
                </Link>
                <Link href="/app/forms?new=1">
                  Create a lead form <ArrowUpRightIcon />
                </Link>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button disabled={busy}>
              {busy
                ? 'Saving…'
                : step === 4
                  ? 'Open my dashboard'
                  : step === 3
                    ? 'Continue without connecting'
                    : 'Continue'}
              <ArrowRight size={16} />
            </Button>
          </form>
        )}
      </section>
      <small>Your progress is saved as you go.</small>
    </main>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={16} />;
}
