import { getDb } from '../config/db.config.js';

/**
 * Get all used laptops/PCs with optional filtering
 * Public endpoint - SEO-critical for marketplace listings
 * Filters: condition='used' AND section='used_laptop_pcs_market'
 * SEO-optimized: Single SELECT query with indexes, supports filtering
 */
export async function getAllUsedLaptops(req, res) {
  try {
    const { category_id, is_active, search, min_price, max_price, in_stock, sort } = req.query;
    const db = getDb();

    // Build dynamic WHERE clause - ALWAYS filter for used laptops market
    const conditions = [
      "p.`condition` = 'used'",
      "p.section = 'used_laptop_pcs_market'"
    ];
    const values = [];

    // Debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Used Laptops Query - Filters:', {
        condition: 'used',
        section: 'used_laptop_pcs_market',
        category_id,
        is_active,
        search,
        min_price,
        max_price,
        in_stock,
        sort
      });
    }

    if (category_id) {
      conditions.push('p.category_id = ?');
      values.push(category_id);
    }
    if (is_active !== undefined) {
      conditions.push('p.is_active = ?');
      values.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    } else {
      // Default to active only
      conditions.push('p.is_active = 1');
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

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Determine sort order
    let orderBy = 'p.created_at DESC'; // Default: newest first
    if (sort === 'price_asc') {
      orderBy = 'p.price ASC';
    } else if (sort === 'price_desc') {
      orderBy = 'p.price DESC';
    } else if (sort === 'name_asc') {
      orderBy = 'p.name ASC';
    } else if (sort === 'name_desc') {
      orderBy = 'p.name DESC';
    }

    // SEO-optimized: Single query with JOIN for category name
    // Note: products table doesn't have created_at, using id for sorting as fallback
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
        p.created_at,
        pc.name as category_name,
        pc.slug as category_slug
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      ${whereClause}
      ORDER BY ${orderBy}`,
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
    console.error('Get used laptops error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch used laptops',
    });
  }
}

/**
 * Get a single used laptop by slug
 * Public endpoint - SEO-critical for detail pages
 * Filters: condition='used' AND section='used_laptop_pcs_market'
 * SEO-optimized: Single SELECT query with slug index, includes all SEO fields
 */
export async function getUsedLaptopBySlug(req, res) {
  try {
    const { slug } = req.params;
    const db = getDb();

    // SEO-optimized: Single query with JOIN for complete data
    // ALWAYS filter for used laptops market
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
        p.created_at,
        pc.name as category_name,
        pc.slug as category_slug
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.slug = ? 
        AND p.is_active = 1 
        AND p.\`condition\` = 'used' 
        AND p.section = 'used_laptop_pcs_market'
      LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Used laptop not found',
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
    console.error('Get used laptop error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch used laptop',
    });
  }
}

/**
 * Create sell request or price estimation
 * Protected endpoint - requires authentication
 * SEO-optimized: Fast response, proper error handling
 */
export async function createSellRequest(req, res) {
  try {
    // User is set by isAuth middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const {
      request_type,
      device_type,
      brand,
      model,
      specifications,
      condition_notes,
      user_requested_price,
      images,
    } = req.body;

    // Validation
    if (!request_type || !['check_price', 'sell_item'].includes(request_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request_type. Must be "check_price" or "sell_item"',
      });
    }

    if (!device_type) {
      return res.status(400).json({
        success: false,
        message: 'device_type is required',
      });
    }

    if (!specifications || typeof specifications !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'specifications must be a valid JSON object',
      });
    }

    // Validate images (max 4)
    if (images && Array.isArray(images) && images.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 images allowed',
      });
    }

    const db = getDb();

    // Insert sell request
    const [result] = await db.query(
      `INSERT INTO sell_requests (
        user_id,
        request_type,
        device_type,
        brand,
        model,
        specifications,
        condition_notes,
        user_requested_price,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted')`,
      [
        userId,
        request_type,
        device_type,
        brand || null,
        model || null,
        JSON.stringify(specifications),
        condition_notes ? JSON.stringify(condition_notes) : null,
        user_requested_price || null,
      ]
    );

    const sellRequestId = result.insertId;

    // Insert images if provided
    if (images && Array.isArray(images) && images.length > 0) {
      const imageValues = images.map((img, index) => [
        sellRequestId,
        img.url || img.image_url,
        img.alt_text || `${device_type} ${brand || ''} ${model || ''} - Image ${index + 1}`.trim(),
        index,
      ]);

      await db.query(
        `INSERT INTO sell_request_images (sell_request_id, image_url, alt_text, display_order)
         VALUES ?`,
        [imageValues]
      );
    }

    // Fetch complete sell request with images
    const [sellRequests] = await db.query(
      `SELECT 
        sr.*
      FROM sell_requests sr
      WHERE sr.id = ?`,
      [sellRequestId]
    );

    const sellRequest = sellRequests[0];
    if (sellRequest) {
      // Parse JSON fields - handle both string and object types
      if (typeof sellRequest.specifications === 'string') {
        try {
          sellRequest.specifications = JSON.parse(sellRequest.specifications);
        } catch (e) {
          sellRequest.specifications = {};
        }
      } else if (!sellRequest.specifications) {
        sellRequest.specifications = {};
      }
      // If it's already an object, keep it as is

      if (sellRequest.condition_notes) {
        if (typeof sellRequest.condition_notes === 'string') {
          try {
            sellRequest.condition_notes = JSON.parse(sellRequest.condition_notes);
          } catch (e) {
            sellRequest.condition_notes = null;
          }
        }
        // If it's already an object, keep it as is
      } else {
        sellRequest.condition_notes = null;
      }

      // Fetch images separately
      const [imageRows] = await db.query(
        `SELECT id, image_url, alt_text, display_order
         FROM sell_request_images
         WHERE sell_request_id = ?
         ORDER BY display_order ASC`,
        [sellRequestId]
      );

      sellRequest.images = imageRows.map(img => ({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        display_order: img.display_order,
      }));
    }

    return res.status(201).json({
      success: true,
      message: request_type === 'check_price' 
        ? 'Price estimation request submitted successfully'
        : 'Sell request submitted successfully',
      data: sellRequest,
    });
  } catch (err) {
    console.error('Create sell request error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create sell request',
    });
  }
}

