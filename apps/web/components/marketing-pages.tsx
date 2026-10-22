import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  Mail,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react';
import { MarketingNav, Footer } from './shared';
import { Pricing } from './pricing';
import { IntegrationOrbit } from './integration-orbit';
import { ConnectedWorkflows } from './connected-workflows';
import { LearningGuides, ProductShowcase } from './marketing-interactive';

function RoundLink({
  href = '/register',
  children = 'Get started',
  dark = false,
}: {
  href?: string;
  children?: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <Link href={href} className={`round-cta ${dark ? 'round-dark' : ''}`}>
      <span>
        <ArrowUpRight size={19} />
      </span>
      {children}
    </Link>
  );
}
export function PublicClosing() {
  return (
    <section className="public-closing">
      <h2>
        Your next chapter starts <em>here.</em>
      </h2>
      <p>A little less busywork. A lot more possibility.</p>
      <RoundLink dark>Start for Free</RoundLink>
      <small>No credit card required.</small>
    </section>
  );
}
export function PublicFAQ({ automation = false }: { automation?: boolean }) {
  const questions = automation
    ? [
        [
          'How does a comment automation work?',
          'Choose a keyword and write a useful reply. When an eligible comment matches an active rule, CreatorFlow checks account permissions, policy windows, and rate limits before requesting a private reply.',
        ],
        [
          'Can I try it before connecting Instagram?',
          'Yes. Create draft rules and use the labeled simulation to test keyword matching. Simulation does not send any messages.',
        ],
        [
          'Which Instagram account can I connect?',
          'Use an eligible professional account through official Meta authorization. Live use also needs an approved Meta app and supported permissions. You never need to share your Instagram password.',
        ],
        [
          'Can I send unlimited messages?',
          'No. Sending is subject to Meta rules, eligibility, rate limits, and your workspace plan. Live, story, and unsolicited follow-up triggers are not currently supported.',
        ],
      ]
    : [
        [
          'What can I do with CreatorFlow?',
          'Bring Instagram comment automations, lead forms, your CRM, digital products, courses, and internal workflows into one workspace.',
        ],
        [
          'Who is CreatorFlow for?',
          'Creators, educators, coaches, and independent businesses who want a clearer way to connect with their audience and share their expertise.',
        ],
        [
          'Can I start without connecting Instagram?',
          'Yes. Build a form, organize leads, prepare products, and simulate draft automations while you set up your external connections.',
        ],
        [
          'Can I start for free?',
          'Yes. New workspaces start on Starter, our free plan with no expiry and no credit card required. Creator is ₹99 per month, Pro is ₹121 per month, and Custom pricing is agreed after a conversation. Compare the included limits on the Pricing page.',
        ],
        [
          'How do paid products and courses work?',
          'An eligible merchant connects supported payment infrastructure. Customers receive access after the server verifies a successful payment event. Storage and payments must be configured before selling.',
        ],
        [
          'Where can I learn how to get started?',
          'Open Learn in the navigation for step-by-step guides to your first form, automation, product, course, and workflow.',
        ],
      ];
  return (
    <section className="public-faq public-container">
      <span className="public-eyebrow">
        <i /> A LITTLE CLARITY
      </span>
      <h2>
        Good questions.
        <br />
        <em>Helpful answers.</em>
      </h2>
      <div>
        {questions.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <span>+</span>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
      <Link href="/guides">
        Find your next step in our guides <ArrowUpRight size={15} />
      </Link>
    </section>
  );
}
function MessageIllustration() {
  return (
    <div className="growth-illustration message-illustration">
      <div className="tiny-photo">
        <Image src="/images/creator-portrait.png" alt="" fill sizes="300px" />
      </div>
      <span className="tiny-comment">
        Can you share the guide? <span>💜</span>
      </span>
      <span className="tiny-reply">
        <SendGlyph /> Here’s your creative toolkit!
      </span>
      <small>EXAMPLE CONVERSATION</small>
    </div>
  );
}
function SendGlyph() {
  return <ArrowUpRight size={13} />;
}
function StoreIllustration() {
  return (
    <div className="growth-illustration store-illustration">
      <div className="mini-store-front">
        <span className="mini-store-avatar">C</span>
        <strong>Your creative corner</strong>
        <small>Ideas worth sharing.</small>
        <div>
          <span>
            <BookGlyph />
            <b>The Creative Guide</b>
          </span>
          <span>
            <GraduationCap size={24} />
            <b>Learn something new</b>
          </span>
        </div>
      </div>
    </div>
  );
}
function BookGlyph() {
  return <FileText size={25} />;
}
function FormIllustration() {
  return (
    <div className="growth-illustration form-illustration">
      <div className="mini-lead-form">
        <span>
          <FileText size={20} />
        </span>
        <strong>
          A little inspiration,
          <br />
          straight to your inbox.
        </strong>
        <small>Your name</small>
        <i />
        <small>Email address</small>
        <i />
        <b>
          Send me the guide <ArrowRight size={12} />
        </b>
      </div>
      <span className="lead-captured">
        <Check size={13} /> A new connection starts here
      </span>
    </div>
  );
}
export function CreatorHome() {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="reference-site">
        <section className="sky-hero">
          <div className="sky-cloud cloud-left" />
          <div className="sky-cloud cloud-right" />
          <div className="sky-hero-copy">
            <span className="hero-star">✦</span>
            <h1>
              Turn your audience
              <br />
              <em>into customers.</em>
            </h1>
            <p>
              Bring your ideas, conversations, and products together.
              <br className="desktop-break" /> Make more room for the work only you can do.
            </p>
            <RoundLink />
          </div>
          <Link
            href="/preview"
            className="creator-film"
            aria-label="Explore the CreatorFlow workspace"
          >
            <Image
              src="/images/creator-hero-hd.png"
              alt="Creator in her home studio"
              fill
              preload
              quality={90}
              sizes="(max-width: 760px) max(640px, 95vw), 900px"
            />
            <span className="film-tint" />
            <span className="film-corner">CREATORFLOW STORIES</span>
            <span className="film-center">
              <ArrowUpRight size={29} />
            </span>
            <span className="film-caption">
              <span>YOUR IDEAS DESERVE A BIGGER STAGE.</span>
              <strong>
                More creating.
                <br />
                More possibility.
              </strong>
            </span>
            <span className="film-link">
              Explore the workspace <ArrowRight size={17} />
            </span>
          </Link>
        </section>
        <section className="public-audience">
          <span>BUILT FOR YOUR KIND OF BUSINESS</span>
          <div>
            <strong>Creators</strong>
            <i>✦</i>
            <strong>Educators</strong>
            <i>✦</i>
            <strong>Coaches</strong>
            <i>✦</i>
            <strong>Independent brands</strong>
          </div>
        </section>
        <section className="growth-section">
          <div className="public-container">
            <div className="public-section-heading">
              <h2>
                <em>Make every connection</em>
                <br />
                the start of something.
              </h2>
              <p>
                From a first comment to your next customer, give your audience a clear next step.
              </p>
            </div>
            <div className="growth-cards">
              {[
                {
                  title: 'Instagram AutoDM',
                  text: 'Turn eligible comments into helpful private replies that keep the conversation moving.',
                  href: '/instagram-autodm',
                  cta: 'Explore AutoDM',
                  art: <MessageIllustration />,
                },
                {
                  title: 'Your creator storefront',
                  text: 'A place for your guides, downloads, and courses. One link that brings your work together.',
                  href: '/digital-product-store',
                  cta: 'Build your storefront',
                  art: <StoreIllustration />,
                },
                {
                  title: 'Lead forms & magnets',
                  text: 'Share something useful, invite people to stay in touch, and get to know your audience.',
                  href: '/lead-magnets',
                  cta: 'Capture your next lead',
                  art: <FormIllustration />,
                },
              ].map((card) => (
                <article key={card.title}>
                  {card.art}
                  <div>
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                    <Link href={card.href}>
                      {card.cta}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        <ProductShowcase />
        <ConnectedWorkflows />
        <section className="public-integrations">
          <div className="public-section-heading">
            <h2>
              Your creativity.
              <br />
              <em>A connected toolkit.</em>
            </h2>
            <p>Connect the services behind your creator business.</p>
            <RoundLink href="/features">Explore the toolkit</RoundLink>
          </div>
          <IntegrationOrbit />
          <small className="integration-note">
            Connect your own accounts. Availability depends on provider setup and eligibility.
          </small>
        </section>
        <section className="creator-personas public-container">
          <div className="public-section-heading">
            <h2>
              However you create,
              <br />
              <em>make it your business.</em>
            </h2>
            <p>A home for what you know, and the people who want to learn from you.</p>
          </div>
          <div>
            {[
              {
                Icon: Sparkles,
                title: 'For creators',
                text: 'Move from “link please” to a useful resource, a new connection, and your next idea.',
              },
              {
                Icon: GraduationCap,
                title: 'For educators',
                text: 'Put your knowledge into structured courses and share your expertise with students.',
              },
              {
                Icon: Users,
                title: 'For independent businesses',
                text: 'Keep the people, products, and everyday details of your business in one place.',
              },
            ].map(({ Icon, title, text }) => (
              <article key={title}>
                <Icon size={27} />
                <h3>{title}</h3>
                <p>{text}</p>
                <Link href="/register">
                  Make it yours <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="public-next public-container">
          <span className="public-eyebrow">MAKE YOUR FIRST MOVE</span>
          <h2>
            A small start. <em>A real next step.</em>
          </h2>
          {[
            ['Create a form your audience can find', '/guides'],
            ['Prepare your first Instagram comment reply', '/instagram-autodm'],
            ['Give your digital products a home', '/digital-product-store'],
            ['See what is happening in your workspace', '/preview'],
          ].map(([title, href]) => (
            <Link href={href} key={title}>
              {title}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </section>
        <PublicFAQ />
        <PublicClosing />
      </main>
      <Footer />
    </>
  );
}

export function AutoDMLanding() {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="reference-site">
        <section className="autodm-landing">
          <div>
            <span className="public-eyebrow">INSTAGRAM AUTODM</span>
            <h1>
              A great comment.
              <br />
              <em>A better conversation.</em>
            </h1>
            <p>
              Meet interest with a useful reply. Share a resource, guide your audience to a form,
              and turn a moment of curiosity into a connection.
            </p>
            <RoundLink>Start with a draft</RoundLink>
            <small>Official authorization · Eligible comments · Thoughtful replies</small>
          </div>
          <div className="autodm-demo">
            <div className="autodm-photo">
              <Image
                src="/images/creator-portrait.png"
                alt="Creator sharing her ideas"
                fill
                sizes="(max-width:760px) 260px, 350px"
              />
              <span>
                CREATOR STORIES
                <br />
                <strong>Something worth sharing.</strong>
              </span>
            </div>
            <div className="autodm-bubble comment">
              <MessageCircle size={18} />
              <span>“I’d love your guide!”</span>
            </div>
            <div className="autodm-bubble reply">
              <span>
                <Check size={17} />
              </span>
              <div>
                <strong>Here’s the resource you asked for.</strong>
                <small>Example private reply</small>
              </div>
            </div>
          </div>
        </section>
        <section className="autodm-points public-container">
          <div>
            <MessageCircle />
            <strong>A relevant response</strong>
            <span>Reply to the interest they expressed.</span>
          </div>
          <div>
            <Users />
            <strong>A useful next step</strong>
            <span>Lead people to your form or resource.</span>
          </div>
          <div>
            <Check />
            <strong>You stay in control</strong>
            <span>Draft, simulate, publish, or pause.</span>
          </div>
        </section>
        <section className="autodm-how public-container">
          <div className="public-section-heading">
            <span className="public-eyebrow">FROM IDEA TO REPLY</span>
            <h2>
              Three steps.
              <br />
              <em>One helpful conversation.</em>
            </h2>
          </div>
          <div className="autodm-step-grid">
            {[
              [
                '01',
                'Pick your keyword',
                'Choose the words that signal interest. Match an exact phrase or a keyword inside a comment.',
                MessageCircle,
              ],
              [
                '02',
                'Write something useful',
                'Give people the guide, link, or information they asked for. Keep your response clear and relevant.',
                FileText,
              ],
              [
                '03',
                'Check your flow',
                'Simulate first. Connect an approved professional account when you’re ready for eligible live replies.',
                Check,
              ],
            ].map(([n, title, text, Icon]: any) => (
              <article key={n}>
                <span>{n}</span>
                <Icon size={34} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="autodm-note public-container">
          <div>
            <h2>
              Built for the conversation.
              <br />
              <em>With clear boundaries.</em>
            </h2>
            <p>
              CreatorFlow uses official Meta authorization. Live replies depend on account
              permissions, app approval, eligibility, timing windows, and rate limits.
            </p>
          </div>
          <ul>
            <li>
              <Check size={18} /> No Instagram password sharing
            </li>
            <li>
              <Check size={18} /> A simulation before you go live
            </li>
            <li>
              <Check size={18} /> Clear connection and execution status
            </li>
            <li>
              <Check size={18} /> Your audience’s consent stays visible
            </li>
          </ul>
        </section>
        <PublicFAQ automation />
        <PublicClosing />
      </main>
      <Footer />
    </>
  );
}

export function PricingLanding() {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="reference-site public-pricing">
        <section className="public-container">
          <div className="public-section-heading">
            <h1>
              <em>Plans & pricing</em>
            </h1>
            <p>
              Choose a plan that fits your next chapter.
              <br />
              Start free. Grow from ₹99 a month.
            </p>
          </div>
          <div className="pricing-trial-note">
            <Sparkles size={16} />
            <span>Simple monthly pricing. A free plan that stays free.</span>
          </div>
          <Pricing />
          <p className="pricing-availability">
            All prices are in INR. Create your free workspace first; choose an upgrade from Billing.
            Live Instagram replies require an eligible, connected professional account. Selling
            requires payment and storage setup.
          </p>
          <section className="pricing-toolkit" aria-labelledby="toolkit-heading">
            <span className="public-eyebrow">MORE THAN A PLAN</span>
            <h2 id="toolkit-heading">
              Your whole creator toolkit. <em>Included.</em>
            </h2>
            <p>
              Every plan includes these tools, within its account, lead, team, and automation
              limits.
            </p>
            <div className="pricing-toolkit-grid">
              {[
                [
                  MessageCircle,
                  'Instagram AutoDM',
                  'Comment keywords, exact or contains matching, private replies, rule controls, and a simulation before going live.',
                ],
                [
                  Users,
                  'Lead capture & CRM',
                  'Published forms, lead magnets, consent records, tags, notes, search, status tracking, and CSV exports.',
                ],
                [
                  ShoppingBag,
                  'Your creator storefront',
                  'A public store, digital product listings, order tracking, and secure access after verified payments.',
                ],
                [
                  GraduationCap,
                  'Courses & learning',
                  'Modules, lessons, free or paid enrollment, a student library, and saved learning progress.',
                ],
                [
                  Workflow,
                  'Visual workflows',
                  'Lead and form triggers, conditions, tags, status updates, in-app notifications, and execution history.',
                ],
                [
                  Wallet,
                  'Business essentials',
                  'Dashboard analytics, team roles, workspace settings, notifications, and support tickets.',
                ],
              ].map(([Icon, title, description]: any) => (
                <article key={title}>
                  <span>
                    <Icon size={22} />
                  </span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
        <PublicFAQ />
        <PublicClosing />
      </main>
      <Footer />
    </>
  );
}
export function LearnLanding() {
  return (
    <>
      <MarketingNav />
      <main id="main-content" className="reference-site public-learn">
        <section className="public-container">
          <div className="public-section-heading">
            <span className="public-eyebrow">THE CREATORFLOW FIELD NOTES</span>
            <h1>
              Learn a little.
              <br />
              <em>Create something great.</em>
            </h1>
            <p>
              Practical guides for your first form, your next product,
              <br className="desktop-break" /> and the business behind your creativity.
            </p>
          </div>
          <LearningGuides />
        </section>
        <PublicClosing />
      </main>
      <Footer />
    </>
  );
}
