// Use legacy API to avoid deprecation error in SDK 54
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

const getCloudinaryConfig = () => {
  const cloudName = Constants.expoConfig?.extra?.cloudinaryCloudName?.trim() || '';
  const uploadPreset = Constants.expoConfig?.extra?.cloudinaryUploadPreset?.trim() || '';

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary configuration missing. ' +
      'Please set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and ' +
      'EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your .env file.'
    );
  }

  return {cloudName, uploadPreset};
};

/**
 * Upload an image to Cloudinary (client-side, unsigned upload)
 * @param imageUri - Local file URI from ImagePicker
 * @param folder - Optional folder path in Cloudinary (e.g., 'marketplace', 'jobs')
 * @param transformation - NOT USED (unsigned uploads don't support transformation parameter)
 *   Apply transformations when displaying using getCloudinaryUrl() or set eager transformations in upload preset
 * @param vendorId - Optional vendor ID to organize images by vendor
 * @returns Promise<string> - The secure URL of the uploaded image
 */
export const uploadImageToCloudinary = async (
  imageUri: string,
  folder?: string,
  transformation?: string,
  vendorId?: string
): Promise<string> => {
  try {
    const {cloudName, uploadPreset} = getCloudinaryConfig();

    // Read the file as base64
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create FormData for Cloudinary upload
    const formData = new FormData();

    // Add the base64 image data as a data URI
    formData.append('file', `data:image/jpeg;base64,${base64}` as any);

    // Add upload preset (required for unsigned uploads)
    formData.append('upload_preset', uploadPreset);

    // Build folder path with vendor ID if provided
    let folderPath = folder || 'general';
    if (vendorId && folder) {
      // Organize by folder/vendorId (e.g., 'marketplace/vendor123')
      folderPath = `${folder}/${vendorId}`;
    } else if (vendorId) {
      // If only vendorId provided, use vendors/vendorId
      folderPath = `vendors/${vendorId}`;
    }

    // Add folder to upload
    formData.append('folder', folderPath);

    // Note: Transformations cannot be sent with unsigned uploads
    // Apply transformations when generating URLs using getCloudinaryUrl()
    // Or set eager transformations in the upload preset settings

    // Upload directly to Cloudinary (unsigned upload)
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Cloudinary upload failed: ${response.status} - ` +
        `${errorData.error?.message || response.statusText}`
      );
    }

    const data = await response.json();

    // Return the secure URL
    return data.secure_url || data.url;
  } catch (error: any) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error(`Failed to upload image: ${error.message || 'Unknown error'}`);
  }
};

/**
 * Upload multiple images to Cloudinary
 * @param imageUris - Array of local file URIs
 * @param folder - Optional folder path
 * @param transformation - Optional transformation string
 * @param vendorId - Optional vendor ID to organize images by vendor
 * @returns Promise<string[]> - Array of secure URLs
 */
export const uploadMultipleImagesToCloudinary = async (
  imageUris: string[],
  folder?: string,
  transformation?: string,
  vendorId?: string
): Promise<string[]> => {
  try {
    const uploadPromises = imageUris.map((uri) =>
      uploadImageToCloudinary(uri, folder, transformation, vendorId)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading multiple images:', error);
    throw error;
  }
};

/**
 * Generate a Cloudinary URL with transformations
 * @param publicId - Cloudinary public ID or full URL
 * @param transformations - Object with transformation options
 * @returns string - Transformed image URL
 */
export const getCloudinaryUrl = (
  publicIdOrUrl: string,
  transformations?: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'limit';
    quality?: 'auto' | number;
    format?: 'auto' | 'jpg' | 'png' | 'webp';
  }
): string => {
  const {cloudName} = getCloudinaryConfig();

  // If it's already a full Cloudinary URL, extract the public ID
  let publicId = publicIdOrUrl;
  let existingTransformations = '';

  if (publicIdOrUrl.includes('cloudinary.com')) {
    // Match pattern: https://res.cloudinary.com/{cloud}/image/upload/{transformations}/{publicId}.{ext}
    const urlMatch = publicIdOrUrl.match(/\/image\/upload\/([^/]*\/)?(.+)$/);
    if (urlMatch) {
      existingTransformations = urlMatch[1] || '';
      publicId = urlMatch[2];
      // Remove file extension if present (Cloudinary can handle it)
      publicId = publicId.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '');
    } else {
      // Fallback: try to extract just the public ID
      const simpleMatch = publicIdOrUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp|gif)$/i);
      if (simpleMatch) {
        publicId = simpleMatch[1];
      }
    }
  }

  // Build transformation string
  let transformationString = '';
  if (transformations) {
    const parts: string[] = [];
    if (transformations.width) parts.push(`w_${transformations.width}`);
    if (transformations.height) parts.push(`h_${transformations.height}`);
    if (transformations.crop) parts.push(`c_${transformations.crop}`);
    if (transformations.quality) {
      parts.push(
        `q_${transformations.quality === 'auto' ? 'auto' : transformations.quality}`
      );
    }
    if (transformations.format) {
      parts.push(`f_${transformations.format}`);
    }
    if (parts.length > 0) {
      transformationString = parts.join(',') + '/';
    }
  } else if (existingTransformations) {
    // Keep existing transformations if no new ones specified
    transformationString = existingTransformations;
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformationString}${publicId}`;
};

/**
 * Delete an image from Cloudinary
 * Note: This requires Cloudinary API key/secret (not available in client-side)
 * For now, images remain in Cloudinary
 * @param publicId - Cloudinary public ID
 */
export const deleteImageFromCloudinary = async (publicId: string): Promise<void> => {
  // Client-side deletion not supported without API secret
  // Images will remain in Cloudinary
  console.warn('Image deletion not supported from client-side. Images will remain in Cloudinary.');
};
