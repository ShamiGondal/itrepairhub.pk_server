import { config as loadEnv } from 'dotenv';

loadEnv();

/**
 * UploadThing Configuration
 * Used for file uploads to UploadThing CDN
 * 
 * Environment variables:
 * - UPLOADTHING_SECRET: Your UploadThing secret key (sk_live_...)
 * - UPLOADTHING_TOKEN: Your UploadThing token (optional, for client-side)
 * - UPLOADTHING_APP_ID: Your UploadThing app ID (from token if needed)
 */
export const uploadthingConfig = {
  secret: process.env.UPLOADTHING_SECRET || process.env.UPLOADTHING_TOKEN || '',
  appId: process.env.UPLOADTHING_APP_ID || '',
};

/**
 * Validate UploadThing configuration
 */
export function validateUploadThingConfig() {
  if (!uploadthingConfig.secret) {
    console.warn('[UploadThing] UPLOADTHING_SECRET not configured');
    return false;
  }
  if (!uploadthingConfig.appId) {
    console.warn('[UploadThing] UPLOADTHING_APP_ID not configured');
    return false;
  }
  return true;
}

/**
 * Folder structure for media uploads
 * Organized by section and media type for better organization
 */
export const MEDIA_FOLDERS = {
  hero_slider: 'hero-slider',
  about_video: 'about-video',
  service_images: 'services',
  product_images: 'products',
  category_images: 'categories',
  general: 'general',
};

/**
 * Get folder path based on section
 */
export function getMediaFolder(section, mediaType = 'image') {
  const folder = MEDIA_FOLDERS[section] || MEDIA_FOLDERS.general;
  return `${folder}/${mediaType}s`;
}

