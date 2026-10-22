import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AuthPage } from '@/components/auth-pages';
import { MarketingNav, Footer, Loading } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Pricing } from '@/components/pricing';
import { content } from '@/lib/content';
import { AutoDMLanding, PricingLanding, LearnLanding } from '@/components/marketing-pages';
const auth = ['login', 'register', 'verify', 'forgot-password', 'reset-password', 'invite'];
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title:
      content[slug]?.title ||
      slug
        .split('-')
        .map((s) => s[0].toUpperCase() + s.slice(1))
        .join(' '),
    description: content[slug]?.intro,
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (auth.includes(slug))
    return (
      <Suspense fallback={<Loading />}>
        <AuthPage mode={slug} />
      </Suspense>
    );
  if (slug === 'pricing') return <PricingLanding />;
  if (slug === 'instagram-autodm') return <AutoDMLanding />;
  if (slug === 'guides') return <LearnLanding />;
  const page = content[slug];
  if (!page) notFound();
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="content-page">
        <div className="content-hero">
          <span className="eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p>{page.intro}</p>
        </div>
        <div className="content-sections">
          {page.sections.map((s, i) => (
            <section key={s.title}>
              <span>0{i + 1}</span>
              <div>
                <h2>{s.title}</h2>
                <p>{s.text}</p>
              </div>
            </section>
          ))}
        </div>
        <div className="content-action">
          <Button asChild>
            <Link href={slug === 'contact' ? '/app/support' : '/register'}>
              {slug === 'contact' ? 'Open workspace support' : 'Create your workspace'} →
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/preview">Explore the product</Link>
          </Button>
        </div>
      </main>
      <Footer />
    </>
  );
}
