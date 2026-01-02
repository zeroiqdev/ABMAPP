import { getCloudinaryUrl } from '@/services/cloudinaryService';

/**
 * Image size presets for consistent image optimization across the app
 */
export const ImageSizes = {
  // Thumbnail sizes
  thumbnail: { width: 150, height: 150, crop: 'thumb' as const },
  smallThumbnail: { width: 100, height: 100, crop: 'thumb' as const },
  
  // Product/Marketplace images
  productCard: { width: 300, height: 300, crop: 'fill' as const },
  productDetail: { width: 800, height: 800, crop: 'limit' as const },
  productCarousel: { width: 1200, height: 1200, crop: 'limit' as const },
  
  // Job/Service images
  jobThumbnail: { width: 200, height: 200, crop: 'fill' as const },
  jobDetail: { width: 1200, height: 1200, crop: 'limit' as const },
  
  // Avatar/Profile images
  avatar: { width: 100, height: 100, crop: 'fill' as const },
  avatarLarge: { width: 200, height: 200, crop: 'fill' as const },
  
  // General purpose
  medium: { width: 500, height: 500, crop: 'limit' as const },
  large: { width: 1000, height: 1000, crop: 'limit' as const },
} as const;

/**
 * Get optimized Cloudinary URL for a specific use case
 */
export const getOptimizedImageUrl = (
  imageUrl: string,
  size: keyof typeof ImageSizes
): string => {
  const preset = ImageSizes[size];
  return getCloudinaryUrl(imageUrl, {
    ...preset,
    quality: 'auto',
    format: 'auto',
  });
};

/**
 * Get optimized image URL with custom dimensions
 */
export const getCustomImageUrl = (
  imageUrl: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'limit';
  }
): string => {
  return getCloudinaryUrl(imageUrl, {
    ...options,
    quality: 'auto',
    format: 'auto',
  });
};




