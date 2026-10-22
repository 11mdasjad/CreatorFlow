'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Check, ArrowRight, BookOpen, Download, ShoppingBag, Mail } from 'lucide-react';
import { api, send, money } from '@/lib/api';
import { Logo, Loading, ErrorState, Empty, Badge } from './shared';
import { Button } from './ui/button';
import { useToast } from './providers';
export function PublicForm({ slug }: { slug: string }) {
  const q = useQuery({ queryKey: ['form', slug], queryFn: () => api(`/public/forms/${slug}`) });
  const [success, setSuccess] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    send(`/public/forms/${slug}/visit`, {}).catch(() => {});
  }, [slug]);
  return (
    <main id="main-content" className="public-form-page">
      <Link href="/">
        <Logo />
      </Link>
      <section className="panel capture-card">
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : success ? (
          <div className="success-panel">
            <Check size={32} />
            <h1>You’re on the list.</h1>
            <p>{success}</p>
          </div>
        ) : (
          <>
            <span className="icon-tile violet">
              <Mail size={26} />
            </span>
            <h1>{q.data.name}</h1>
            <p>{q.data.description}</p>
            <form
              className="stack-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                const values = new FormData(e.currentTarget);
                const customFields = Object.fromEntries(
                  q.data.fields.map((f: any) => [
                    f.key,
                    f.type === 'number'
                      ? Number(values.get(f.key))
                      : String(values.get(f.key) || ''),
                  ]),
                );
                try {
                  const r = await send(`/public/forms/${slug}/submit`, {
                    name: values.get('name'),
                    email: values.get('email'),
                    website: values.get('website') || '',
                    consent: values.get('consent') === 'on',
                    customFields,
                  });
                  setSuccess(r.message);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Your name
                <input name="name" autoComplete="name" required minLength={2} />
              </label>
              <label>
                Email address
                <input type="email" name="email" autoComplete="email" required />
              </label>
              <div className="honeypot" aria-hidden="true">
                <label>
                  Website
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              {q.data.fields.map((f: any) => (
                <label key={f.key}>
                  {f.label}
                  <input
                    name={f.key}
                    type={f.type === 'number' ? 'number' : 'text'}
                    required={f.required}
                  />
                </label>
              ))}
              <label className="check-field consent-field">
                <input type="checkbox" name="consent" />
                <span>
                  {q.data.consentText}
                  <small>
                    Optional. You can request this resource without opting into marketing.
                  </small>
                </span>
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Button disabled={busy}>
                {busy ? 'Submitting…' : 'Send my details'}
                <ArrowRight size={16} />
              </Button>
            </form>
          </>
        )}
      </section>
      <small>
        Powered by CreatorFlow · <Link href="/privacy">Privacy notice</Link>
      </small>
    </main>
  );
}
export function PublicStore({ slug }: { slug: string }) {
  const q = useQuery({
    queryKey: ['public-store', slug],
    queryFn: () => api(`/public/stores/${slug}`),
  });
  const toast = useToast(),
    [busy, setBusy] = useState('');
  if (q.isPending) return <Loading />;
  if (q.error)
    return (
      <div className="narrow-page">
        <ErrorState error={q.error} />
      </div>
    );
  const store = q.data;
  return (
    <main
      id="main-content"
      className="store-page"
      style={{ '--store-accent': store.accent } as React.CSSProperties}
    >
      <header>
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/learn">Your purchases →</Link>
      </header>
      <section className="store-header">
        <span className="store-avatar">{store.name[0]}</span>
        <Badge>THE CREATOR COLLECTION</Badge>
        <h1>{store.name}</h1>
        <p>{store.description}</p>
      </section>
      <div className="store-products">
        {store.products.length ? (
          store.products.map((p: any) => (
            <article className="panel store-product" key={p.id}>
              <div className="product-art">
                {p.kind === 'COURSE' ? <BookOpen size={52} /> : <Download size={52} />}
                <span>{p.kind === 'COURSE' ? 'A new perspective.' : 'A little inspiration.'}</span>
              </div>
              <div>
                <Badge>{p.kind === 'COURSE' ? 'Course' : 'Digital download'}</Badge>
                <h2>{p.name}</h2>
                <p>{p.description}</p>
                <footer>
                  <strong>{money(p.priceMinor, p.currency)}</strong>
                  <Button
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy(p.id);
                      try {
                        const r = await send(`/checkout/products/${p.id}`, {});
                        location.assign(r.url);
                      } catch (e) {
                        toast((e as Error).message, true);
                      } finally {
                        setBusy('');
                      }
                    }}
                  >
                    {busy === p.id ? 'Opening…' : 'Get access'}
                    <ArrowRight size={15} />
                  </Button>
                </footer>
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="Something good is on its way"
            description="This creator hasn’t published any products yet."
          />
        )}
      </div>
      <footer className="public-powered">
        Powered by CreatorFlow · <Link href="/privacy">Privacy</Link>
      </footer>
    </main>
  );
}
export function Learn({ ids = [] }: { ids?: string[] }) {
  const toast = useToast();
  const id = ids[0];
  const q = useQuery({
    queryKey: ['learn', id],
    queryFn: () => api(id ? `/learn/courses/${id}` : '/learn'),
  });
  const [enrollId, setEnrollId] = useState('');
  if (q.isPending) return <Loading />;
  if (q.error)
    return (
      <div className="narrow-page">
        <ErrorState error={q.error} />
        <Button asChild>
          <Link href="/login">Sign in to access your purchases</Link>
        </Button>
      </div>
    );
  return (
    <main id="main-content" className="learning-page">
      <header>
        <Link href="/">
          <Logo />
        </Link>
        <Link href="/learn">Your library</Link>
        <Link href="/app">Workspace</Link>
      </header>
      {id ? (
        <>
          <div className="content-hero">
            <Badge tone="violet">YOUR LEARNING SPACE</Badge>
            <h1>{q.data.name}</h1>
            <p>{q.data.description}</p>
          </div>
          {q.data.modules.map((m: any) => (
            <section className="panel lesson-module" key={m.id}>
              <h2>
                {m.position + 1}. {m.name}
              </h2>
              {m.lessons.map((l: any) => (
                <details key={l.id}>
                  <summary>
                    {l.name}
                    {q.data.progress.some((p: any) => p.lessonId === l.id) && (
                      <Badge tone="green">Completed</Badge>
                    )}
                  </summary>
                  <div>
                    <p className="preserve-lines">{l.body}</p>
                    {l.videoUrl && (
                      <a href={l.videoUrl} target="_blank" rel="noreferrer">
                        Open video lesson ↗
                      </a>
                    )}
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await send(`/learn/courses/${id}/lessons/${l.id}/complete`, {});
                          q.refetch();
                        } catch (e) {
                          toast((e as Error).message, true);
                        }
                      }}
                    >
                      <Check size={16} />
                      Mark complete
                    </Button>
                  </div>
                </details>
              ))}
            </section>
          ))}
        </>
      ) : (
        <>
          <div className="content-hero">
            <Badge tone="violet">A LITTLE MORE POSSIBILITY</Badge>
            <h1>Your library.</h1>
            <p>
              Purchased resources and enrolled courses, all in one place. Payments appear after
              webhook verification.
            </p>
          </div>
          <div className="integration-grid">
            {q.data.purchases.map((p: any) => (
              <section className="panel integration-card" key={p.id}>
                <ShoppingBag size={26} />
                <h3>{p.product.name}</h3>
                {p.product.kind === 'DOWNLOAD' ? (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        const r = await api(`/learn/products/${p.productId}/download`);
                        location.assign(r.url);
                      } catch (e) {
                        toast((e as Error).message, true);
                      }
                    }}
                  >
                    Download
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await send(`/learn/courses/${p.product.courseId}/enroll`, {});
                        q.refetch();
                        toast('You are enrolled');
                      } catch (e) {
                        toast((e as Error).message, true);
                      }
                    }}
                  >
                    Enroll in course
                  </Button>
                )}
              </section>
            ))}
            {q.data.enrollments.map((e: any) => (
              <section className="panel integration-card" key={e.id}>
                <BookOpen size={26} />
                <h3>{e.course.name}</h3>
                <p>{e.course.description}</p>
                <Button asChild>
                  <Link href={`/learn/${e.courseId}`}>
                    Continue learning <ArrowRight size={15} />
                  </Link>
                </Button>
              </section>
            ))}
          </div>
          {!q.data.purchases.length && !q.data.enrollments.length && (
            <Empty
              title="Your next chapter is waiting"
              description="Verified purchases and course enrollments will appear here."
            />
          )}
          <form
            className="panel enroll-form inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await send(`/learn/courses/${enrollId}/enroll`, {});
                q.refetch();
                toast('You are enrolled');
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          >
            <label>
              Have a course ID?
              <input
                placeholder="Course ID"
                value={enrollId}
                onChange={(e) => setEnrollId(e.target.value)}
                required
              />
            </label>
            <Button>Enroll in course</Button>
          </form>
        </>
      )}
    </main>
  );
}
