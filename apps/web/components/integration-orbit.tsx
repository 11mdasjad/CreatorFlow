'use client';

import Image from 'next/image';
import { useState, type CSSProperties } from 'react';
import { GitBranch, Pause, Play, Users } from 'lucide-react';
import { Logo } from './brand';

const services = [
  { label: 'Instagram', image: '/images/integrations/instagram.png' },
  { label: 'Stripe', image: '/images/integrations/stripe.svg' },
  { label: 'Amazon S3', image: '/images/integrations/amazon-s3.svg' },
  { label: 'Amazon SES', image: '/images/integrations/amazon-ses.svg' },
  { label: 'Your CRM', Icon: Users },
  { label: 'Workflows', Icon: GitBranch },
];

export function IntegrationOrbit() {
  const [paused, setPaused] = useState(false);
  return (
    <div className="integration-animation" data-paused={paused}>
      <div
        className="integration-orbit"
        role="group"
        aria-label="Services connected around CreatorFlow"
      >
        <div className="orbit-ring ring-outer" aria-hidden="true" />
        <div className="orbit-ring ring-inner" aria-hidden="true" />
        <span className="orbit-center" aria-label="CreatorFlow">
          <Logo compact />
        </span>
        <div className="orbit-track">
          {services.map(({ label, image, Icon }, index) => (
            <div
              className="orbit-spoke"
              key={label}
              style={{ '--orbit-angle': `${index * 60}deg` } as CSSProperties}
            >
              <div className="orbit-position">
                <div className="orbit-upright">
                  <span className={`orbit-service ${image ? 'orbit-provider' : 'orbit-native'}`}>
                    {image ? (
                      <Image
                        src={image}
                        alt=""
                        width={38}
                        height={38}
                        className={label === 'Stripe' ? 'orbit-stripe-logo' : ''}
                      />
                    ) : (
                      Icon && <Icon size={27} aria-hidden="true" />
                    )}
                    <small>{label}</small>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="orbit-motion-control"
        onClick={() => setPaused(!paused)}
        aria-pressed={paused}
        aria-label={paused ? 'Resume logo animation' : 'Pause logo animation'}
      >
        {paused ? <Play size={12} /> : <Pause size={12} />}
        {paused ? 'Resume motion' : 'Pause motion'}
      </button>
    </div>
  );
}
