import React, { useState } from 'react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({ src, alt, className = '', fallbackText }) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    const initials = (fallbackText || alt || 'MS')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-100 text-zinc-600 select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="font-display text-2xl font-semibold tracking-tight">{initials}</span>
        <span className="mt-1 text-xs text-zinc-500 px-3 text-center truncate max-w-full">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
