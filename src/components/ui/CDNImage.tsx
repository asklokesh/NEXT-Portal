'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { getAssetUrl, getCDNImageLoader } from '@/lib/cdn';

interface CDNImageProps extends Omit<ImageProps, 'loader'> {
 fallbackSrc?: string;
 useCDN?: boolean;
}

export function CDNImage({
 src,
 alt,
 fallbackSrc = '/images/placeholder.png',
 useCDN = true,
 ...props
}: CDNImageProps) {
 const [imgSrc, setImgSrc] = useState(src);
 const [hasError, setHasError] = useState(false);

 const handleError = () => {
 if (!hasError && fallbackSrc) {
 setHasError(true);
 setImgSrc(fallbackSrc);
 }
 };

 // Use CDN URL if available and enabled
 const imageSrc = useCDN ? getAssetUrl(imgSrc as string) : imgSrc;

 return (
 <Image
 {...props}
 src={imageSrc}
 alt={alt}
 loader={useCDN ? getCDNImageLoader : undefined}
 onError={handleError}
 loading={props.priority ? 'eager' : 'lazy'}
 />
 );
}

// Optimized background image component
interface CDNBackgroundImageProps {
 src: string;
 className?: string;
 children?: React.ReactNode;
 loading?: 'lazy' | 'eager';
}

export function CDNBackgroundImage({
 src,
 className = '',
 children,
 loading = 'lazy',
}: CDNBackgroundImageProps) {
 const [isLoaded, setIsLoaded] = useState(false);
 const imageUrl = getAssetUrl(src);

 // Preload image
 if (typeof window !== 'undefined' && loading === 'eager') {
 const img = new window.Image();
 img.src = imageUrl;
 img.onload = () => setIsLoaded(true);
 }

 return (
 <div
 className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
 style={{
 backgroundImage: `url(${imageUrl})`,
 backgroundSize: 'cover',
 backgroundPosition: 'center',
 }}
 data-loading={loading}
 >
 {children}
 </div>
 );
}