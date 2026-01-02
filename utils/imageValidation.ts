import * as FileSystem from 'expo-file-system/legacy';
import { Alert } from 'react-native';

// Validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  fileSize?: number;
  fileType?: string;
}

/**
 * Validate image file before upload
 * @param imageUri - Local file URI
 * @returns Promise with validation result
 */
export const validateImageFile = async (
  imageUri: string
): Promise<ImageValidationResult> => {
  try {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(imageUri);

    if (!fileInfo.exists) {
      return {
        valid: false,
        error: 'File does not exist',
      };
    }

    // Check file size
    if (fileInfo.size === undefined || fileInfo.size === null) {
      // Try to get size from URI metadata if available
      // For React Native, we might need to read the file to get size
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Approximate size: base64 is ~33% larger than binary
      const estimatedSize = (base64.length * 3) / 4;
      
      if (estimatedSize > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
          fileSize: estimatedSize,
        };
      }
    } else {
      if (fileInfo.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          error: `File size (${(fileInfo.size / (1024 * 1024)).toFixed(2)}MB) exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
          fileSize: fileInfo.size,
        };
      }
    }

    // Check file extension
    const uriLower = imageUri.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
      uriLower.endsWith(ext)
    );

    if (!hasValidExtension) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
      };
    }

    // Determine file type from extension
    let fileType = 'image/jpeg'; // default
    if (uriLower.endsWith('.png')) fileType = 'image/png';
    else if (uriLower.endsWith('.webp')) fileType = 'image/webp';
    else if (uriLower.endsWith('.jpg') || uriLower.endsWith('.jpeg'))
      fileType = 'image/jpeg';

    return {
      valid: true,
      fileSize: fileInfo.size,
      fileType,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Validation error: ${error.message || 'Unknown error'}`,
    };
  }
};

/**
 * Validate and show alert if invalid
 * @param imageUri - Local file URI
 * @returns Promise<boolean> - true if valid, false if invalid
 */
export const validateImageWithAlert = async (
  imageUri: string
): Promise<boolean> => {
  const validation = await validateImageFile(imageUri);

  if (!validation.valid) {
    Alert.alert('Invalid Image', validation.error || 'Image validation failed');
    return false;
  }

  return true;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};




