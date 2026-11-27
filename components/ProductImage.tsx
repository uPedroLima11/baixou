'use client';

import { ImageIcon } from 'lucide-react';
import { useState } from 'react';

type Props = {
  src: string | null | undefined;
  alt?: string;
  width: number;
  height: number;
  priority?: boolean;
};

export default function ProductImage({src, ...props}: Props) {
  return <ImageAttempt key={src} src={src} {...props}/>;
}

function ImageAttempt({src, alt = '', width, height, priority}: Props) {
  const original = rasterUrl(src);
  const compact = width <= 230
    ? original?.replace(/^(https:\/\/images\.kabum\.com\.br\/produtos\/fotos\/\d+\/[^/?#]+)_gg(\.jpg)$/i, '$1_g$2')
    : original;
  const [attempt, setAttempt] = useState<'compact' | 'original' | 'failed'>('compact');
  const image = attempt === 'compact' ? compact : attempt === 'original' ? original : null;
  return <span className="product-photo" style={{width, height}}>
    <ImageIcon className="product-photo-placeholder" size={Math.min(40, width / 2)} aria-hidden="true"/>
    {image && <img
      src={image}
      alt={alt}
      width={width}
      height={height}
      decoding="async"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setAttempt(attempt === 'compact' && compact !== original ? 'original' : 'failed')}
    />}
  </span>;
}

function rasterUrl(src: Props['src']) {
  if (!src) return null;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      /\.(avif|webp|jpe?g|png|gif)$/i.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
}
