import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  Clock3,
  Phone,
  Sparkles,
} from 'lucide-react';

export const metadata = {
  title: 'Book a call with Md Asjad | CreatorFlow',
  description:
    'Explore CreatorFlow with Md Asjad. A 15-minute conversation about your audience, your business, and the right plan for you.',
};

export default function BookCallPage() {
  return (
    <main id="main-content" className="booking-page">
      <div className="booking-wrap">
        <header className="booking-host">
          <Link href="/pricing" className="booking-back" aria-label="Back to pricing">
            <ArrowLeft size={23} />
          </Link>
          <Image
            src="/images/md-asjad-office.png"
            alt="Md Asjad"
            width={58}
            height={58}
            quality={90}
            className="booking-avatar"
          />
          <div>
            <strong>Md Asjad</strong>
            <p>Let’s build your next chapter.</p>
          </div>
          <Link href="/" className="booking-brand">
            Made for creators.{' '}
            <span>
              CreatorFlow <ArrowUpRight size={13} />
            </span>
          </Link>
        </header>
        <div className="booking-card">
          <section className="booking-story">
            <span className="booking-eyebrow">A CONVERSATION ABOUT YOUR NEXT STEP</span>
            <h1>Let’s explore CreatorFlow together</h1>
            <div className="booking-meta">
              <span>
                <Clock3 size={17} /> 15 mins
              </span>
              <i />
              <span>
                <Phone size={17} /> Introductory call
              </span>
            </div>
            <div className="booking-price">
              <span>Free</span>
              <small>No payment required</small>
            </div>
            <Image
              src="/images/md-asjad-office.png"
              alt="Md Asjad seated in his office"
              width={1448}
              height={1086}
              quality={90}
              sizes="(max-width: 760px) 94vw, 650px"
              preload
              className="booking-portrait"
            />
            <div className="booking-description">
              <p>
                <strong>Your ideas. Your audience. Your next step.</strong>
                <br />
                Let’s find out how CreatorFlow can support the business you want to build.
              </p>
              <p>
                If you’ve just discovered CreatorFlow or you’re deciding which plan fits your needs,
                this conversation is for you.
              </p>
              <p>
                I’m <strong>Md Asjad</strong>. We’ll walk through the tools that matter to you—from
                Instagram automations and lead capture to your digital products, courses, and
                workflows.
              </p>
              <h2>What we can cover</h2>
              <ul>
                <li>
                  <Check size={17} /> Your goals and where you want to grow
                </li>
                <li>
                  <Check size={17} /> A walkthrough of the CreatorFlow workspace
                </li>
                <li>
                  <Check size={17} /> Choosing between Starter, Creator, Pro, or Custom
                </li>
                <li>
                  <Check size={17} /> Your questions and a clear next step
                </li>
              </ul>
              <p>
                Whether you’re exploring your first idea or planning a bigger setup, let’s make the
                next step feel simpler.
              </p>
            </div>
          </section>
          <aside className="booking-availability" aria-labelledby="availability-title">
            <div className="booking-calendar-art" aria-hidden="true">
              <span />
              <CalendarClock size={57} strokeWidth={1.25} />
              <Sparkles size={23} />
            </div>
            <span className="booking-eyebrow">A LITTLE TIME. A LOT OF CLARITY.</span>
            <h2 id="availability-title">Let’s find a time to talk.</h2>
            <p>
              No call slots are open right now.
              <br />
              Please check back for the next available times.
            </p>
            <div className="booking-summary">
              <span>
                <Clock3 size={17} /> 15-minute introductory call
              </span>
              <span>
                <Check size={17} /> Free to join
              </span>
              <span>
                <Phone size={17} /> With Md Asjad
              </span>
            </div>
            <Link href="/pricing" className="booking-plans-link">
              Explore the plans in the meantime <ArrowUpRight size={15} />
            </Link>
          </aside>
        </div>
        <footer className="booking-footer">
          <Link href="/">CreatorFlow</Link>
          <span>Turn your audience into customers.</span>
        </footer>
      </div>
    </main>
  );
}
