import { validateUploadThingConfig, uploadthingConfig } from '../config/uploadthing.config.js';

/**
 * UploadThing utility for file uploads
 * Uses UploadThing REST API for server-side file management
 */

const UPLOADTHING_API_URL = 'https://api.uploadthing.com';

/**
 * Initialize UploadThing (validates configuration)
 */
export function initUploadThing() {
  const isValid = validateUploadThingConfig();
  if (isValid) {
    console.log('[UploadThing] Configuration validated successfully');
  } else {
    console.warn('[UploadThing] Configuration incomplete, file uploads may fail');
  }
  return isValid;
}

/**
 * Upload file to UploadThing using REST API
 * Note: For direct file uploads, use the UploadThing client SDK on the frontend
 * This utility is for server-side file management operations
 * 
 * @param {string} fileUrl - URL of file to upload (from frontend UploadThing upload)
 * @param {string} folder - Folder path for organization
 * @returns {Promise<{url: string, key: string}>}
 */
export async function processUploadedFile(fileUrl, folder = 'general') {
  // When files are uploaded via UploadThing client on frontend,
  // they return a URL. We just need to store that URL in the database.
  // This function is a placeholder for any post-processing needed.
  
  return {
    url: fileUrl,
    key: extractKeyFromUrl(fileUrl),
  };
}

/**
 * Extract file key from UploadThing URL
 */
function extractKeyFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    return pathParts[pathParts.length - 1];
  } catch {
    return null;
  }
}

/**
 * Delete file from UploadThing using REST API
 * @param {string} fileKey - File key from UploadThing
 * @returns {Promise<boolean>}
 */
export async function deleteFile(fileKey) {
  try {
    if (!uploadthingConfig.secret) {
      throw new Error('UploadThing secret not configured');
    }

    const response = await fetch(`${UPLOADTHING_API_URL}/api/deleteFile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Uploadthing-Secret': uploadthingConfig.secret,
      },
      body: JSON.stringify({
        fileKeys: [fileKey],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Delete failed: ${error}`);
    }

    return true;
  } catch (error) {
    console.error('[UploadThing] Delete error:', error);
    throw error;
  }
}

/**
 * Delete multiple files from UploadThing
 * @param {string[]} fileKeys - Array of file keys
 * @returns {Promise<boolean>}
 */
export async function deleteFiles(fileKeys) {
  try {
    if (!uploadthingConfig.secret) {
      throw new Error('UploadThing secret not configured');
    }

    if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
      throw new Error('fileKeys must be a non-empty array');
    }

    const response = await fetch(`${UPLOADTHING_API_URL}/api/deleteFile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Uploadthing-Secret': uploadthingConfig.secret,
      },
      body: JSON.stringify({
        fileKeys,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Delete failed: ${error}`);
    }

    return true;
  } catch (error) {
    console.error('[UploadThing] Delete multiple files error:', error);
    throw error;
  }
}

