import { getDb } from '../config/db.config.js';

/**
 * Get all unique sections from products, services, and media
 * Used for dropdowns in admin forms
 */
export async function getAllSections(req, res) {
  try {
    const db = getDb();

    // Get unique sections from products, services, and media
    const [productSections] = await db.query(
      `SELECT DISTINCT section FROM products WHERE section IS NOT NULL AND section != ''`
    );
    
    const [serviceSections] = await db.query(
      `SELECT DISTINCT section FROM services WHERE section IS NOT NULL AND section != ''`
    );
    
    const [mediaSections] = await db.query(
      `SELECT DISTINCT section FROM site_media WHERE section IS NOT NULL AND section != ''`
    );

    // Combine all sections and remove duplicates
    const allSections = new Set();
    
    productSections.forEach(row => {
      if (row.section) allSections.add(row.section);
    });
    
    serviceSections.forEach(row => {
      if (row.section) allSections.add(row.section);
    });
    
    mediaSections.forEach(row => {
      if (row.section) allSections.add(row.section);
    });

    // Convert to sorted array
    const sectionsArray = Array.from(allSections).sort();

    return res.status(200).json({
      success: true,
      data: sectionsArray,
    });
  } catch (err) {
    console.error('Error fetching sections:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch sections',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

