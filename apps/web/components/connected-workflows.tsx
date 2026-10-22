'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Download,
  FileText,
  GitBranch,
  GraduationCap,
  Mail,
  Pause,
  Play,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { Logo } from './brand';

const inputs = [
  { title: 'Lead forms', detail: 'Give interest a starting point', Icon: FileText, tone: 'blue' },
  {
    title: 'Instagram',
    detail: 'Turn comments into conversations',
    image: '/images/integrations/instagram.png',
    tone: 'pink',
  },
  { title: 'Lead magnets', detail: 'Share something worth saving', Icon: Download, tone: 'cyan' },
];
const outputs = [
  {
    title: 'Digital products',
    detail: 'Make your expertise available',
    Icon: ShoppingBag,
    tone: 'violet',
  },
  {
    title: 'Online courses',
    detail: 'Give your knowledge a home',
    Icon: GraduationCap,
    tone: 'green',
  },
  { title: 'Notifications', detail: 'Keep the next step in sight', Icon: Mail, tone: 'amber' },
];
function Connections({ outward = false }: { outward?: boolean }) {
  return (
    <div className={`flow-connections ${outward ? 'flow-outward' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 80 250" preserveAspectRatio="none">
        <defs>
          <linearGradient id={outward ? 'flow-out' : 'flow-in'}>
            <stop stopColor="#4a9cff" />
            <stop offset="1" stopColor="#aa87ff" />
          </linearGradient>
        </defs>
        {[
          'M0 37H16Q38 37 38 59V103Q38 125 60 125H80',
          'M0 125H80',
          'M0 213H16Q38 213 38 191V147Q38 125 60 125H80',
        ].map((d, i) => (
          <g key={d}>
            <path d={d} className="flow-wire" />
            <path
              d={d}
              className="flow-signal"
              style={{ animationDelay: `${i * -1.4}s` }}
              stroke={`url(#${outward ? 'flow-out' : 'flow-in'})`}
            />
          </g>
        ))}
      </svg>
      <ArrowDown size={22} className="flow-mobile-arrow" />
    </div>
  );
}
export function ConnectedWorkflows() {
  const [paused, setPaused] = useState(false);
  return (
    <section className="public-workflows public-container">
      <div className="flow-showcase" data-paused={paused}>
        <div className="flow-topline">
          <span className="flow-eyebrow">
            <i /> YOUR BUSINESS, CONNECTED
          </span>
          <button
            type="button"
            className="flow-motion"
            aria-label={paused ? 'Resume connection animation' : 'Pause connection animation'}
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            <span>{paused ? 'Resume motion' : 'Pause motion'}</span>
          </button>
        </div>
        <div className="flow-heading">
          <h2>
            Big ideas. <em>Connected steps.</em>
          </h2>
          <p>
            From the first “hello” to what comes next.
            <br /> Bring every part of your creator business together.
          </p>
        </div>
        <div
          className="flow-diagram"
          role="group"
          aria-label="Lead forms, Instagram and lead magnets connect to your audience and workflows, with products, courses and notifications in one workspace"
        >
          <div className="flow-nodes">
            <span className="flow-column-label">01 — CONNECT</span>
            {inputs.map(({ title, detail, Icon, image, tone }) => (
              <div className={`flow-node flow-${tone}`} key={title}>
                <span className="flow-node-icon">
                  {image ? (
                    <Image src={image} width={27} height={27} alt="" />
                  ) : (
                    Icon && <Icon size={23} />
                  )}
                </span>
                <span className="flow-node-copy">
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </div>
            ))}
          </div>
          <Connections />
          <div className="flow-hub">
            <span className="flow-hub-label">ONE CONNECTED WORKSPACE</span>
            <Logo />
            <p>
              A little less busywork.
              <br />A lot more possibility.
            </p>
            <div className="flow-hub-tools">
              <span>
                <Users size={16} /> Your audience
              </span>
              <span>
                <GitBranch size={16} /> Your workflows
              </span>
            </div>
          </div>
          <Connections outward />
          <div className="flow-nodes">
            <span className="flow-column-label">02 — CREATE & GROW</span>
            {outputs.map(({ title, detail, Icon, tone }) => (
              <div className={`flow-node flow-${tone}`} key={title}>
                <span className="flow-node-icon">
                  <Icon size={23} />
                </span>
                <span className="flow-node-copy">
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flow-bottom">
          <div>
            <h3>
              Less switching tools.
              <br />
              <span>More moving forward.</span>
            </h3>
            <p>
              Your people, your products, your next step.
              <br />
              Finally, in one place.
            </p>
          </div>
          <Link href="/automation-workflows" className="flow-cta">
            <span>
              Build your next flow<small>Explore visual workflows</small>
            </span>
            <span className="flow-cta-arrow">
              <ArrowUpRight size={24} />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
