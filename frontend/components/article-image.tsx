'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ArticleImageProps {
  src: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}

export function ArticleImage({ src, alt, priority = false, className }: ArticleImageProps) {
  const [hasError, setHasError] = useState(false);

  // Placeholder image from Unsplash (themed: spain, news, newspaper)
  const placeholderUrl = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&h=450&fit=crop';
  
  // Use placeholder if src is null/empty or if image failed to load
  const imageUrl = (!src || hasError) ? placeholderUrl : src;

  return (
    <Image
      src={imageUrl}
      alt={alt}
      fill
      priority={priority}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
