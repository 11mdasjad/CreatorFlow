import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowUpRight,
  BarChart3,
  Check,
  Heart,
  MessageCircle,
  Play,
  Send,
  ShoppingBag,
  Sparkles,
  Users,
  Wifi,
  BatteryFull,
} from 'lucide-react';
import { Button } from './ui/button';

export function CreatorHero() {
  return (
    <section className="creator-hero">
      <div className="creator-hero-inner">
        <div className="creator-hero-copy">
          <div className="hero-kicker">
            <Sparkles size={14} /> YOUR CREATIVITY. YOUR BUSINESS.
          </div>
          <h1>
            Turn your audience
            <br />
            into <span>customers.</span>
          </h1>
          <p>
            Grow beyond the follow. Automate Instagram conversations, capture leads, and sell your
            digital products—all from one beautiful workspace.
          </p>
          <div className="creator-hero-actions">
            <Button asChild>
              <Link href="/register">
                Start free trial <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/preview">
                <Play size={16} /> Explore the product
              </Link>
            </Button>
          </div>
          <div className="creator-hero-note">
            <Check size={15} /> 14-day free trial <span /> No credit card required
          </div>
          <div className="creator-capabilities">
            {[
              [MessageCircle, 'Auto DM', '& responses'],
              [Users, 'Lead collection', '& CRM'],
              [ShoppingBag, 'Digital products', '& courses'],
              [BarChart3, 'Analytics', '& insights'],
            ].map(([Icon, title, detail]: any) => (
              <div key={title}>
                <span>
                  <Icon size={21} />
                </span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
            ))}
          </div>
        </div>
        <div
          className="creator-hero-art"
          aria-label="Illustration of a creator sharing a resource through an automated conversation"
        >
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="creator-phone">
            <Image
              src="/images/creator-portrait.png"
              alt="Creator in a bright home studio"
              fill
              preload
              sizes="(max-width: 600px) 240px, 310px"
            />
            <div className="phone-shade" />
            <div className="phone-status">
              <span>9:41</span>
              <i />
              <Wifi size={13} />
              <BatteryFull size={16} />
            </div>
            <div className="phone-top">
              <span>←</span>
              <strong>Creator stories</strong>
              <span>•••</span>
            </div>
            <div className="phone-caption">
              <span>CREATE. SHARE. CONNECT.</span>
              <strong>
                A little creativity.
                <br />A world of possibility.
              </strong>
              <div>
                <Heart size={18} />
                <MessageCircle size={18} />
                <Send size={18} />
              </div>
            </div>
          </div>
          <div className="hero-message hero-comment">
            <span className="hero-message-icon">
              <MessageCircle size={22} />
            </span>
            <div>
              <small>IT STARTS WITH A COMMENT</small>
              <strong>“Send me the guide 💜”</strong>
            </div>
          </div>
          <div className="hero-message hero-reply">
            <span className="hero-message-icon">
              <Send size={21} />
            </span>
            <div>
              <strong>A thoughtful reply. Instantly.</strong>
              <p>Here’s your guide. Enjoy creating!</p>
              <span className="example-pill">Example automation</span>
            </div>
          </div>
          <div className="hero-message hero-product">
            <div className="mini-product">
              <Sparkles size={25} />
            </div>
            <div>
              <small>YOUR NEXT BIG IDEA</small>
              <strong>The Creator’s Playbook</strong>
              <span>Digital guide · Made by you</span>
            </div>
            <ArrowUpRight size={18} />
          </div>
          <span className="art-sparkle spark-one">✦</span>
          <span className="art-sparkle spark-two">✧</span>
        </div>
      </div>
    </section>
  );
}
