import { getDb } from '../config/db.config.js';

/**
 * Create a new online query/complaint
 * Public endpoint – works for guests and logged-in users
 * SEO-optimized: single INSERT + single SELECT
 */
export async function createOnlineQuery(req, res) {
  try {
    const {
      email,
      phone,
      full_name,
      type = 'query',
      related_to = 'other',
      product_id,
      service_id,
      subject,
      message,
    } = req.body;

    // Basic required fields
    if (!email || !message) {
      return res.status(400).json({
        success: false,
        message: 'email and message are required',
      });
    }

    // Validate enums
    const allowedTypes = ['query', 'complaint'];
    const allowedRelatedTo = ['product', 'service', 'other'];

    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be either "query" or "complaint"',
      });
    }

    if (!allowedRelatedTo.includes(related_to)) {
      return res.status(400).json({
        success: false,
        message: 'related_to must be one of: "product", "service", "other"',
      });
    }

    // Validate relationship
    if (related_to === 'product' && !product_id) {
      return res.status(400).json({
        success: false,
        message: 'product_id is required when related_to is "product"',
      });
    }

    if (related_to === 'service' && !service_id) {
      return res.status(400).json({
        success: false,
        message: 'service_id is required when related_to is "service"',
      });
    }

    const db = getDb();

    // Optional logged-in user ID (if request is authenticated)
    const userId = req.user?.id || null;

    const [result] = await db.query(
      `INSERT INTO online_queries
        (user_id, email, phone, full_name, type, related_to, product_id, service_id, subject, message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        email.trim(),
        phone?.trim() || null,
        full_name?.trim() || null,
        type,
        related_to,
        related_to === 'product' ? product_id || null : null,
        related_to === 'service' ? service_id || null : null,
        subject?.trim() || null,
        message.trim(),
        'new',
      ],
    );

    const [rows] = await db.query(
      `SELECT id, user_id, email, phone, full_name, type, related_to,
              product_id, service_id, subject, message, status, created_at
       FROM online_queries
       WHERE id = ?
       LIMIT 1`,
      [result.insertId],
    );

    return res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Your request has been submitted successfully',
    });
  } catch (err) {
    console.error('Online query creation error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit your request',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}


