'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Check, Phone } from 'lucide-react';
import { Button } from './ui/button';
import { Loading, ErrorState } from './shared';

type Plan = {
  id: string;
  name: string;
  description: string;
  priceMinor: number | null;
  currency: string;
  features: string[];
};
const order = ['Starter', 'Creator', 'Pro', 'Custom'];
export function Pricing() {
  const q = useQuery({ queryKey: ['public-plans'], queryFn: () => api<Plan[]>('/public/plans') });
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  return (
    <div className="pricing-grid">
      {q.data
        .filter((p) => p.name !== 'Free Trial')
        .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
        .map((p) => {
          const custom = p.priceMinor === null;
          const free = p.priceMinor === 0;
          const featured = p.name === 'Creator';
          return (
            <section
              className={`panel pricing-card ${featured ? 'pricing-featured' : ''}`}
              key={p.id}
              aria-label={`${p.name} plan`}
            >
              {featured && <div className="pricing-popular">RECOMMENDED FOR CREATORS</div>}
              <h3>{p.name}</h3>
              <div className="pricing-amount">
                <strong className="plan-price">
                  {custom
                    ? 'Let’s talk'
                    : free
                      ? 'FREE'
                      : new Intl.NumberFormat('en-IN', {
                          style: 'currency',
                          currency: p.currency,
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        }).format(p.priceMinor! / 100)}
                </strong>
                {!custom && !free && <span>/ month</span>}
              </div>
              <p className="plan-term">
                {custom
                  ? 'A plan shaped around your needs'
                  : free
                    ? 'Forever. No credit card needed.'
                    : 'Billed monthly. No introductory price.'}
              </p>
              <p className="plan-description">{p.description}</p>
              <div className="plan-includes">
                {p.name === 'Creator'
                  ? 'Everything in Starter, with more:'
                  : p.name === 'Pro'
                    ? 'Everything in Creator, with more:'
                    : custom
                      ? 'Built around your business:'
                      : 'Your essentials, all in one place:'}
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <span className="plan-check">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant={featured ? 'default' : 'secondary'}>
                <Link href={custom ? '/book-call' : '/register'}>
                  {custom && <Phone size={15} />}
                  {custom ? 'Book a call' : free ? 'Start for Free' : `Get ${p.name}`}
                </Link>
              </Button>
            </section>
          );
        })}
    </div>
  );
}
