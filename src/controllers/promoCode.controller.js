import { getDb } from '../config/db.config.js';

/**
 * Validate a promo code and return discount information
 * Public endpoint - used during checkout/booking
 * SEO-optimized: Single SELECT query with index on code
 */
export async function validatePromoCode(req, res) {
  try {
    const { code, amount } = req.query;
    const db = getDb();

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Promo code is required',
      });
    }

    // Fetch promo code
    const [rows] = await db.query(
      `SELECT 
        id, code, discount_type, discount_value, min_order_amount, 
        usage_limit, used_count, expires_at, is_active
      FROM promo_codes 
      WHERE code = ? AND is_active = 1
      LIMIT 1`,
      [code.toUpperCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or inactive promo code',
      });
    }

    const promoCode = rows[0];

    // Check if expired
    if (promoCode.expires_at) {
      const expiresAt = new Date(promoCode.expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Promo code has expired',
        });
      }
    }

    // Check usage limit
    if (promoCode.usage_limit !== null && promoCode.used_count >= promoCode.usage_limit) {
      return res.status(400).json({
        success: false,
        message: 'Promo code usage limit reached',
      });
    }

    // If amount provided, check minimum order amount
    if (amount !== undefined) {
      const orderAmount = parseFloat(amount);
      if (orderAmount < promoCode.min_order_amount) {
        return res.status(400).json({
          success: false,
          message: `Minimum order amount of ${promoCode.min_order_amount} required`,
          min_order_amount: promoCode.min_order_amount,
        });
      }
    }

    // Calculate discount amount (if amount provided)
    let discountAmount = null;
    if (amount !== undefined) {
      const orderAmount = parseFloat(amount);
      if (promoCode.discount_type === 'percentage') {
        discountAmount = orderAmount * (promoCode.discount_value / 100);
      } else {
        discountAmount = promoCode.discount_value;
      }
      // Ensure discount doesn't exceed order amount
      discountAmount = Math.min(discountAmount, orderAmount);
    }

    return res.status(200).json({
      success: true,
      data: {
        id: promoCode.id,
        code: promoCode.code,
        discount_type: promoCode.discount_type,
        discount_value: promoCode.discount_value,
        min_order_amount: promoCode.min_order_amount,
        discount_amount: discountAmount,
      },
    });
  } catch (err) {
    console.error('Validate promo code error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate promo code',
    });
  }
}

/**
 * Get all promo codes
 * Admin only - requires authentication
 * SEO-optimized: Single SELECT query
 */
export async function getAllPromoCodes(req, res) {
  try {
    const db = getDb();

    const [rows] = await db.query(
      `SELECT 
        id, code, discount_type, discount_value, min_order_amount, 
        usage_limit, used_count, expires_at, is_active, created_at
      FROM promo_codes 
      ORDER BY created_at DESC`
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error('Get promo codes error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch promo codes',
    });
  }
}

/**
 * Create a new promo code
 * Admin only - requires authentication
 * SEO-optimized: Single INSERT query
 */
export async function createPromoCode(req, res) {
  try {
    const {
      code,
      discount_type,
      discount_value,
      min_order_amount,
      usage_limit,
      expires_at,
      is_active,
    } = req.body;

    // Validation
    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({
        success: false,
        message: 'code, discount_type, and discount_value are required',
      });
    }

    if (!['percentage', 'fixed_amount'].includes(discount_type)) {
      return res.status(400).json({
        success: false,
        message: 'discount_type must be either "percentage" or "fixed_amount"',
      });
    }

    if (discount_value <= 0) {
      return res.status(400).json({
        success: false,
        message: 'discount_value must be greater than 0',
      });
    }

    if (discount_type === 'percentage' && discount_value > 100) {
      return res.status(400).json({
        success: false,
        message: 'discount_value cannot exceed 100 for percentage type',
      });
    }

    if (min_order_amount !== undefined && min_order_amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'min_order_amount cannot be negative',
      });
    }

    if (usage_limit !== undefined && usage_limit < 0) {
      return res.status(400).json({
        success: false,
        message: 'usage_limit cannot be negative',
      });
    }

    // Validate expires_at if provided
    if (expires_at) {
      const expiresDate = new Date(expires_at);
      if (isNaN(expiresDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'expires_at must be a valid datetime',
        });
      }
    }

    const db = getDb();

    // Check if code already exists
    const [existingRows] = await db.query(
      'SELECT id FROM promo_codes WHERE code = ? LIMIT 1',
      [code.toUpperCase().trim()]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Promo code already exists',
      });
    }

    // Insert promo code
    const [result] = await db.query(
      `INSERT INTO promo_codes (
        code, discount_type, discount_value, min_order_amount, 
        usage_limit, expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        code.toUpperCase().trim(),
        discount_type,
        discount_value,
        min_order_amount !== undefined ? min_order_amount : 0.00,
        usage_limit !== undefined ? usage_limit : null,
        expires_at ? new Date(expires_at).toISOString().slice(0, 19).replace('T', ' ') : null,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );

    // Fetch created promo code
    const [rows] = await db.query(
      `SELECT 
        id, code, discount_type, discount_value, min_order_amount, 
        usage_limit, used_count, expires_at, is_active, created_at
      FROM promo_codes 
      WHERE id = ? LIMIT 1`,
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Promo code created successfully',
    });
  } catch (err) {
    console.error('Create promo code error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Promo code already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create promo code',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Update a promo code
 * Admin only - requires authentication
 * SEO-optimized: Single UPDATE query
 */
export async function updatePromoCode(req, res) {
  try {
    const { id } = req.params;
    const {
      code,
      discount_type,
      discount_value,
      min_order_amount,
      usage_limit,
      expires_at,
      is_active,
    } = req.body;

    const db = getDb();

    // Check if promo code exists
    const [existingRows] = await db.query(
      'SELECT id, code FROM promo_codes WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found',
      });
    }

    // Validate discount_type if provided
    if (discount_type && !['percentage', 'fixed_amount'].includes(discount_type)) {
      return res.status(400).json({
        success: false,
        message: 'discount_type must be either "percentage" or "fixed_amount"',
      });
    }

    // Validate discount_value if provided
    if (discount_value !== undefined) {
      if (discount_value <= 0) {
        return res.status(400).json({
          success: false,
          message: 'discount_value must be greater than 0',
        });
      }

      const finalDiscountType = discount_type || existingRows[0].discount_type;
      if (finalDiscountType === 'percentage' && discount_value > 100) {
        return res.status(400).json({
          success: false,
          message: 'discount_value cannot exceed 100 for percentage type',
        });
      }
    }

    // Validate min_order_amount if provided
    if (min_order_amount !== undefined && min_order_amount < 0) {
      return res.status(400).json({
        success: false,
        message: 'min_order_amount cannot be negative',
      });
    }

    // Validate usage_limit if provided
    if (usage_limit !== undefined && usage_limit < 0) {
      return res.status(400).json({
        success: false,
        message: 'usage_limit cannot be negative',
      });
    }

    // Validate expires_at if provided
    if (expires_at !== undefined) {
      if (expires_at === null) {
        // Allow null to clear expiration
      } else {
        const expiresDate = new Date(expires_at);
        if (isNaN(expiresDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'expires_at must be a valid datetime',
          });
        }
      }
    }

    // Check code uniqueness if code is being updated
    if (code !== undefined && code.toUpperCase().trim() !== existingRows[0].code) {
      const [codeCheck] = await db.query(
        'SELECT id FROM promo_codes WHERE code = ? AND id != ? LIMIT 1',
        [code.toUpperCase().trim(), id]
      );
      if (codeCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Promo code already exists',
        });
      }
    }

    // Build dynamic UPDATE query
    const updates = [];
    const values = [];

    if (code !== undefined) {
      updates.push('code = ?');
      values.push(code.toUpperCase().trim());
    }
    if (discount_type !== undefined) {
      updates.push('discount_type = ?');
      values.push(discount_type);
    }
    if (discount_value !== undefined) {
      updates.push('discount_value = ?');
      values.push(discount_value);
    }
    if (min_order_amount !== undefined) {
      updates.push('min_order_amount = ?');
      values.push(min_order_amount);
    }
    if (usage_limit !== undefined) {
      updates.push('usage_limit = ?');
      values.push(usage_limit === null ? null : usage_limit);
    }
    if (expires_at !== undefined) {
      updates.push('expires_at = ?');
      values.push(expires_at === null ? null : new Date(expires_at).toISOString().slice(0, 19).replace('T', ' '));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    // Update promo code
    values.push(id);
    await db.query(
      `UPDATE promo_codes SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated promo code
    const [rows] = await db.query(
      `SELECT 
        id, code, discount_type, discount_value, min_order_amount, 
        usage_limit, used_count, expires_at, is_active, created_at
      FROM promo_codes 
      WHERE id = ? LIMIT 1`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: rows[0],
      message: 'Promo code updated successfully',
    });
  } catch (err) {
    console.error('Update promo code error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Promo code already exists',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to update promo code',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Delete a promo code
 * Admin only - requires authentication
 * SEO-optimized: Single DELETE query
 */
export async function deletePromoCode(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Check if promo code exists
    const [existingRows] = await db.query(
      'SELECT id FROM promo_codes WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Promo code not found',
      });
    }

    // Delete promo code
    await db.query('DELETE FROM promo_codes WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Promo code deleted successfully',
    });
  } catch (err) {
    console.error('Delete promo code error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete promo code',
    });
  }
}

