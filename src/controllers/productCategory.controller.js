import { getDb } from '../config/db.config.js';
import { slugify, generateUniqueSlug } from '../utils/slugify.js';

/**
 * Get all product categories
 * Public endpoint - SEO-critical for navigation and listings
 * SEO-optimized: Single SELECT query, fast response
 */
export async function getAllCategories(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, name, image_url, slug, seo_title, meta_description FROM product_categories ORDER BY name ASC'
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error('Get categories error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product categories',
    });
  }
}

/**
 * Get a single product category by slug
 * Public endpoint - SEO-critical for category pages
 * SEO-optimized: Single SELECT query with slug index
 */
export async function getCategoryBySlug(req, res) {
  try {
    const { slug } = req.params;
    const db = getDb();

    const [rows] = await db.query(
      'SELECT id, name, image_url, slug, seo_title, meta_description FROM product_categories WHERE slug = ? LIMIT 1',
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product category not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (err) {
    console.error('Get category error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product category',
    });
  }
}

/**
 * Create a new product category
 * Admin only - requires authentication
 * SEO-optimized: Auto-generates slug, validates SEO fields
 */
export async function createCategory(req, res) {
  try {
    const { name, image_url, slug, seo_title, meta_description } = req.body;

    // Validation: name is required
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'name is required',
      });
    }

    const db = getDb();

    // Generate slug if not provided
    let finalSlug = slug ? slugify(slug) : slugify(name);
    
    // Ensure slug is unique
    const checkSlugExists = async (slugToCheck) => {
      const [existing] = await db.query(
        'SELECT id FROM product_categories WHERE slug = ? LIMIT 1',
        [slugToCheck]
      );
      return existing.length > 0;
    };

    finalSlug = await generateUniqueSlug(finalSlug, checkSlugExists);

    // Single optimized INSERT query
    const [result] = await db.query(
      'INSERT INTO product_categories (name, image_url, slug, seo_title, meta_description) VALUES (?, ?, ?, ?, ?)',
      [
        name.trim(),
        image_url?.trim() || null,
        finalSlug,
        seo_title?.trim() || null,
        meta_description?.trim() || null,
      ]
    );

    // Fetch the created category
    const [rows] = await db.query(
      'SELECT id, name, image_url, slug, seo_title, meta_description FROM product_categories WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Product category created successfully',
    });
  } catch (err) {
    console.error('Create category error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Slug already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create product category',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Update a product category
 * Admin only - requires authentication
 * SEO-optimized: Handles slug updates with uniqueness check
 */
export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, image_url, slug, seo_title, meta_description } = req.body;

    const db = getDb();

    // Check if category exists
    const [existingRows] = await db.query(
      'SELECT id, slug FROM product_categories WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product category not found',
      });
    }

    // Build dynamic UPDATE query
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (image_url !== undefined) {
      updates.push('image_url = ?');
      values.push(image_url?.trim() || null);
    }
    if (slug !== undefined) {
      // Generate slug and check uniqueness (excluding current category)
      let finalSlug = slugify(slug);
      const checkSlugExists = async (slugToCheck) => {
        const [existing] = await db.query(
          'SELECT id FROM product_categories WHERE slug = ? AND id != ? LIMIT 1',
          [slugToCheck, id]
        );
        return existing.length > 0;
      };
      finalSlug = await generateUniqueSlug(finalSlug, checkSlugExists);
      updates.push('slug = ?');
      values.push(finalSlug);
    }
    if (seo_title !== undefined) {
      updates.push('seo_title = ?');
      values.push(seo_title?.trim() || null);
    }
    if (meta_description !== undefined) {
      updates.push('meta_description = ?');
      values.push(meta_description?.trim() || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    values.push(id);

    // Single optimized UPDATE query
    await db.query(
      `UPDATE product_categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated category
    const [rows] = await db.query(
      'SELECT id, name, image_url, slug, seo_title, meta_description FROM product_categories WHERE id = ? LIMIT 1',
      [id]
    );

    return res.status(200).json({
      success: true,
      data: rows[0],
      message: 'Product category updated successfully',
    });
  } catch (err) {
    console.error('Update category error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Slug already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update product category',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Delete a product category
 * Admin only - requires authentication
 * SEO-optimized: Fast DELETE query
 */
export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Check if category exists
    const [existingRows] = await db.query(
      'SELECT id FROM product_categories WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product category not found',
      });
    }

    // Check if category has products (optional - can be handled by FK constraint)
    const [productsCount] = await db.query(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
      [id]
    );

    if (productsCount[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete category with existing products',
      });
    }

    // Single optimized DELETE query
    const [result] = await db.query('DELETE FROM product_categories WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product category not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product category deleted successfully',
    });
  } catch (err) {
    console.error('Delete category error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product category',
    });
  }
}

