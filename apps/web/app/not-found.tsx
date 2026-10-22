import Link from 'next/link';
import { Logo } from '@/components/shared';
import { Button } from '@/components/ui/button';
export default function NotFound() {
  return (
    <main id="main-content" className="narrow-page">
      <Logo />
      <h1>This page took a different path.</h1>
      <p>Let’s get you back to your flow.</p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
