'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Download,
  FileText,
  GitBranch,
  GraduationCap,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  Users,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Modal } from './ui/dialog';
import { Logo } from './brand';
const products = [
  {
    name: 'Digital products',
    title: 'Make your expertise your next product.',
    text: 'Turn the things you know into useful guides, templates, and downloads. Give your best work a storefront of its own.',
    link: '/digital-product-store',
    cover: 'The Creative Toolkit',
    type: 'Digital download',
    icon: Download,
    tone: 'forest',
    features: ['Guides & templates', 'Private file delivery', 'Your own storefront'],
  },
  {
    name: 'Courses',
    title: 'Give your knowledge a classroom.',
    text: 'Bring your lessons together in one place. Create modules, organize your material, and give students a clear path to learn.',
    link: '/courses',
    cover: 'Create with Confidence',
    type: 'Online course',
    icon: GraduationCap,
    tone: 'sand',
    features: ['Organized modules', 'Text & video lessons', 'Free or paid enrollment'],
  },
  {
    name: 'Lead magnets',
    title: 'Start with something worth sharing.',
    text: 'Offer a helpful resource and invite your audience to stay in touch. A small idea can become a meaningful connection.',
    link: '/lead-magnets',
    cover: 'Your Next Big Idea',
    type: 'Free resource',
    icon: FileText,
    tone: 'lilac',
    features: ['Shareable resources', 'Lead capture forms', 'Connected CRM'],
  },
  {
    name: 'Storefront',
    title: 'One link. A home for what you create.',
    text: 'Bring your published products together in a simple storefront. Share the link wherever your audience finds you.',
    link: '/digital-product-store',
    cover: 'The Creator Collection',
    type: 'Your storefront',
    icon: ShoppingBag,
    tone: 'rose',
    features: ['Your own store link', 'Published collections', 'Digital downloads'],
  },
  {
    name: 'Workflows',
    title: 'Connect the next step, automatically.',
    text: 'Turn a new lead or form submission into a useful next action. Organize your audience while you focus on creating.',
    link: '/automation-workflows',
    cover: 'A Little More Flow',
    type: 'Visual workflows',
    icon: GitBranch,
    tone: 'blue',
    features: ['Visual flow builder', 'Lead-based triggers', 'Tags & notifications'],
  },
];
export function ProductShowcase() {
  const [selected, setSelected] = useState(0);
  const product = products[selected];
  return (
    <section className="public-products public-container" aria-labelledby="creator-tools-heading">
      <div className="public-section-heading">
        <span className="product-section-label">
          <Sparkles size={14} /> MADE FOR YOUR NEXT CHAPTER
        </span>
        <h2 id="creator-tools-heading">
          <em>Build your business</em>
          <br />
          with what you know.
        </h2>
        <p>Your ideas deserve more than a place in your notes app.</p>
      </div>
      <div className="product-tabs" role="tablist" aria-label="Creator tools">
        {products.map((item, i) => (
          <button
            key={item.name}
            role="tab"
            id={`tool-tab-${i}`}
            aria-selected={i === selected}
            aria-controls="tool-panel"
            tabIndex={i === selected ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => {
              if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? products.length - 1
                      : (selected + (event.key === 'ArrowRight' ? 1 : -1) + products.length) %
                        products.length;
                setSelected(next);
                document.getElementById(`tool-tab-${next}`)?.focus();
              }
            }}
          >
            <item.icon size={17} aria-hidden="true" />
            {item.name}
          </button>
        ))}
      </div>
      <div
        className={`product-showcase ${product.tone}`}
        id="tool-panel"
        role="tabpanel"
        aria-labelledby={`tool-tab-${selected}`}
        tabIndex={0}
      >
        <div className="showcase-copy">
          <span className="showcase-kicker">
            <span>0{selected + 1}</span> {product.name}
          </span>
          <h3>{product.title}</h3>
          <p>{product.text}</p>
          <ul className="showcase-features">
            {product.features.map((feature) => (
              <li key={feature}>
                <Check size={15} aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <Link href={product.link} className="showcase-link">
            Explore {product.name.toLowerCase()}{' '}
            <span>
              <ArrowUpRight size={20} />
            </span>
          </Link>
        </div>
        <div className="showcase-art">
          <div className="tool-preview" key={product.name}>
            <div className="tool-preview-bar">
              <Logo compact />
              <span>Made by you</span>
              <small>PREVIEW</small>
            </div>
            <div className={`tool-preview-content preview-${product.tone}`}>
              <ProductPreview product={product} selected={selected} />
            </div>
            <div className="tool-preview-footer">
              <span>Your ideas. Your space.</span>
              <ArrowUpRight size={17} />
            </div>
          </div>
          <div className="showcase-sticker">
            <span>
              <Sparkles size={20} />
            </span>
            <div>
              <strong>Uniquely yours.</strong>
              <small>From idea to something real.</small>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
function ProductPreview({
  product,
  selected,
}: {
  product: (typeof products)[number];
  selected: number;
}) {
  const Icon = product.icon;
  if (selected === 4)
    return (
      <div className="preview-workflow">
        <span className="preview-caption">A LITTLE MORE FLOW</span>
        <h4>Your next step, connected.</h4>
        {[
          ['01', 'New lead captured', Users],
          ['02', 'Add an audience tag', GitBranch],
          ['03', 'Notify your workspace', Check],
        ].map(([step, title, StepIcon]: any) => (
          <div className="preview-flow-step" key={step}>
            <span>
              <StepIcon size={19} />
            </span>
            <strong>{title}</strong>
            <small>{step}</small>
          </div>
        ))}
      </div>
    );
  if (selected === 3)
    return (
      <div className="preview-store">
        <span className="preview-caption">THE CREATOR COLLECTION</span>
        <h4>
          A little inspiration.
          <br />A lot of possibility.
        </h4>
        <div className="preview-store-grid">
          {[
            [BookOpen, 'The Field Guide', 'Digital guide'],
            [FileText, 'The Template Kit', 'Creative templates'],
          ].map(([CoverIcon, name, type]: any) => (
            <div key={name}>
              <span>
                <CoverIcon size={32} />
              </span>
              <strong>{name}</strong>
              <small>{type}</small>
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <>
      <div className="preview-product-cover">
        <div className="preview-cover-top">
          <Icon size={26} />
          <span>{product.type}</span>
        </div>
        <span className="preview-caption">THE NEXT CHAPTER STARTS HERE</span>
        <h4>{product.cover}</h4>
        <div className="preview-cover-bottom">
          <span>CREATED WITH PURPOSE</span>
          <span>✦</span>
        </div>
      </div>
      {selected === 0 && (
        <div className="preview-detail">
          <span className="preview-detail-icon">
            <Download size={22} />
          </span>
          <div>
            <strong>Small ideas. Useful resources.</strong>
            <small>Guides, templates & downloads</small>
          </div>
          <ArrowUpRight size={18} />
        </div>
      )}
      {selected === 1 && (
        <div className="preview-lessons">
          {['Find your creative direction', 'Bring your first idea to life'].map((title, index) => (
            <div key={title}>
              <span>0{index + 1}</span>
              <strong>{title}</strong>
              <BookOpen size={15} />
            </div>
          ))}
        </div>
      )}
      {selected === 2 && (
        <div className="preview-lead">
          <span>Your email address</span>
          <div>
            you@example.com{' '}
            <span>
              Get the guide <ArrowRight size={14} />
            </span>
          </div>
          <small>A useful resource. A new connection.</small>
        </div>
      )}
    </>
  );
}

const guides = [
  {
    id: 'start',
    name: 'Your first steps with CreatorFlow',
    category: 'GETTING STARTED',
    icon: Sparkles,
    time: '3 min read',
    intro: 'Set up a workspace that is ready for your next idea.',
    steps: [
      [
        'Create your account',
        'Register with your name, email, and a strong password. Open your verification email and confirm your address.',
      ],
      [
        'Make your workspace',
        'Sign in, choose a workspace name, and complete onboarding. Your workspace keeps its own audience, products, and settings.',
      ],
      [
        'Find your starting point',
        'Begin with a lead form, a draft automation, or a digital product. You can prepare your workspace before connecting external services.',
      ],
    ],
  },
  {
    id: 'autodm',
    name: 'Build your first comment automation',
    category: 'INSTAGRAM AUTODM',
    icon: MessageCircle,
    time: '4 min read',
    intro: 'Prepare a useful reply for people who ask for your resource.',
    steps: [
      [
        'Choose a keyword',
        'Open Automations, create a draft, and add a clear keyword such as GUIDE. Choose exact or contains matching.',
      ],
      [
        'Write a useful response',
        'Keep the message relevant to the comment. Include a resource or form link that delivers what you promised.',
      ],
      [
        'Simulate before activating',
        'Use Run simulation to check matching without sending a message. Live activation needs an approved, connected Instagram professional account and remains subject to Meta eligibility and limits.',
      ],
    ],
  },
  {
    id: 'forms',
    name: 'Turn interest into your first lead',
    category: 'LEAD CAPTURE',
    icon: Users,
    time: '3 min read',
    intro: 'Give people a simple way to hear more from you.',
    steps: [
      [
        'Create your form',
        'Open Lead forms and choose New form. Add a title, description, and a unique public URL slug.',
      ],
      [
        'Be clear about consent',
        'Explain what visitors will receive. Optional marketing consent should describe future messages and must remain a choice.',
      ],
      [
        'Publish and share',
        'Publish the form, open its public link, and share it with your audience. New submissions appear in your workspace CRM.',
      ],
    ],
  },
  {
    id: 'products',
    name: 'Prepare a digital product for launch',
    category: 'DIGITAL PRODUCTS',
    icon: ShoppingBag,
    time: '4 min read',
    intro: 'Put your expertise into a product your audience can use.',
    steps: [
      [
        'Create a draft',
        'Open Store and choose New product. Add a useful title, description, currency, and price. The price field uses minor units: 100 equals one unit of currency.',
      ],
      [
        'Attach the resource',
        'Upload your file through the secure library and attach it to the product. Private file delivery needs configured storage.',
      ],
      [
        'Get ready to sell',
        'Complete payment setup with a supported merchant account before publishing. Paid downloads unlock only after a verified payment event.',
      ],
    ],
  },
  {
    id: 'courses',
    name: 'Build a clear learning journey',
    category: 'COURSES',
    icon: GraduationCap,
    time: '4 min read',
    intro: 'Turn a big topic into small, useful lessons.',
    steps: [
      [
        'Start with an outcome',
        'Create a course and explain what students will learn. Decide whether enrollment is free or requires paid access.',
      ],
      [
        'Arrange your curriculum',
        'Open the course details to create modules and lessons. Add text and supported HTTPS video resources in the order students should follow.',
      ],
      [
        'Publish when ready',
        'Review the course and publish it. For paid access, connect the course to a paid product and finish payment setup.',
      ],
    ],
  },
  {
    id: 'workflows',
    name: 'Let your next step happen automatically',
    category: 'WORKFLOWS',
    icon: GitBranch,
    time: '5 min read',
    intro: 'Connect a new lead to a useful action in your workspace.',
    steps: [
      [
        'Choose your trigger',
        'Open Workflows and start with Lead created or Form submitted. Use the canvas to connect your steps.',
      ],
      [
        'Add a condition or action',
        'Check a tag or consent preference. Add a tag, update the lead status, or create an internal notification.',
      ],
      [
        'Save and publish',
        'Save a draft, review every connection, and publish an immutable version. The workspace runner handles new events using that version.',
      ],
    ],
  },
];
export function LearningGuides() {
  const [selected, setSelected] = useState<(typeof guides)[number] | null>(null);
  return (
    <>
      <div className="learning-guides">
        {guides.map((guide, i) => (
          <button
            className={`guide-card guide-color-${i % 3}`}
            key={guide.id}
            onClick={() => setSelected(guide)}
          >
            <div className="guide-cover">
              <guide.icon size={42} />
              <span>
                CREATORFLOW
                <br />
                FIELD NOTES
              </span>
              <BookOpen size={20} />
            </div>
            <div className="guide-copy">
              <small>
                {guide.category} · {guide.time}
              </small>
              <h2>{guide.name}</h2>
              <span>
                Read guide <ArrowUpRight size={16} />
              </span>
            </div>
          </button>
        ))}
      </div>
      <Modal
        open={!!selected}
        onOpenChange={() => setSelected(null)}
        title={selected?.name || 'Creator guide'}
        description={selected?.intro}
        wide
      >
        {selected && (
          <div className="guide-steps">
            {selected.steps.map(([title, text], i) => (
              <section key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </section>
            ))}
            <Link href="/app" className="public-start">
              Open your workspace <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </Modal>
    </>
  );
}
