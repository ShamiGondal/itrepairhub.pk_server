import { getDb } from '../config/db.config.js';

/**
 * Create a new consultation booking
 * Public endpoint - guests can book without authentication
 * SEO-optimized: Single INSERT query, fast response
 */
export async function createConsultation(req, res) {
  try {
    const { name, phone, email, type, scheduled_at } = req.body;

    // Validation: name, phone, type, scheduled_at are required
    if (!name || !phone || !type || !scheduled_at) {
      return res.status(400).json({
        success: false,
        message: 'name, phone, type, and scheduled_at are required',
      });
    }

    // Validate type enum
    if (!['on_site', 'online_meeting'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be either "on_site" or "online_meeting"',
      });
    }

    // Validate scheduled_at is a valid datetime
    let scheduledDate;
    try {
      scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'scheduled_at must be a valid datetime',
        });
      }
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'scheduled_at must be a valid datetime',
      });
    }

    // Check if scheduled_at is in the future
    if (scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'scheduled_at must be in the future',
      });
    }

    const db = getDb();

    // user_id is optional - use req.user.id if authenticated, otherwise null
    // req.user is set by isAuth middleware, but this endpoint is public
    const userId = req.user?.id || null;

    // Format datetime for MySQL (YYYY-MM-DD HH:MM:SS)
    const mysqlDateTime = scheduledDate.toISOString().slice(0, 19).replace('T', ' ');

    // Single optimized INSERT query
    const [result] = await db.query(
      'INSERT INTO consultations (user_id, name, phone, email, type, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, name.trim(), phone.trim(), email?.trim() || null, type, mysqlDateTime, 'requested']
    );

    // Fetch the created consultation in a single query
    const [rows] = await db.query(
      'SELECT id, user_id, name, phone, email, type, scheduled_at, status, created_at FROM consultations WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    return res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Consultation booking created successfully',
    });
  } catch (err) {
    console.error('Consultation creation error:', err);
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user_id',
      });
    }
    if (err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      return res.status(400).json({
        success: false,
        message: 'Invalid datetime format',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create consultation booking',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Get all consultations for the authenticated user
 * SEO-optimized: Single SELECT query with ORDER BY
 */
export async function getMyConsultations(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, user_id, name, phone, email, type, scheduled_at, status, created_at FROM consultations WHERE user_id = ? ORDER BY scheduled_at DESC, created_at DESC',
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch consultations',
    });
  }
}

/**
 * Get a single consultation by ID
 * Users can only view their own consultations, admins can view any
 * SEO-optimized: Single SELECT query with permission check
 */
export async function getConsultationById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Single query to fetch consultation
    const [rows] = await db.query(
      'SELECT id, user_id, name, phone, email, type, scheduled_at, status, created_at FROM consultations WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    const consultation = rows[0];

    // Permission check: user can only view their own, admin can view any
    if (req.user.role !== 'admin' && consultation.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    return res.status(200).json({
      success: true,
      data: consultation,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch consultation',
    });
  }
}

/**
 * Update a consultation
 * Users can only update their own consultations, admins can update any
 * SEO-optimized: Single UPDATE query with permission check
 */
export async function updateConsultation(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, email, type, scheduled_at, status } = req.body;

    const db = getDb();

    // First, check if consultation exists and user has permission
    const [existingRows] = await db.query(
      'SELECT user_id FROM consultations WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    // Permission check: user can only update their own, admin can update any
    if (req.user.role !== 'admin' && existingRows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Validate type if provided
    if (type && !['on_site', 'online_meeting'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be either "on_site" or "online_meeting"',
      });
    }

    // Validate status if provided
    if (status && !['requested', 'scheduled', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'status must be one of: "requested", "scheduled", "completed"',
      });
    }

    // Validate scheduled_at if provided
    if (scheduled_at) {
      const scheduledDate = new Date(scheduled_at);
      if (isNaN(scheduledDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'scheduled_at must be a valid datetime',
        });
      }
      if (scheduledDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'scheduled_at must be in the future',
        });
      }
    }

    // Build dynamic UPDATE query (only update provided fields)
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name.trim());
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone.trim());
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email?.trim() || null);
    }
    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type);
    }
    if (scheduled_at !== undefined) {
      updates.push('scheduled_at = ?');
      values.push(scheduled_at);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    values.push(id);

    // Single optimized UPDATE query
    await db.query(`UPDATE consultations SET ${updates.join(', ')} WHERE id = ?`, values);

    // Fetch updated consultation
    const [rows] = await db.query(
      'SELECT id, user_id, name, phone, email, type, scheduled_at, status, created_at FROM consultations WHERE id = ? LIMIT 1',
      [id]
    );

    return res.status(200).json({
      success: true,
      data: rows[0],
      message: 'Consultation updated successfully',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update consultation',
    });
  }
}

/**
 * Delete a consultation
 * Users can only delete their own consultations, admins can delete any
 * SEO-optimized: Single DELETE query with permission check
 */
export async function deleteConsultation(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // First, check if consultation exists and user has permission
    const [existingRows] = await db.query(
      'SELECT user_id FROM consultations WHERE id = ? LIMIT 1',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    // Permission check: user can only delete their own, admin can delete any
    if (req.user.role !== 'admin' && existingRows[0].user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Single optimized DELETE query
    const [result] = await db.query('DELETE FROM consultations WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Consultation deleted successfully',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete consultation',
    });
  }
}

