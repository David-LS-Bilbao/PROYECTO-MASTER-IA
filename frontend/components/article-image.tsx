'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ArticleImageProps {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}

export function ArticleImage({ src, alt, priority = false, className }: ArticleImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return null;
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
