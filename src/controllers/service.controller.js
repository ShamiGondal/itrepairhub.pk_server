import { getDb } from '../config/db.config.js';
import { slugify, generateUniqueSlug } from '../utils/slugify.js';

/**
 * Get all services with optional filtering
 * Public endpoint - SEO-critical for service listings
 * SEO-optimized: Single SELECT query with indexes, supports filtering
 */
export async function getAllServices(req, res) {
  try {
    const { category_id, service_type, price_type, section, is_active, search } = req.query;
    const db = getDb();

    // Build dynamic WHERE clause
    const conditions = [];
    const values = [];

    if (category_id) {
      conditions.push('s.category_id = ?');
      values.push(category_id);
    }
    if (service_type) {
      conditions.push('s.service_type = ?');
      values.push(service_type);
    }
    if (price_type) {
      conditions.push('s.price_type = ?');
      values.push(price_type);
    }
    if (section) {
      conditions.push('s.section = ?');
      values.push(section);
    }
    if (is_active !== undefined) {
      conditions.push('s.is_active = ?');
      values.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }
    if (search) {
      conditions.push('(s.name LIKE ? OR s.short_description LIKE ?)');
      const searchTerm = `%${search}%`;
      values.push(searchTerm, searchTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // SEO-optimized: Single query with JOIN for category name
    const [rows] = await db.query(
      `SELECT 
        s.id, 
        s.category_id, 
        s.name, 
        s.slug, 
        s.short_description, 
        s.service_type, 
        s.price_type, 
        s.price, 
        s.average_rating, 
        s.review_count, 
        s.warranty_info, 
        s.seo_title, 
        s.meta_description, 
        s.is_active, 
        s.section,
        sc.name as category_name,
        sc.slug as category_slug
      FROM services s
      LEFT JOIN service_categories sc ON s.category_id = sc.id
      ${whereClause}
      ORDER BY s.name ASC`,
      values
    );

    // Fetch images for all services (SEO-optimized: Single query for all images)
    const serviceIds = rows.map(row => row.id);
    let imagesMap = {};
    if (serviceIds.length > 0) {
      const placeholders = serviceIds.map(() => '?').join(',');
      const [imageRows] = await db.query(
        `SELECT service_id, image_url, alt_text, display_order 
         FROM service_images 
         WHERE service_id IN (${placeholders}) 
         ORDER BY service_id, display_order ASC`,
        serviceIds
      );

      // Group images by service_id
      imageRows.forEach(img => {
        if (!imagesMap[img.service_id]) {
          imagesMap[img.service_id] = [];
        }
        imagesMap[img.service_id].push({
          image_url: img.image_url,
          alt_text: img.alt_text,
          display_order: img.display_order,
        });
      });
    }

    // Attach images to services
    const servicesWithImages = rows.map(service => ({
      ...service,
      images: imagesMap[service.id] || [],
      // Main image (display_order = 0) for backward compatibility
      image_url: imagesMap[service.id]?.find(img => img.display_order === 0)?.image_url || null,
    }));

    return res.status(200).json({
      success: true,
      data: servicesWithImages,
    });
  } catch (err) {
    console.error('Get services error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch services',
    });
  }
}

/**
 * Get a single service by slug
 * Public endpoint - SEO-critical for service detail pages
 * SEO-optimized: Single SELECT query with slug index, includes all SEO fields
 */
export async function getServiceBySlug(req, res) {
  try {
    const { slug } = req.params;
    const db = getDb();

    // SEO-optimized: Single query with JOIN for complete data
    const [rows] = await db.query(
      `SELECT 
        s.id, 
        s.category_id, 
        s.name, 
        s.slug, 
        s.short_description, 
        s.long_description, 
        s.specifications, 
        s.service_type, 
        s.price_type, 
        s.price, 
        s.average_rating, 
        s.review_count, 
        s.warranty_info, 
        s.seo_title, 
        s.meta_description, 
        s.is_active, 
        s.section,
        sc.name as category_name,
        sc.slug as category_slug
      FROM services s
      LEFT JOIN service_categories sc ON s.category_id = sc.id
      WHERE s.slug = ? AND s.is_active = 1
      LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    const service = rows[0];

    // Fetch images for the service (SEO-optimized: Single query)
    const [imageRows] = await db.query(
      `SELECT id, image_url, alt_text, display_order 
       FROM service_images 
       WHERE service_id = ? 
       ORDER BY display_order ASC`,
      [service.id]
    );

    // Parse JSON specifications if present
    if (service.specifications) {
      try {
        service.specifications = typeof service.specifications === 'string' 
          ? JSON.parse(service.specifications) 
          : service.specifications;
      } catch (err) {
        service.specifications = null;
      }
    }

    // Attach images to service
    service.images = imageRows.map(img => ({
      id: img.id,
      image_url: img.image_url,
      alt_text: img.alt_text,
      display_order: img.display_order,
    }));

    // Main image (display_order = 0) for backward compatibility
    service.image_url = imageRows.find(img => img.display_order === 0)?.image_url || null;

    return res.status(200).json({
      success: true,
      data: service,
    });
  } catch (err) {
    console.error('Get service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service',
    });
  }
}

/**
 * Create a new service
 * Admin only - requires authentication
 * SEO-optimized: Auto-generates slug, validates SEO fields, handles JSON properly
 */
export async function createService(req, res) {
  try {
    const {
      category_id,
      name,
      slug,
      short_description,
      long_description,
      specifications,
      service_type,
      price_type,
      price,
      warranty_info,
      seo_title,
      meta_description,
      is_active,
      section,
      images, // Array of { image_url, alt_text, display_order }
    } = req.body;

    // Validation: name, service_type, price_type are required
    if (!name || !service_type || !price_type) {
      return res.status(400).json({
        success: false,
        message: 'name, service_type, and price_type are required',
      });
    }

    // Validate enums
    if (!['hardware', 'software'].includes(service_type)) {
      return res.status(400).json({
        success: false,
        message: 'service_type must be either "hardware" or "software"',
      });
    }

    if (!['variable', 'fixed'].includes(price_type)) {
      return res.status(400).json({
        success: false,
        message: 'price_type must be either "variable" or "fixed"',
      });
    }

    // Validate price if price_type is fixed
    if (price_type === 'fixed' && (!price || price <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'price is required and must be greater than 0 when price_type is "fixed"',
      });
    }

    // Validate category_id if provided
    if (category_id) {
      const db = getDb();
      const [categoryCheck] = await db.query(
        'SELECT id FROM service_categories WHERE id = ? LIMIT 1',
        [category_id]
      );
      if (categoryCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category_id',
        });
      }
    }

    const db = getDb();

    // Generate slug if not provided
    let finalSlug = slug ? slugify(slug) : slugify(name);
    
    // Ensure slug is unique
    const checkSlugExists = async (slugToCheck) => {
      const [existing] = await db.query(
        'SELECT id FROM services WHERE slug = ? LIMIT 1',
        [slugToCheck]
      );
      return existing.length > 0;
    };

    finalSlug = await generateUniqueSlug(finalSlug, checkSlugExists);

    // Handle specifications JSON
    let specificationsJson = null;
    if (specifications) {
      try {
        // If it's already an object, stringify it; if it's a string, parse then stringify to validate
        if (typeof specifications === 'string') {
          JSON.parse(specifications); // Validate it's valid JSON
          specificationsJson = specifications;
        } else {
          specificationsJson = JSON.stringify(specifications);
        }
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'specifications must be valid JSON',
        });
      }
    }

    // Start transaction for service and images
    await db.query('START TRANSACTION');

    try {
      // Single optimized INSERT query for service
      const [result] = await db.query(
        `INSERT INTO services (
          category_id, name, slug, short_description, long_description, 
          specifications, service_type, price_type, price, warranty_info, 
          seo_title, meta_description, is_active, section
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category_id || null,
          name.trim(),
          finalSlug,
          short_description?.trim() || null,
          long_description?.trim() || null,
          specificationsJson,
          service_type,
          price_type,
          price_type === 'fixed' ? price : null,
          warranty_info?.trim() || null,
          seo_title?.trim() || null,
          meta_description?.trim() || null,
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          section?.trim() || null,
        ]
      );

      const serviceId = result.insertId;

      // Insert images if provided
      if (images && Array.isArray(images) && images.length > 0) {
        for (const img of images) {
          if (img.image_url) {
            await db.query(
              'INSERT INTO service_images (service_id, image_url, alt_text, display_order) VALUES (?, ?, ?, ?)',
              [
                serviceId,
                img.image_url.trim(),
                img.alt_text?.trim() || null,
                img.display_order !== undefined ? img.display_order : 0,
              ]
            );
          }
        }
      }

      await db.query('COMMIT');

      // Fetch the created service with images
      const [rows] = await db.query(
        `SELECT 
          id, category_id, name, slug, short_description, long_description, 
          specifications, service_type, price_type, price, average_rating, review_count, 
          warranty_info, seo_title, meta_description, is_active, section
        FROM services WHERE id = ? LIMIT 1`,
        [serviceId]
      );

      // Fetch images
      const [imageRows] = await db.query(
        `SELECT id, image_url, alt_text, display_order 
         FROM service_images 
         WHERE service_id = ? 
         ORDER BY display_order ASC`,
        [serviceId]
      );

      // Parse JSON specifications
      const service = rows[0];
      if (service.specifications) {
        try {
          service.specifications = typeof service.specifications === 'string' 
            ? JSON.parse(service.specifications) 
            : service.specifications;
        } catch (err) {
          service.specifications = null;
        }
      }

      // Attach images
      service.images = imageRows.map(img => ({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        display_order: img.display_order,
      }));
      service.image_url = imageRows.find(img => img.display_order === 0)?.image_url || null;

      return res.status(201).json({
        success: true,
        data: service,
        message: 'Service created successfully',
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Create service error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Slug already exists',
      });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category_id',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create service',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Update a service
 * Admin only - requires authentication
 * SEO-optimized: Handles slug updates, JSON specifications, all field types properly
 */
export async function updateService(req, res) {
  try {
    const { id } = req.params;
    const {
      category_id,
      name,
      slug,
      short_description,
      long_description,
      specifications,
      service_type,
      price_type,
      price,
      warranty_info,
      seo_title,
      meta_description,
      is_active,
      section,
      images, // Array of { id?, image_url, alt_text, display_order } - id for update, no id for new
    } = req.body;

    const db = getDb();

    // Check if service exists
    const [existingRows] = await db.query(
      'SELECT id, slug FROM services WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Validate enums if provided
    if (service_type && !['hardware', 'software'].includes(service_type)) {
      return res.status(400).json({
        success: false,
        message: 'service_type must be either "hardware" or "software"',
      });
    }

    if (price_type && !['variable', 'fixed'].includes(price_type)) {
      return res.status(400).json({
        success: false,
        message: 'price_type must be either "variable" or "fixed"',
      });
    }

    // Validate price if price_type is being set to fixed
    if (price_type === 'fixed' && price !== undefined && (!price || price <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'price is required and must be greater than 0 when price_type is "fixed"',
      });
    }

    // Build dynamic UPDATE query
    const updates = [];
    const values = [];

    if (category_id !== undefined) {
      updates.push('category_id = ?');
      values.push(category_id || null);
    }
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (slug !== undefined) {
      // Generate slug and check uniqueness (excluding current service)
      let finalSlug = slugify(slug);
      const checkSlugExists = async (slugToCheck) => {
        const [existing] = await db.query(
          'SELECT id FROM services WHERE slug = ? AND id != ? LIMIT 1',
          [slugToCheck, id]
        );
        return existing.length > 0;
      };
      finalSlug = await generateUniqueSlug(finalSlug, checkSlugExists);
      updates.push('slug = ?');
      values.push(finalSlug);
    }
    // Images are handled separately in service_images table
    if (short_description !== undefined) {
      updates.push('short_description = ?');
      values.push(short_description?.trim() || null);
    }
    if (long_description !== undefined) {
      updates.push('long_description = ?');
      values.push(long_description?.trim() || null);
    }
    if (specifications !== undefined) {
      // Handle JSON specifications
      let specificationsJson = null;
      if (specifications) {
        try {
          if (typeof specifications === 'string') {
            JSON.parse(specifications); // Validate
            specificationsJson = specifications;
          } else {
            specificationsJson = JSON.stringify(specifications);
          }
        } catch (err) {
          return res.status(400).json({
            success: false,
            message: 'specifications must be valid JSON',
          });
        }
      }
      updates.push('specifications = ?');
      values.push(specificationsJson);
    }
    if (service_type !== undefined) {
      updates.push('service_type = ?');
      values.push(service_type);
    }
    if (price_type !== undefined) {
      updates.push('price_type = ?');
      values.push(price_type);
      // Clear price if switching to variable
      if (price_type === 'variable') {
        updates.push('price = ?');
        values.push(null);
      }
    }
    if (price !== undefined) {
      if (price_type === 'fixed' || (price_type === undefined && existingRows[0].price_type === 'fixed')) {
        updates.push('price = ?');
        values.push(price);
      }
    }
    if (warranty_info !== undefined) {
      updates.push('warranty_info = ?');
      values.push(warranty_info?.trim() || null);
    }
    if (seo_title !== undefined) {
      updates.push('seo_title = ?');
      values.push(seo_title?.trim() || null);
    }
    if (meta_description !== undefined) {
      updates.push('meta_description = ?');
      values.push(meta_description?.trim() || null);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    if (section !== undefined) {
      updates.push('section = ?');
      values.push(section?.trim() || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    values.push(id);

    // Start transaction for service and images
    await db.query('START TRANSACTION');

    try {
      // Single optimized UPDATE query for service
      if (updates.length > 0) {
        await db.query(
          `UPDATE services SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }

      // Handle images if provided
      if (images !== undefined && Array.isArray(images)) {
        // Get existing images
        const [existingImages] = await db.query(
          'SELECT id FROM service_images WHERE service_id = ?',
          [id]
        );
        const existingImageIds = existingImages.map(img => img.id);

        // Process each image
        for (const img of images) {
          if (img.id) {
            // Update existing image
            if (existingImageIds.includes(img.id)) {
              await db.query(
                'UPDATE service_images SET image_url = ?, alt_text = ?, display_order = ? WHERE id = ? AND service_id = ?',
                [
                  img.image_url?.trim(),
                  img.alt_text?.trim() || null,
                  img.display_order !== undefined ? img.display_order : 0,
                  img.id,
                  id,
                ]
              );
              // Remove from existing list
              const index = existingImageIds.indexOf(img.id);
              if (index > -1) existingImageIds.splice(index, 1);
            }
          } else if (img.image_url) {
            // Insert new image
            await db.query(
              'INSERT INTO service_images (service_id, image_url, alt_text, display_order) VALUES (?, ?, ?, ?)',
              [
                id,
                img.image_url.trim(),
                img.alt_text?.trim() || null,
                img.display_order !== undefined ? img.display_order : 0,
              ]
            );
          }
        }

        // Delete images that were not in the update list
        if (existingImageIds.length > 0) {
          const placeholders = existingImageIds.map(() => '?').join(',');
          await db.query(
            `DELETE FROM service_images WHERE id IN (${placeholders}) AND service_id = ?`,
            [...existingImageIds, id]
          );
        }
      }

      await db.query('COMMIT');

      // Fetch updated service
      const [rows] = await db.query(
        `SELECT 
          id, category_id, name, slug, short_description, long_description, 
          specifications, service_type, price_type, price, average_rating, review_count, 
          warranty_info, seo_title, meta_description, is_active, section
        FROM services WHERE id = ? LIMIT 1`,
        [id]
      );

      // Fetch images
      const [imageRows] = await db.query(
        `SELECT id, image_url, alt_text, display_order 
         FROM service_images 
         WHERE service_id = ? 
         ORDER BY display_order ASC`,
        [id]
      );

      // Parse JSON specifications
      const service = rows[0];
      if (service.specifications) {
        try {
          service.specifications = typeof service.specifications === 'string' 
            ? JSON.parse(service.specifications) 
            : service.specifications;
        } catch (err) {
          service.specifications = null;
        }
      }

      // Attach images
      service.images = imageRows.map(img => ({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        display_order: img.display_order,
      }));
      service.image_url = imageRows.find(img => img.display_order === 0)?.image_url || null;

      return res.status(200).json({
        success: true,
        data: service,
        message: 'Service updated successfully',
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Update service error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Slug already exists',
      });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Invalid category_id',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update service',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Delete a service
 * Admin only - requires authentication
 * SEO-optimized: Fast DELETE query (cascades to service_images)
 */
export async function deleteService(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Check if service exists
    const [existingRows] = await db.query(
      'SELECT id FROM services WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Single optimized DELETE query (images will be deleted via CASCADE)
    const [result] = await db.query('DELETE FROM services WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (err) {
    console.error('Delete service error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete service',
    });
  }
}

/**
 * Add image to a service
 * Admin only - requires authentication
 * SEO-optimized: Fast INSERT query with alt_text for SEO
 */
export async function addServiceImage(req, res) {
  try {
    const { service_id } = req.params;
    const { image_url, alt_text, display_order } = req.body;

    if (!image_url) {
      return res.status(400).json({
        success: false,
        message: 'image_url is required',
      });
    }

    const db = getDb();

    // Check if service exists
    const [serviceCheck] = await db.query(
      'SELECT id FROM services WHERE id = ? LIMIT 1',
      [service_id]
    );

    if (serviceCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Single optimized INSERT query
    const [result] = await db.query(
      'INSERT INTO service_images (service_id, image_url, alt_text, display_order) VALUES (?, ?, ?, ?)',
      [
        service_id,
        image_url.trim(),
        alt_text?.trim() || null,
        display_order !== undefined ? display_order : 0,
      ]
    );

    // Fetch the created image
    const [rows] = await db.query(
      'SELECT id, service_id, image_url, alt_text, display_order, created_at FROM service_images WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Service image added successfully',
    });
  } catch (err) {
    console.error('Add service image error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add service image',
    });
  }
}

/**
 * Update a service image
 * Admin only - requires authentication
 * SEO-optimized: Fast UPDATE query
 */
export async function updateServiceImage(req, res) {
  try {
    const { service_id, image_id } = req.params;
    const { image_url, alt_text, display_order } = req.body;

    const db = getDb();

    // Check if image exists and belongs to the service
    const [existingRows] = await db.query(
      'SELECT id FROM service_images WHERE id = ? AND service_id = ? LIMIT 1',
      [image_id, service_id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service image not found',
      });
    }

    // Build dynamic UPDATE query
    const updates = [];
    const values = [];

    if (image_url !== undefined) {
      updates.push('image_url = ?');
      values.push(image_url.trim());
    }
    if (alt_text !== undefined) {
      updates.push('alt_text = ?');
      values.push(alt_text?.trim() || null);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(display_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    values.push(image_id, service_id);

    // Single optimized UPDATE query
    await db.query(
      `UPDATE service_images SET ${updates.join(', ')} WHERE id = ? AND service_id = ?`,
      values
    );

    // Fetch updated image
    const [rows] = await db.query(
      'SELECT id, service_id, image_url, alt_text, display_order, created_at FROM service_images WHERE id = ? AND service_id = ? LIMIT 1',
      [image_id, service_id]
    );

    return res.status(200).json({
      success: true,
      data: rows[0],
      message: 'Service image updated successfully',
    });
  } catch (err) {
    console.error('Update service image error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update service image',
    });
  }
}

/**
 * Delete a service image
 * Admin only - requires authentication
 * SEO-optimized: Fast DELETE query
 */
export async function deleteServiceImage(req, res) {
  try {
    const { service_id, image_id } = req.params;
    const db = getDb();

    // Check if image exists and belongs to the service
    const [existingRows] = await db.query(
      'SELECT id FROM service_images WHERE id = ? AND service_id = ? LIMIT 1',
      [image_id, service_id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service image not found',
      });
    }

    // Single optimized DELETE query
    const [result] = await db.query(
      'DELETE FROM service_images WHERE id = ? AND service_id = ?',
      [image_id, service_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service image not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Service image deleted successfully',
    });
  } catch (err) {
    console.error('Delete service image error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete service image',
    });
  }
}

