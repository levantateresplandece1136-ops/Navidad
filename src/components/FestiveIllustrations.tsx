import React from 'react';
import { Gift } from 'lucide-react';
import { getInitials } from '../utils/christmasLogic';

export function PineOrnamentDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`} aria-hidden="true">
      <div className="h-px flex-1 bg-[#174C38]/12" />
      <svg width="40" height="20" viewBox="0 0 40 20" fill="none" className="text-[#D6AD60] shrink-0">
        <path d="M20 2L22.2 7.5L28 8L23.5 11.7L24.9 17.5L20 14.3L15.1 17.5L16.5 11.7L12 8L17.8 7.5L20 2Z" fill="currentColor" />
        <circle cx="5" cy="10" r="2" fill="#174C38" fillOpacity="0.35" />
        <circle cx="35" cy="10" r="2" fill="#B83232" fillOpacity="0.45" />
      </svg>
      <div className="h-px flex-1 bg-[#174C38]/12" />
    </div>
  );
}

export function SnowflakeCornerAccent({ className = '' }: { className?: string }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      className={`text-[#D6AD60]/35 pointer-events-none ${className}`}
    >
      <path
        d="M28 6V50M6 28H50M12.5 12.5L43.5 43.5M43.5 12.5L12.5 43.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="28" cy="28" r="4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function AvatarCircle({
  name,
  photoURL,
  size = 'md',
}: {
  name: string;
  photoURL?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = React.useState(false);

  const sizeClass =
    size === 'lg'
      ? 'w-20 h-20 text-xl'
      : size === 'md'
        ? 'w-14 h-14 text-base'
        : 'w-9 h-9 text-xs';

  if (photoURL && !failed) {
    return (
      <img
        src={photoURL}
        alt={`Fotografía de ${name}`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-full object-cover border border-[#174C38]/15 bg-[#FFF8ED] shrink-0`}
      />
    );
  }

  return (
    <div
      aria-label={`Avatar de ${name}`}
      className={`${sizeClass} rounded-full bg-[#174C38] text-[#FFF8ED] font-display font-semibold flex items-center justify-center shrink-0 border border-[#D6AD60]/40`}
    >
      {getInitials(name)}
    </div>
  );
}

export function WishImageFrame({
  src,
  alt,
  aspectClass = 'aspect-[4/3]',
}: {
  src?: string;
  alt: string;
  aspectClass?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  if (src && !failed) {
    return (
      <div className={`${aspectClass} w-full overflow-hidden rounded-xl bg-[#FFF8ED] border border-[#174C38]/10`}>
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
        />
      </div>
    );
  }

  return (
    <div
      className={`${aspectClass} w-full rounded-xl bg-gradient-to-br from-[#FFF8ED] via-[#F7ECDA] to-[#EFE1C6] border border-[#174C38]/10 flex flex-col items-center justify-center gap-2 text-[#174C38]/45 px-4 text-center`}
    >
      <Gift className="w-8 h-8 text-[#B83232]/65" strokeWidth={1.6} />
      <span className="text-xs font-medium text-[#174C38]/60 line-clamp-2">{alt}</span>
    </div>
  );
}
