import { getDb } from '../config/db.config.js';

/**
 * Get all reviews for a service
 * Public endpoint - SEO-critical for service review listings
 * SEO-optimized: Single SELECT query with JOIN for user info
 */
export async function getServiceReviews(req, res) {
  try {
    const { service_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const db = getDb();

    // Validate service_id
    if (!service_id) {
      return res.status(400).json({
        success: false,
        message: 'service_id is required',
      });
    }

    // Check if service exists
    const [serviceCheck] = await db.query(
      'SELECT id, name FROM services WHERE id = ? AND is_active = 1 LIMIT 1',
      [service_id]
    );

    if (serviceCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // SEO-optimized: Single query with LEFT JOIN for user/guest info, only approved reviews
    const [reviews] = await db.query(
      `SELECT 
        r.id,
        r.rating,
        r.title,
        r.comment,
        r.is_verified_purchase,
        r.created_at,
        COALESCE(u.full_name, r.guest_name) as full_name,
        u.id as user_id,
        r.guest_email
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.service_id = ? AND r.is_approved = 1
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [service_id, parseInt(limit), parseInt(offset)]
    );

    // Get total count for pagination
    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM reviews WHERE service_id = ? AND is_approved = 1',
      [service_id]
    );

    const total = countResult[0].total;

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (err) {
    console.error('Get service reviews error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch service reviews',
    });
  }
}

/**
 * Get all reviews for a product
 * Public endpoint - SEO-critical for product review listings
 * SEO-optimized: Single SELECT query with JOIN for user info
 */
export async function getProductReviews(req, res) {
  try {
    const { product_id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const db = getDb();

    // Validate product_id
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id is required',
      });
    }

    // Check if product exists
    const [productCheck] = await db.query(
      'SELECT id, name FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
      [product_id]
    );

    if (productCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // SEO-optimized: Single query with LEFT JOIN for user/guest info, only approved reviews
    const [reviews] = await db.query(
      `SELECT 
        r.id,
        r.rating,
        r.title,
        r.comment,
        r.is_verified_purchase,
        r.created_at,
        COALESCE(u.full_name, r.guest_name) as full_name,
        u.id as user_id,
        r.guest_email
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? AND r.is_approved = 1
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?`,
      [product_id, parseInt(limit), parseInt(offset)]
    );

    // Get total count for pagination
    const [countResult] = await db.query(
      'SELECT COUNT(*) as total FROM reviews WHERE product_id = ? AND is_approved = 1',
      [product_id]
    );

    const total = countResult[0].total;

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (err) {
    console.error('Get product reviews error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch product reviews',
    });
  }
}

/**
 * Create a review for a service
 * Supports both authenticated users and guests (via email)
 * SEO-optimized: Transaction-based, updates rating aggregation
 */
export async function createServiceReview(req, res) {
  const db = getDb();
  
  // Start transaction for data integrity
  await db.query('START TRANSACTION');

  try {
    const { service_id } = req.params;
    const { rating, title, comment, guest_email, guest_name } = req.body;
    const userId = req.user?.id;
    const isGuest = !userId;

    // For guests, email and name are required
    if (isGuest) {
      if (!guest_email || !guest_name) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'guest_email and guest_name are required for guest reviews',
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guest_email.trim())) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }
    }

    // Validate required fields
    if (!rating || !service_id) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'service_id and rating are required',
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'rating must be between 1 and 5',
      });
    }

    // Check if service exists
    const [serviceCheck] = await db.query(
      'SELECT id, name FROM services WHERE id = ? AND is_active = 1 LIMIT 1',
      [service_id]
    );

    if (serviceCheck.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    // Verify purchase: Check if user/guest has a completed booking for this service
    let hasPurchase = false;
    let emailToCheck = null;

    if (isGuest) {
      // Guest: Check by email directly
      emailToCheck = guest_email.trim().toLowerCase();
      const [guestBookingCheck] = await db.query(
        `SELECT b.id FROM bookings b
         INNER JOIN guest_details gd ON b.guest_id = gd.id
         WHERE b.service_id = ?
         AND LOWER(gd.email) = ?
         AND b.status = 'completed'
         LIMIT 1`,
        [service_id, emailToCheck]
      );

      hasPurchase = guestBookingCheck.length > 0;
    } else {
      // Logged-in user: Check direct user_id match
      const [bookingCheck] = await db.query(
        `SELECT id FROM bookings 
         WHERE service_id = ? 
         AND user_id = ?
         AND status = 'completed'
         LIMIT 1`,
        [service_id, userId]
      );

      hasPurchase = bookingCheck.length > 0;

      // Also check for guest bookings via email match (user may have booked as guest before registering)
      if (!hasPurchase) {
        const [userEmail] = await db.query(
          'SELECT email FROM users WHERE id = ? LIMIT 1',
          [userId]
        );

        if (userEmail.length > 0) {
          emailToCheck = userEmail[0].email.trim().toLowerCase();
          const [guestBookingCheck] = await db.query(
            `SELECT b.id FROM bookings b
             INNER JOIN guest_details gd ON b.guest_id = gd.id
             WHERE b.service_id = ?
             AND LOWER(gd.email) = ?
             AND b.status = 'completed'
             LIMIT 1`,
            [service_id, emailToCheck]
          );

          hasPurchase = guestBookingCheck.length > 0;
        }
      }
    }

    if (!hasPurchase) {
      await db.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You must have purchased this service to post a review',
      });
    }

    // Check if user/guest already reviewed this service
    let existingReview = [];
    if (isGuest) {
      [existingReview] = await db.query(
        'SELECT id FROM reviews WHERE service_id = ? AND LOWER(guest_email) = ? LIMIT 1',
        [service_id, emailToCheck]
      );
    } else {
      [existingReview] = await db.query(
        'SELECT id FROM reviews WHERE service_id = ? AND user_id = ? LIMIT 1',
        [service_id, userId]
      );
    }

    if (existingReview.length > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this service',
      });
    }

    // Create review (auto-approve for verified purchases)
    const [reviewResult] = await db.query(
      `INSERT INTO reviews (
        user_id, guest_email, guest_name, service_id, rating, title, comment, is_verified_purchase, is_approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        isGuest ? null : userId,
        isGuest ? emailToCheck : null,
        isGuest ? guest_name.trim() : null,
        service_id,
        rating,
        title?.trim() || null,
        comment?.trim() || null,
        hasPurchase ? 1 : 0,
        hasPurchase ? 1 : 0, // Auto-approve verified purchases
      ]
    );

    const reviewId = reviewResult.insertId;

    // Update service rating aggregation
    const [ratingStats] = await db.query(
      `SELECT 
        AVG(rating) as average_rating,
        COUNT(*) as review_count
      FROM reviews 
      WHERE service_id = ? AND is_approved = 1`,
      [service_id]
    );

    const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
    const reviewCount = parseInt(ratingStats[0].review_count || 0);

    // Update service with new rating stats
    await db.query(
      'UPDATE services SET average_rating = ?, review_count = ? WHERE id = ?',
      [averageRating, reviewCount, service_id]
    );

    await db.query('COMMIT');

    // Fetch the created review with user/guest info
    let newReview;
    if (isGuest) {
      [newReview] = await db.query(
        `SELECT 
          r.id,
          r.rating,
          r.title,
          r.comment,
          r.is_verified_purchase,
          r.created_at,
          r.guest_name as full_name,
          r.guest_email,
          NULL as user_id
        FROM reviews r
        WHERE r.id = ?`,
        [reviewId]
      );
    } else {
      [newReview] = await db.query(
        `SELECT 
          r.id,
          r.rating,
          r.title,
          r.comment,
          r.is_verified_purchase,
          r.created_at,
          u.full_name,
          u.id as user_id,
          NULL as guest_email
        FROM reviews r
        INNER JOIN users u ON r.user_id = u.id
        WHERE r.id = ?`,
        [reviewId]
      );
    }

    return res.status(201).json({
      success: true,
      data: {
        review: newReview[0],
        service: {
          average_rating: parseFloat(averageRating),
          review_count: reviewCount,
        },
      },
      message: 'Review posted successfully',
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Create service review error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create review',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Create a review for a product
 * Supports both authenticated users and guests (via email)
 * SEO-optimized: Transaction-based, updates rating aggregation
 */
export async function createProductReview(req, res) {
  const db = getDb();
  
  // Start transaction for data integrity
  await db.query('START TRANSACTION');

  try {
    const { product_id } = req.params;
    const { rating, title, comment, guest_email, guest_name } = req.body;
    const userId = req.user?.id;
    const isGuest = !userId;

    // For guests, email and name are required
    if (isGuest) {
      if (!guest_email || !guest_name) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'guest_email and guest_name are required for guest reviews',
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guest_email.trim())) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
      }
    }

    // Validate required fields
    if (!rating || !product_id) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'product_id and rating are required',
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'rating must be between 1 and 5',
      });
    }

    // Check if product exists
    const [productCheck] = await db.query(
      'SELECT id, name FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
      [product_id]
    );

    if (productCheck.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Verify purchase: Check if user/guest has a delivered order with this product
    let hasPurchase = false;
    let emailToCheck = null;

    if (isGuest) {
      // Guest: Check by email directly
      emailToCheck = guest_email.trim().toLowerCase();
      const [guestOrderCheck] = await db.query(
        `SELECT oi.id 
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         INNER JOIN guest_details gd ON o.guest_id = gd.id
         WHERE oi.product_id = ?
         AND LOWER(gd.email) = ?
         AND o.order_status = 'delivered'
         LIMIT 1`,
        [product_id, emailToCheck]
      );

      hasPurchase = guestOrderCheck.length > 0;
    } else {
      // Logged-in user: Check direct user_id match
      const [orderCheck] = await db.query(
        `SELECT oi.id 
         FROM order_items oi
         INNER JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_id = ?
         AND o.user_id = ?
         AND o.order_status = 'delivered'
         LIMIT 1`,
        [product_id, userId]
      );

      hasPurchase = orderCheck.length > 0;

      // Also check for guest orders via email match (user may have ordered as guest before registering)
      if (!hasPurchase) {
        const [userEmail] = await db.query(
          'SELECT email FROM users WHERE id = ? LIMIT 1',
          [userId]
        );

        if (userEmail.length > 0) {
          emailToCheck = userEmail[0].email.trim().toLowerCase();
          const [guestOrderCheck] = await db.query(
            `SELECT oi.id 
             FROM order_items oi
             INNER JOIN orders o ON oi.order_id = o.id
             INNER JOIN guest_details gd ON o.guest_id = gd.id
             WHERE oi.product_id = ?
             AND LOWER(gd.email) = ?
             AND o.order_status = 'delivered'
             LIMIT 1`,
            [product_id, emailToCheck]
          );

          hasPurchase = guestOrderCheck.length > 0;
        }
      }
    }

    if (!hasPurchase) {
      await db.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'You must have purchased this product to post a review',
      });
    }

    // Check if user/guest already reviewed this product
    let existingReview = [];
    if (isGuest) {
      [existingReview] = await db.query(
        'SELECT id FROM reviews WHERE product_id = ? AND LOWER(guest_email) = ? LIMIT 1',
        [product_id, emailToCheck]
      );
    } else {
      [existingReview] = await db.query(
        'SELECT id FROM reviews WHERE product_id = ? AND user_id = ? LIMIT 1',
        [product_id, userId]
      );
    }

    if (existingReview.length > 0) {
      await db.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }

    // Create review (auto-approve for verified purchases)
    const [reviewResult] = await db.query(
      `INSERT INTO reviews (
        user_id, guest_email, guest_name, product_id, rating, title, comment, is_verified_purchase, is_approved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        isGuest ? null : userId,
        isGuest ? emailToCheck : null,
        isGuest ? guest_name.trim() : null,
        product_id,
        rating,
        title?.trim() || null,
        comment?.trim() || null,
        hasPurchase ? 1 : 0,
        hasPurchase ? 1 : 0, // Auto-approve verified purchases
      ]
    );

    const reviewId = reviewResult.insertId;

    // Update product rating aggregation
    const [ratingStats] = await db.query(
      `SELECT 
        AVG(rating) as average_rating,
        COUNT(*) as review_count
      FROM reviews 
      WHERE product_id = ? AND is_approved = 1`,
      [product_id]
    );

    const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
    const reviewCount = parseInt(ratingStats[0].review_count || 0);

    // Update product with new rating stats
    await db.query(
      'UPDATE products SET average_rating = ?, review_count = ? WHERE id = ?',
      [averageRating, reviewCount, product_id]
    );

    await db.query('COMMIT');

    // Fetch the created review with user/guest info
    let newReview;
    if (isGuest) {
      [newReview] = await db.query(
        `SELECT 
          r.id,
          r.rating,
          r.title,
          r.comment,
          r.is_verified_purchase,
          r.created_at,
          r.guest_name as full_name,
          r.guest_email,
          NULL as user_id
        FROM reviews r
        WHERE r.id = ?`,
        [reviewId]
      );
    } else {
      [newReview] = await db.query(
        `SELECT 
          r.id,
          r.rating,
          r.title,
          r.comment,
          r.is_verified_purchase,
          r.created_at,
          u.full_name,
          u.id as user_id,
          NULL as guest_email
        FROM reviews r
        INNER JOIN users u ON r.user_id = u.id
        WHERE r.id = ?`,
        [reviewId]
      );
    }

    return res.status(201).json({
      success: true,
      data: {
        review: newReview[0],
        product: {
          average_rating: parseFloat(averageRating),
          review_count: reviewCount,
        },
      },
      message: 'Review posted successfully',
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Create product review error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to create review',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

