import Image from 'next/image';
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`logo${compact ? ' logo-compact' : ''}`} role="img" aria-label="CreatorFlow">
      <span className="logo-mark">
        <Image
          src="/images/creatorflow-mark.png"
          alt=""
          width={64}
          height={64}
          sizes="64px"
          quality={90}
          loading="eager"
          className="brand-symbol"
        />
      </span>
      {!compact && (
        <span className="brand-word" aria-hidden="true">
          <span>Creator</span>
          <span className="brand-flow">Flow</span>
        </span>
      )}
    </span>
  );
}
