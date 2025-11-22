import { getDb } from '../config/db.config.js';
import { slugify, generateUniqueSlug } from '../utils/slugify.js';

/**
 * Get all products with optional filtering
 * Public endpoint - SEO-critical for product listings
 * SEO-optimized: Single SELECT query with indexes, supports filtering
 */
export async function getAllProducts(req, res) {
  try {
    const { category_id, condition, section, is_active, search, min_price, max_price, in_stock } = req.query;
    const db = getDb();

    // Build dynamic WHERE clause
    const conditions = [];
    const values = [];

    if (category_id) {
      conditions.push('p.category_id = ?');
      values.push(category_id);
    }
    if (condition) {
      conditions.push('p.`condition` = ?');
      values.push(condition);
    }
    if (section) {
      conditions.push('p.section = ?');
      values.push(section);
    }
    if (is_active !== undefined) {
      conditions.push('p.is_active = ?');
      values.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }
    if (search) {
      conditions.push('(p.name LIKE ? OR p.short_description LIKE ? OR p.sku LIKE ?)');
      const searchTerm = `%${search}%`;
      values.push(searchTerm, searchTerm, searchTerm);
    }
    if (min_price) {
      conditions.push('p.price >= ?');
      values.push(parseFloat(min_price));
    }
    if (max_price) {
      conditions.push('p.price <= ?');
      values.push(parseFloat(max_price));
    }
    if (in_stock === 'true' || in_stock === '1') {
      conditions.push('p.stock_quantity > 0');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // SEO-optimized: Single query with JOIN for category name
    const [rows] = await db.query(
      `SELECT 
        p.id, 
        p.category_id, 
        p.name, 
        p.slug, 
        p.sku,
        p.\`condition\`,
        p.price,
        p.discount_percentage,
        p.stock_quantity,
        p.short_description, 
        p.average_rating, 
        p.review_count, 
        p.warranty_info, 
        p.seo_title, 
        p.meta_description, 
        p.is_active, 
        p.section,
        pc.name as category_name,
        pc.slug as category_slug
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      ${whereClause}
      ORDER BY p.name ASC`,
      values
    );

    // Fetch images for all products (SEO-optimized: Single query for all images)
    const productIds = rows.map(row => row.id);
    let imagesMap = {};
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const [imageRows] = await db.query(
        `SELECT product_id, image_url, alt_text, display_order 
         FROM product_images 
         WHERE product_id IN (${placeholders}) 
         ORDER BY product_id, display_order ASC`,
        productIds
      );

      // Group images by product_id
      imageRows.forEach(img => {
        if (!imagesMap[img.product_id]) {
          imagesMap[img.product_id] = [];
        }
        imagesMap[img.product_id].push({
          image_url: img.image_url,
          alt_text: img.alt_text,
          display_order: img.display_order,
        });
      });
    }

    // Attach images to products and calculate discounted price
    const productsWithImages = rows.map(product => {
      const originalPrice = parseFloat(product.price) || 0;
      const discountPercentage = parseFloat(product.discount_percentage) || 0;
      const discountedPrice = discountPercentage > 0 
        ? originalPrice * (1 - discountPercentage / 100)
        : originalPrice;

      return {
        ...product,
        price: originalPrice,
        original_price: discountPercentage > 0 ? originalPrice : null,
        discounted_price: discountPercentage > 0 ? parseFloat(discountedPrice.toFixed(2)) : originalPrice,
        discount_percentage: discountPercentage,
        images: imagesMap[product.id] || [],
        // Main image (display_order = 0) for backward compatibility
        image_url: imagesMap[product.id]?.find(img => img.display_order === 0)?.image_url || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: productsWithImages,
    });
  } catch (err) {
    console.error('Get products error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
    });
  }
}

/**
 * Get a single product by slug
 * Public endpoint - SEO-critical for product detail pages
 * SEO-optimized: Single SELECT query with slug index, includes all SEO fields
 */
export async function getProductBySlug(req, res) {
  try {
    const { slug } = req.params;
    const db = getDb();

    // SEO-optimized: Single query with JOIN for complete data
    const [rows] = await db.query(
      `SELECT 
        p.id, 
        p.category_id, 
        p.name, 
        p.slug, 
        p.sku,
        p.\`condition\`,
        p.price,
        p.discount_percentage,
        p.stock_quantity,
        p.short_description, 
        p.long_description, 
        p.specifications, 
        p.average_rating, 
        p.review_count, 
        p.warranty_info, 
        p.seo_title, 
        p.meta_description, 
        p.is_active, 
        p.section,
        pc.name as category_name,
        pc.slug as category_slug
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.slug = ? AND p.is_active = 1
      LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const product = rows[0];

    // Fetch images for the product (SEO-optimized: Single query)
    const [imageRows] = await db.query(
      `SELECT id, image_url, alt_text, display_order 
       FROM product_images 
       WHERE product_id = ? 
       ORDER BY display_order ASC`,
      [product.id]
    );

    // Parse JSON specifications if present
    if (product.specifications) {
      try {
        product.specifications = typeof product.specifications === 'string' 
          ? JSON.parse(product.specifications) 
          : product.specifications;
      } catch (err) {
        product.specifications = null;
      }
    }

    // Calculate discounted price
    const originalPrice = parseFloat(product.price) || 0;
    const discountPercentage = parseFloat(product.discount_percentage) || 0;
    const discountedPrice = discountPercentage > 0 
      ? originalPrice * (1 - discountPercentage / 100)
      : originalPrice;

    // Attach images to product
    product.images = imageRows.map(img => ({
      id: img.id,
      image_url: img.image_url,
      alt_text: img.alt_text,
      display_order: img.display_order,
    }));

    // Main image (display_order = 0) for backward compatibility
    product.image_url = imageRows.find(img => img.display_order === 0)?.image_url || null;

    // Add pricing fields
    product.price = originalPrice;
    product.original_price = discountPercentage > 0 ? originalPrice : null;
    product.discounted_price = discountPercentage > 0 ? parseFloat(discountedPrice.toFixed(2)) : originalPrice;
    product.discount_percentage = discountPercentage;

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (err) {
    console.error('Get product error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product',
    });
  }
}

/**
 * Create a new product
 * Admin only - requires authentication
 * SEO-optimized: Auto-generates slug, validates SEO fields, handles JSON properly
 */
export async function createProduct(req, res) {
  try {
    const {
      category_id,
      name,
      slug,
      sku,
      condition,
      price,
      discount_percentage,
      stock_quantity,
      short_description,
      long_description,
      specifications,
      warranty_info,
      seo_title,
      meta_description,
      is_active,
      section,
      images, // Array of { image_url, alt_text, display_order }
    } = req.body;

    // Validation: name, sku, condition, price are required
    if (!name || !sku || !condition || !price) {
      return res.status(400).json({
        success: false,
        message: 'name, sku, condition, and price are required',
      });
    }

    // Validate enums
    if (!['new', 'used'].includes(condition)) {
      return res.status(400).json({
        success: false,
        message: 'condition must be either "new" or "used"',
      });
    }

    // Validate price
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'price must be greater than 0',
      });
    }

    // Validate discount_percentage
    if (discount_percentage !== undefined) {
      if (discount_percentage < 0 || discount_percentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'discount_percentage must be between 0 and 100',
        });
      }
    }

    // Validate stock_quantity
    if (stock_quantity !== undefined && stock_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'stock_quantity cannot be negative',
      });
    }

    // Validate category_id if provided
    if (category_id) {
      const db = getDb();
      const [categoryCheck] = await db.query(
        'SELECT id FROM product_categories WHERE id = ? LIMIT 1',
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
        'SELECT id FROM products WHERE slug = ? LIMIT 1',
        [slugToCheck]
      );
      return existing.length > 0;
    };

    finalSlug = await generateUniqueSlug(finalSlug, checkSlugExists);

    // Check if SKU already exists
    const [skuCheck] = await db.query(
      'SELECT id FROM products WHERE sku = ? LIMIT 1',
      [sku.trim()]
    );
    if (skuCheck.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'SKU already exists',
      });
    }

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

    // Start transaction for product and images
    await db.query('START TRANSACTION');

    try {
      // Single optimized INSERT query for product
      const [result] = await db.query(
        `INSERT INTO products (
          category_id, name, slug, sku, \`condition\`, price, discount_percentage, stock_quantity,
          short_description, long_description, specifications, warranty_info, 
          seo_title, meta_description, is_active, section
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category_id || null,
          name.trim(),
          finalSlug,
          sku.trim(),
          condition,
          price,
          discount_percentage !== undefined ? discount_percentage : 0.00,
          stock_quantity !== undefined ? stock_quantity : 0,
          short_description?.trim() || null,
          long_description?.trim() || null,
          specificationsJson,
          warranty_info?.trim() || null,
          seo_title?.trim() || null,
          meta_description?.trim() || null,
          is_active !== undefined ? (is_active ? 1 : 0) : 1,
          section?.trim() || null,
        ]
      );

      const productId = result.insertId;

      // Insert images if provided
      if (images && Array.isArray(images) && images.length > 0) {
        for (const img of images) {
          if (img.image_url) {
            await db.query(
              'INSERT INTO product_images (product_id, image_url, alt_text, display_order) VALUES (?, ?, ?, ?)',
              [
                productId,
                img.image_url.trim(),
                img.alt_text?.trim() || null,
                img.display_order !== undefined ? img.display_order : 0,
              ]
            );
          }
        }
      }

      await db.query('COMMIT');

      // Fetch the created product with images
      const [rows] = await db.query(
        `SELECT 
          id, category_id, name, slug, sku, \`condition\`, price, discount_percentage, stock_quantity,
          short_description, long_description, specifications, average_rating, review_count, 
          warranty_info, seo_title, meta_description, is_active, section
        FROM products WHERE id = ? LIMIT 1`,
        [productId]
      );

      // Fetch images
      const [imageRows] = await db.query(
        `SELECT id, image_url, alt_text, display_order 
         FROM product_images 
         WHERE product_id = ? 
         ORDER BY display_order ASC`,
        [productId]
      );

      // Parse JSON specifications
      const product = rows[0];
      if (product.specifications) {
        try {
          product.specifications = typeof product.specifications === 'string' 
            ? JSON.parse(product.specifications) 
            : product.specifications;
        } catch (err) {
          product.specifications = null;
        }
      }

      // Calculate discounted price
      const originalPrice = parseFloat(product.price) || 0;
      const discountPercentage = parseFloat(product.discount_percentage) || 0;
      const discountedPrice = discountPercentage > 0 
        ? originalPrice * (1 - discountPercentage / 100)
        : originalPrice;

      // Attach images
      product.images = imageRows.map(img => ({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        display_order: img.display_order,
      }));
      product.image_url = imageRows.find(img => img.display_order === 0)?.image_url || null;

      // Add pricing fields
      product.price = originalPrice;
      product.original_price = discountPercentage > 0 ? originalPrice : null;
      product.discounted_price = discountPercentage > 0 ? parseFloat(discountedPrice.toFixed(2)) : originalPrice;
      product.discount_percentage = discountPercentage;

      return res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully',
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Create product error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: err.message.includes('slug') ? 'Slug already exists' : 'SKU already exists',
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
      message: 'Failed to create product',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Update a product
 * Admin only - requires authentication
 * SEO-optimized: Handles slug updates, JSON specifications, all field types properly
 */
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const {
      category_id,
      name,
      slug,
      sku,
      condition,
      price,
      discount_percentage,
      stock_quantity,
      short_description,
      long_description,
      specifications,
      warranty_info,
      seo_title,
      meta_description,
      is_active,
      section,
      images, // Array of { id?, image_url, alt_text, display_order } - id for update, no id for new
    } = req.body;

    const db = getDb();

    // Check if product exists
    const [existingRows] = await db.query(
      'SELECT id, slug, sku FROM products WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Validate enums if provided
    if (condition && !['new', 'used'].includes(condition)) {
      return res.status(400).json({
        success: false,
        message: 'condition must be either "new" or "used"',
      });
    }

    // Validate price if provided
    if (price !== undefined && price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'price must be greater than 0',
      });
    }

    // Validate discount_percentage if provided
    if (discount_percentage !== undefined) {
      if (discount_percentage < 0 || discount_percentage > 100) {
        return res.status(400).json({
          success: false,
          message: 'discount_percentage must be between 0 and 100',
        });
      }
    }

    // Validate stock_quantity if provided
    if (stock_quantity !== undefined && stock_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'stock_quantity cannot be negative',
      });
    }

    // Check SKU uniqueness if SKU is being updated
    if (sku !== undefined && sku.trim() !== existingRows[0].sku) {
      const [skuCheck] = await db.query(
        'SELECT id FROM products WHERE sku = ? AND id != ? LIMIT 1',
        [sku.trim(), id]
      );
      if (skuCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'SKU already exists',
        });
      }
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
      // Generate slug and check uniqueness (excluding current product)
      let finalSlug = slugify(slug);
      const checkSlugExists = async (slugToCheck) => {
        const [existing] = await db.query(
          'SELECT id FROM products WHERE slug = ? AND id != ? LIMIT 1',
          [slugToCheck, id]
        );
        return existing.length > 0;
      };
      finalSlug = await generateUniqueSlug(finalSlug, checkSlugExists);
      updates.push('slug = ?');
      values.push(finalSlug);
    }
    if (sku !== undefined) {
      updates.push('sku = ?');
      values.push(sku.trim());
    }
    if (condition !== undefined) {
      updates.push('\`condition\` = ?');
      values.push(condition);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      values.push(price);
    }
    if (discount_percentage !== undefined) {
      updates.push('discount_percentage = ?');
      values.push(discount_percentage);
    }
    if (stock_quantity !== undefined) {
      updates.push('stock_quantity = ?');
      values.push(stock_quantity);
    }
    // Images are handled separately in product_images table
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

    if (updates.length === 0 && images === undefined) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    // Start transaction for product and images
    await db.query('START TRANSACTION');

    try {
      // Single optimized UPDATE query for product
      if (updates.length > 0) {
        values.push(id);
        await db.query(
          `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
          values
        );
      }

      // Handle images if provided
      if (images !== undefined && Array.isArray(images)) {
        // Get existing images
        const [existingImages] = await db.query(
          'SELECT id FROM product_images WHERE product_id = ?',
          [id]
        );
        const existingImageIds = existingImages.map(img => img.id);

        // Process each image
        for (const img of images) {
          if (img.id) {
            // Update existing image
            if (existingImageIds.includes(img.id)) {
              await db.query(
                'UPDATE product_images SET image_url = ?, alt_text = ?, display_order = ? WHERE id = ? AND product_id = ?',
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
              'INSERT INTO product_images (product_id, image_url, alt_text, display_order) VALUES (?, ?, ?, ?)',
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
            `DELETE FROM product_images WHERE id IN (${placeholders}) AND product_id = ?`,
            [...existingImageIds, id]
          );
        }
      }

      await db.query('COMMIT');

      // Fetch updated product
      const [rows] = await db.query(
        `SELECT 
          id, category_id, name, slug, sku, \`condition\`, price, discount_percentage, stock_quantity,
          short_description, long_description, specifications, average_rating, review_count, 
          warranty_info, seo_title, meta_description, is_active, section
        FROM products WHERE id = ? LIMIT 1`,
        [id]
      );

      // Fetch images
      const [imageRows] = await db.query(
        `SELECT id, image_url, alt_text, display_order 
         FROM product_images 
         WHERE product_id = ? 
         ORDER BY display_order ASC`,
        [id]
      );

      // Parse JSON specifications
      const product = rows[0];
      if (product.specifications) {
        try {
          product.specifications = typeof product.specifications === 'string' 
            ? JSON.parse(product.specifications) 
            : product.specifications;
        } catch (err) {
          product.specifications = null;
        }
      }

      // Calculate discounted price
      const originalPrice = parseFloat(product.price) || 0;
      const discountPercentage = parseFloat(product.discount_percentage) || 0;
      const discountedPrice = discountPercentage > 0 
        ? originalPrice * (1 - discountPercentage / 100)
        : originalPrice;

      // Attach images
      product.images = imageRows.map(img => ({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        display_order: img.display_order,
      }));
      product.image_url = imageRows.find(img => img.display_order === 0)?.image_url || null;

      // Add pricing fields
      product.price = originalPrice;
      product.original_price = discountPercentage > 0 ? originalPrice : null;
      product.discounted_price = discountPercentage > 0 ? parseFloat(discountedPrice.toFixed(2)) : originalPrice;
      product.discount_percentage = discountPercentage;

      return res.status(200).json({
        success: true,
        data: product,
        message: 'Product updated successfully',
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Update product error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: err.message.includes('slug') ? 'Slug already exists' : 'SKU already exists',
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
      message: 'Failed to update product',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Delete a product
 * Admin only - requires authentication
 * SEO-optimized: Fast DELETE query (cascades to product_images)
 */
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Check if product exists
    const [existingRows] = await db.query(
      'SELECT id FROM products WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Single optimized DELETE query (images will be deleted via CASCADE)
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (err) {
    console.error('Delete product error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product',
    });
  }
}

/**
 * Add image to a product
 * Admin only - requires authentication
 * SEO-optimized: Fast INSERT query with alt_text for SEO
 */
export async function addProductImage(req, res) {
  try {
    const { product_id } = req.params;
    const { image_url, alt_text, display_order } = req.body;

    if (!image_url) {
      return res.status(400).json({
        success: false,
        message: 'image_url is required',
      });
    }

    const db = getDb();

    // Check if product exists
    const [productCheck] = await db.query(
      'SELECT id FROM products WHERE id = ? LIMIT 1',
      [product_id]
    );

    if (productCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Single optimized INSERT query
    const [result] = await db.query(
      'INSERT INTO product_images (product_id, image_url, alt_text, display_order) VALUES (?, ?, ?, ?)',
      [
        product_id,
        image_url.trim(),
        alt_text?.trim() || null,
        display_order !== undefined ? display_order : 0,
      ]
    );

    // Fetch the created image
    const [rows] = await db.query(
      'SELECT id, product_id, image_url, alt_text, display_order, created_at FROM product_images WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Product image added successfully',
    });
  } catch (err) {
    console.error('Add product image error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add product image',
    });
  }
}

/**
 * Update a product image
 * Admin only - requires authentication
 * SEO-optimized: Fast UPDATE query
 */
export async function updateProductImage(req, res) {
  try {
    const { product_id, image_id } = req.params;
    const { image_url, alt_text, display_order } = req.body;

    const db = getDb();

    // Check if image exists and belongs to the product
    const [existingRows] = await db.query(
      'SELECT id FROM product_images WHERE id = ? AND product_id = ? LIMIT 1',
      [image_id, product_id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product image not found',
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

    values.push(image_id, product_id);

    // Single optimized UPDATE query
    await db.query(
      `UPDATE product_images SET ${updates.join(', ')} WHERE id = ? AND product_id = ?`,
      values
    );

    // Fetch updated image
    const [rows] = await db.query(
      'SELECT id, product_id, image_url, alt_text, display_order, created_at FROM product_images WHERE id = ? AND product_id = ? LIMIT 1',
      [image_id, product_id]
    );

    return res.status(200).json({
      success: true,
      data: rows[0],
      message: 'Product image updated successfully',
    });
  } catch (err) {
    console.error('Update product image error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update product image',
    });
  }
}

/**
 * Delete a product image
 * Admin only - requires authentication
 * SEO-optimized: Fast DELETE query
 */
export async function deleteProductImage(req, res) {
  try {
    const { product_id, image_id } = req.params;
    const db = getDb();

    // Check if image exists and belongs to the product
    const [existingRows] = await db.query(
      'SELECT id FROM product_images WHERE id = ? AND product_id = ? LIMIT 1',
      [image_id, product_id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product image not found',
      });
    }

    // Single optimized DELETE query
    const [result] = await db.query(
      'DELETE FROM product_images WHERE id = ? AND product_id = ?',
      [image_id, product_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product image not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Product image deleted successfully',
    });
  } catch (err) {
    console.error('Delete product image error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete product image',
    });
  }
}

