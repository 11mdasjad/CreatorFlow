import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';
import './refresh.css';
import './marketing.css';
import './dashboard.css';
import './leads.css';
import './date-range.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'http://127.0.0.1:3000'),
  title: {
    default: 'CreatorFlow — Turn your audience into customers',
    template: '%s · CreatorFlow',
  },
  description:
    'A focused workspace for creator conversations, lead capture, digital products, and thoughtful automation.',
  icons: { icon: '/images/creatorflow-mark.png', apple: '/images/creatorflow-mark.png' },
  openGraph: {
    title: 'CreatorFlow',
    description: 'Your audience. Your business. One connected flow.',
    type: 'website',
  },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
