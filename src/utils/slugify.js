/**
 * Convert a string to a URL-friendly slug
 * SEO-optimized: Creates clean, readable slugs for SEO-friendly URLs
 * 
 * @param {string} text - The text to convert to a slug
 * @returns {string} - The slugified string
 */
export function slugify(text) {
  if (!text) return '';
  
  return text
    .toString()
    .toLowerCase()
    .trim()
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Remove special characters except hyphens
    .replace(/[^\w\-]+/g, '')
    // Replace multiple hyphens with single hyphen
    .replace(/\-\-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Generate a unique slug by appending a number if slug already exists
 * SEO-optimized: Ensures unique slugs for proper URL structure
 * 
 * @param {string} baseSlug - The base slug to check
 * @param {Function} checkExists - Async function that checks if slug exists (returns boolean)
 * @returns {Promise<string>} - Unique slug
 */
export async function generateUniqueSlug(baseSlug, checkExists) {
  let slug = slugify(baseSlug);
  let uniqueSlug = slug;
  let counter = 1;

  while (await checkExists(uniqueSlug)) {
    uniqueSlug = `${slug}-${counter}`;
    counter++;
  }

  return uniqueSlug;
}

