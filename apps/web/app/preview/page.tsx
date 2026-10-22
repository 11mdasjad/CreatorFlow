import { ProductPreview } from '@/components/overview';
import { MarketingNav, Footer } from '@/components/shared';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
export const metadata = { title: 'Product preview' };
export default function Page() {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="preview-page">
        <div className="eyebrow">PRODUCT PREVIEW · NO LIVE DATA</div>
        <h1>Meet your new creative headquarters.</h1>
        <p>These are the same overview components used in the app, shown in their empty state.</p>
        <ProductPreview />
        <Button asChild>
          <Link href="/register">Create your own workspace</Link>
        </Button>
      </main>
      <Footer />
    </>
  );
}
