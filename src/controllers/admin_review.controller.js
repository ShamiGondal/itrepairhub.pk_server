import { getDb } from '../config/db.config.js';

/**
 * Helper function to handle database errors consistently
 */
function handleDbError(err, defaultMessage) {
  console.error(`${defaultMessage} error:`, err);
  
  // Connection-related errors
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return {
      status: 503,
      response: {
        success: false,
        message: 'Database connection failed. Please check your network connection and database configuration.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
    };
  }
  
  // SQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    return {
      status: 409,
      response: {
        success: false,
        message: 'Duplicate entry. This record already exists.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      },
    };
  }
  
  // Generic database error
  return {
    status: 500,
    response: {
      success: false,
      message: defaultMessage,
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
  };
}

/**
 * Get all reviews with filtering, pagination, and search
 * Admin only - requires authentication
 * Supports filtering by product_id, service_id, is_approved, rating, user type, etc.
 */
export async function getAllReviews(req, res) {
  try {
    const db = getDb();
    const {
      product_id,
      service_id,
      is_approved,
      rating,
      is_verified_purchase,
      user_type, // 'registered' or 'guest'
      user_email,
      user_name,
      search,
      page = 1,
      limit = 50,
      sort = 'created_at',
      order = 'DESC',
    } = req.query;

    // Build WHERE clause
    const whereConditions = [];
    const queryParams = [];

    if (product_id) {
      whereConditions.push('r.product_id = ?');
      queryParams.push(product_id);
    }

    if (service_id) {
      whereConditions.push('r.service_id = ?');
      queryParams.push(service_id);
    }

    // Filter by review type (product or service)
    if (product_id && service_id) {
      // Both provided - invalid
      return res.status(400).json({
        success: false,
        message: 'Cannot filter by both product_id and service_id',
      });
    }

    if (is_approved !== undefined) {
      whereConditions.push('r.is_approved = ?');
      queryParams.push(is_approved === 'true' || is_approved === '1' ? 1 : 0);
    }

    if (rating) {
      whereConditions.push('r.rating = ?');
      queryParams.push(parseInt(rating));
    }

    if (is_verified_purchase !== undefined) {
      whereConditions.push('r.is_verified_purchase = ?');
      queryParams.push(is_verified_purchase === 'true' || is_verified_purchase === '1' ? 1 : 0);
    }

    if (user_type === 'registered') {
      whereConditions.push('r.user_id IS NOT NULL');
    } else if (user_type === 'guest') {
      whereConditions.push('r.user_id IS NULL');
    }

    if (user_email) {
      whereConditions.push('(u.email LIKE ? OR r.guest_email LIKE ?)');
      const emailPattern = `%${user_email}%`;
      queryParams.push(emailPattern, emailPattern);
    }

    if (user_name) {
      whereConditions.push('(u.full_name LIKE ? OR r.guest_name LIKE ?)');
      const namePattern = `%${user_name}%`;
      queryParams.push(namePattern, namePattern);
    }

    if (search) {
      whereConditions.push('(r.title LIKE ? OR r.comment LIKE ? OR p.name LIKE ? OR s.name LIKE ? OR u.full_name LIKE ? OR r.guest_name LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort and order
    const allowedSortFields = ['created_at', 'rating', 'is_approved', 'id'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get reviews with product/service and user info
    const [reviewRows] = await db.query(
      `SELECT 
        r.id,
        r.user_id,
        r.guest_email,
        r.guest_name,
        r.product_id,
        r.service_id,
        r.rating,
        r.title,
        r.comment,
        r.is_verified_purchase,
        r.is_approved,
        r.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone,
        p.name as product_name,
        p.slug as product_slug,
        p.sku as product_sku,
        s.name as service_name,
        s.slug as service_slug
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN services s ON r.service_id = s.id
      ${whereClause}
      ORDER BY r.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN services s ON r.service_id = s.id
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Format reviews
    const reviews = reviewRows.map(review => ({
      id: review.id,
      customer: {
        type: review.user_id ? 'registered' : 'guest',
        user_id: review.user_id,
        name: review.user_name || review.guest_name || 'Anonymous',
        email: review.user_email || review.guest_email || null,
        phone: review.user_phone || null,
      },
      product: review.product_id ? {
        id: review.product_id,
        name: review.product_name,
        slug: review.product_slug,
        sku: review.product_sku,
      } : null,
      service: review.service_id ? {
        id: review.service_id,
        name: review.service_name,
        slug: review.service_slug,
      } : null,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      is_verified_purchase: Boolean(review.is_verified_purchase),
      is_approved: Boolean(review.is_approved),
      created_at: review.created_at,
    }));

    return res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch reviews');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get review by ID with full details
 * Admin only - includes all review info, product/service, customer
 */
export async function getReviewById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    // Get review basic info with product/service and user
    const [reviewRows] = await db.query(
      `SELECT 
        r.id,
        r.user_id,
        r.guest_email,
        r.guest_name,
        r.product_id,
        r.service_id,
        r.rating,
        r.title,
        r.comment,
        r.is_verified_purchase,
        r.is_approved,
        r.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone,
        u.role as user_role,
        p.name as product_name,
        p.slug as product_slug,
        p.sku as product_sku,
        p.price as product_price,
        s.name as service_name,
        s.slug as service_slug,
        s.price as service_price
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN services s ON r.service_id = s.id
      WHERE r.id = ?`,
      [id]
    );

    if (reviewRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const review = reviewRows[0];

    return res.status(200).json({
      success: true,
      data: {
        id: review.id,
        customer: {
          type: review.user_id ? 'registered' : 'guest',
          user_id: review.user_id,
          name: review.user_name || review.guest_name || 'Anonymous',
          email: review.user_email || review.guest_email || null,
          phone: review.user_phone || null,
          role: review.user_role || null,
        },
        product: review.product_id ? {
          id: review.product_id,
          name: review.product_name,
          slug: review.product_slug,
          sku: review.product_sku,
          price: review.product_price ? parseFloat(review.product_price) : null,
        } : null,
        service: review.service_id ? {
          id: review.service_id,
          name: review.service_name,
          slug: review.service_slug,
          price: review.service_price ? parseFloat(review.service_price) : null,
        } : null,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        is_verified_purchase: Boolean(review.is_verified_purchase),
        is_approved: Boolean(review.is_approved),
        created_at: review.created_at,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch review');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Approve review
 * Admin only - sets is_approved to true and updates product/service rating
 */
export async function approveReview(req, res) {
  const db = getDb();
  
  // Start transaction for data integrity
  await db.query('START TRANSACTION');

  try {
    const { id } = req.params;

    // Check if review exists
    const [reviewRows] = await db.query(
      'SELECT id, product_id, service_id, is_approved FROM reviews WHERE id = ?',
      [id]
    );

    if (reviewRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const review = reviewRows[0];

    // Update review approval status
    await db.query(
      'UPDATE reviews SET is_approved = 1 WHERE id = ?',
      [id]
    );

    // Update product/service rating aggregation if not already approved
    if (!review.is_approved) {
      if (review.product_id) {
        // Update product rating
        const [ratingStats] = await db.query(
          `SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as review_count
          FROM reviews 
          WHERE product_id = ? AND is_approved = 1`,
          [review.product_id]
        );

        const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
        const reviewCount = parseInt(ratingStats[0].review_count || 0);

        await db.query(
          'UPDATE products SET average_rating = ?, review_count = ? WHERE id = ?',
          [averageRating, reviewCount, review.product_id]
        );
      } else if (review.service_id) {
        // Update service rating
        const [ratingStats] = await db.query(
          `SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as review_count
          FROM reviews 
          WHERE service_id = ? AND is_approved = 1`,
          [review.service_id]
        );

        const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
        const reviewCount = parseInt(ratingStats[0].review_count || 0);

        await db.query(
          'UPDATE services SET average_rating = ?, review_count = ? WHERE id = ?',
          [averageRating, reviewCount, review.service_id]
        );
      }
    }

    await db.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Review approved successfully',
    });
  } catch (err) {
    await db.query('ROLLBACK');
    const errorResponse = handleDbError(err, 'Failed to approve review');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Reject review
 * Admin only - sets is_approved to false and updates product/service rating
 */
export async function rejectReview(req, res) {
  const db = getDb();
  
  // Start transaction for data integrity
  await db.query('START TRANSACTION');

  try {
    const { id } = req.params;

    // Check if review exists
    const [reviewRows] = await db.query(
      'SELECT id, product_id, service_id, is_approved FROM reviews WHERE id = ?',
      [id]
    );

    if (reviewRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const review = reviewRows[0];

    // Update review approval status
    await db.query(
      'UPDATE reviews SET is_approved = 0 WHERE id = ?',
      [id]
    );

    // Update product/service rating aggregation if was previously approved
    if (review.is_approved) {
      if (review.product_id) {
        // Update product rating
        const [ratingStats] = await db.query(
          `SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as review_count
          FROM reviews 
          WHERE product_id = ? AND is_approved = 1`,
          [review.product_id]
        );

        const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
        const reviewCount = parseInt(ratingStats[0].review_count || 0);

        await db.query(
          'UPDATE products SET average_rating = ?, review_count = ? WHERE id = ?',
          [averageRating, reviewCount, review.product_id]
        );
      } else if (review.service_id) {
        // Update service rating
        const [ratingStats] = await db.query(
          `SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as review_count
          FROM reviews 
          WHERE service_id = ? AND is_approved = 1`,
          [review.service_id]
        );

        const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
        const reviewCount = parseInt(ratingStats[0].review_count || 0);

        await db.query(
          'UPDATE services SET average_rating = ?, review_count = ? WHERE id = ?',
          [averageRating, reviewCount, review.service_id]
        );
      }
    }

    await db.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Review rejected successfully',
    });
  } catch (err) {
    await db.query('ROLLBACK');
    const errorResponse = handleDbError(err, 'Failed to reject review');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Delete review
 * Admin only - permanently deletes review and updates product/service rating
 */
export async function deleteReview(req, res) {
  const db = getDb();
  
  // Start transaction for data integrity
  await db.query('START TRANSACTION');

  try {
    const { id } = req.params;

    // Check if review exists and get product/service info
    const [reviewRows] = await db.query(
      'SELECT id, product_id, service_id, is_approved FROM reviews WHERE id = ?',
      [id]
    );

    if (reviewRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const review = reviewRows[0];

    // Delete review
    await db.query('DELETE FROM reviews WHERE id = ?', [id]);

    // Update product/service rating aggregation if review was approved
    if (review.is_approved) {
      if (review.product_id) {
        // Update product rating
        const [ratingStats] = await db.query(
          `SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as review_count
          FROM reviews 
          WHERE product_id = ? AND is_approved = 1`,
          [review.product_id]
        );

        const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
        const reviewCount = parseInt(ratingStats[0].review_count || 0);

        await db.query(
          'UPDATE products SET average_rating = ?, review_count = ? WHERE id = ?',
          [averageRating, reviewCount, review.product_id]
        );
      } else if (review.service_id) {
        // Update service rating
        const [ratingStats] = await db.query(
          `SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as review_count
          FROM reviews 
          WHERE service_id = ? AND is_approved = 1`,
          [review.service_id]
        );

        const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
        const reviewCount = parseInt(ratingStats[0].review_count || 0);

        await db.query(
          'UPDATE services SET average_rating = ?, review_count = ? WHERE id = ?',
          [averageRating, reviewCount, review.service_id]
        );
      }
    }

    await db.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (err) {
    await db.query('ROLLBACK');
    const errorResponse = handleDbError(err, 'Failed to delete review');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update review rating
 * Admin only - allows correcting rating and updates product/service rating
 */
export async function updateReviewRating(req, res) {
  const db = getDb();
  
  // Start transaction for data integrity
  await db.query('START TRANSACTION');

  try {
    const { id } = req.params;
    const { rating } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Check if review exists
    const [reviewRows] = await db.query(
      'SELECT id, product_id, service_id, is_approved FROM reviews WHERE id = ?',
      [id]
    );

    if (reviewRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    const review = reviewRows[0];

    // Update rating
    await db.query(
      'UPDATE reviews SET rating = ? WHERE id = ?',
      [parseInt(rating), id]
    );

    // Update product/service rating aggregation if review is approved
    if (review.is_approved) {
      if (review.product_id) {
        // Update product rating
        const [ratingStats] = await db.query(
          `SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as review_count
          FROM reviews 
          WHERE product_id = ? AND is_approved = 1`,
          [review.product_id]
        );

        const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
        const reviewCount = parseInt(ratingStats[0].review_count || 0);

        await db.query(
          'UPDATE products SET average_rating = ?, review_count = ? WHERE id = ?',
          [averageRating, reviewCount, review.product_id]
        );
      } else if (review.service_id) {
        // Update service rating
        const [ratingStats] = await db.query(
          `SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as review_count
          FROM reviews 
          WHERE service_id = ? AND is_approved = 1`,
          [review.service_id]
        );

        const averageRating = parseFloat(ratingStats[0].average_rating || 0).toFixed(2);
        const reviewCount = parseInt(ratingStats[0].review_count || 0);

        await db.query(
          'UPDATE services SET average_rating = ?, review_count = ? WHERE id = ?',
          [averageRating, reviewCount, review.service_id]
        );
      }
    }

    await db.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Review rating updated successfully',
    });
  } catch (err) {
    await db.query('ROLLBACK');
    const errorResponse = handleDbError(err, 'Failed to update review rating');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

