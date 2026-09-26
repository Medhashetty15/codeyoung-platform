import type { PhotoAsset } from '../../assets/photos';
import { cn } from '../lib/cn';

interface PhotoProps {
  photo: PhotoAsset;
  /** Rendered width hint for the srcset choice, e.g. "(min-width: 1024px) 560px, 100vw". */
  sizes: string;
  /** Above-the-fold photos load eagerly with high priority; everything else is lazy. */
  priority?: boolean;
  className?: string;
}

/**
 * Real photography (doc 07 §5) as AVIF, then WebP, then JPEG. Width and height reserve the box so
 * the page never shifts while the image loads.
 */
export function Photo({ photo, sizes, priority = false, className }: PhotoProps) {
  return (
    <picture>
      <source type="image/avif" srcSet={photo.avif} sizes={sizes} />
      <source type="image/webp" srcSet={photo.webp} sizes={sizes} />
      <img
        src={photo.fallback}
        srcSet={photo.jpg}
        sizes={sizes}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className={cn('h-auto w-full bg-sunken object-cover dark:brightness-90', className)}
      />
    </picture>
  );
}
