'use client';
import { ErrorState } from '@/components/shared';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main-content" className="narrow-page">
      <ErrorState
        error={new Error('The page could not be loaded. Please try again.')}
        retry={reset}
      />
    </main>
  );
}
