import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCloudinaryUrl } from '@/services/cloudinaryService';

interface CloudinaryImageProps {
  source: string | { uri: string } | string[];
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'limit';
  quality?: 'auto' | number;
  format?: 'auto' | 'jpg' | 'png' | 'webp';
  placeholder?: boolean;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

/**
 * CloudinaryImage Component
 * 
 * Displays images from Cloudinary with automatic optimization.
 * Supports single images, arrays of images, and various transformations.
 * 
 * @example
 * <CloudinaryImage 
 *   source={product.images[0]} 
 *   width={300} 
 *   height={300} 
 *   crop="fill"
 * />
 */
export const CloudinaryImage: React.FC<CloudinaryImageProps> = ({
  source,
  style,
  containerStyle,
  width,
  height,
  crop = 'fill',
  quality = 'auto',
  format = 'auto',
  placeholder = true,
  resizeMode = 'cover',
}) => {
  // Handle array of images (use first one)
  const imageUrl = Array.isArray(source) 
    ? source[0] 
    : typeof source === 'string' 
    ? source 
    : source?.uri || '';

  if (!imageUrl) {
    if (placeholder) {
      return (
        <View style={[style, containerStyle, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
          <Ionicons name="image-outline" size={30} color="#ccc" />
        </View>
      );
    }
    return null;
  }

  // Check if it's already a Cloudinary URL
  const isCloudinaryUrl = imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com');

  // If it's a Cloudinary URL and we have transformations, apply them
  let optimizedUrl = imageUrl;
  if (isCloudinaryUrl && (width || height || crop || quality || format)) {
    optimizedUrl = getCloudinaryUrl(imageUrl, {
      width,
      height,
      crop,
      quality,
      format,
    });
  }

  return (
    <Image
      source={{ uri: optimizedUrl }}
      style={style}
      resizeMode={resizeMode}
    />
  );
};

/**
 * OptimizedImage - Shorthand for common use cases
 */
export const OptimizedImage: React.FC<{
  uri: string;
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
  thumbnail?: boolean;
}> = ({ uri, width, height, style, thumbnail = false }) => {
  return (
    <CloudinaryImage
      source={uri}
      width={thumbnail ? 200 : width}
      height={thumbnail ? 200 : height}
      crop={thumbnail ? 'thumb' : 'fill'}
      quality="auto"
      format="auto"
      style={style}
    />
  );
};


