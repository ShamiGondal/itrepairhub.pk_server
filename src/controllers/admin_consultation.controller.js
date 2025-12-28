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
 * Get all consultations with filtering, pagination, and search
 * Admin only - requires authentication
 * Supports filtering by status, type, user, date range
 */
export async function getAllConsultations(req, res) {
  try {
    const db = getDb();
    const {
      status,
      type,
      user_id,
      user_email,
      user_name,
      name,
      phone,
      email,
      start_date,
      end_date,
      search,
      page = 1,
      limit = 50,
      sort = 'created_at',
      order = 'DESC',
    } = req.query;

    // Build WHERE clause
    const whereConditions = [];
    const queryParams = [];

    if (status) {
      whereConditions.push('c.status = ?');
      queryParams.push(status);
    }

    if (type) {
      whereConditions.push('c.type = ?');
      queryParams.push(type);
    }

    if (user_id) {
      whereConditions.push('c.user_id = ?');
      queryParams.push(user_id);
    }

    if (user_email) {
      whereConditions.push('u.email LIKE ?');
      queryParams.push(`%${user_email}%`);
    }

    if (user_name) {
      whereConditions.push('u.full_name LIKE ?');
      queryParams.push(`%${user_name}%`);
    }

    if (name) {
      whereConditions.push('c.name LIKE ?');
      queryParams.push(`%${name}%`);
    }

    if (phone) {
      whereConditions.push('c.phone LIKE ?');
      queryParams.push(`%${phone}%`);
    }

    if (email) {
      whereConditions.push('c.email LIKE ?');
      queryParams.push(`%${email}%`);
    }

    if (start_date) {
      whereConditions.push('DATE(c.scheduled_at) >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('DATE(c.scheduled_at) <= ?');
      queryParams.push(end_date);
    }

    if (search) {
      whereConditions.push('(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort and order
    const allowedSortFields = ['created_at', 'scheduled_at', 'status', 'type', 'id'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get consultations with user info
    const [consultationRows] = await db.query(
      `SELECT 
        c.id,
        c.user_id,
        c.name,
        c.phone,
        c.email,
        c.type,
        c.scheduled_at,
        c.status,
        c.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone
      FROM consultations c
      LEFT JOIN users u ON c.user_id = u.id
      ${whereClause}
      ORDER BY c.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
      FROM consultations c
      LEFT JOIN users u ON c.user_id = u.id
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Format consultations
    const consultations = consultationRows.map(consultation => ({
      id: consultation.id,
      user: consultation.user_id ? {
        id: consultation.user_id,
        name: consultation.user_name,
        email: consultation.user_email,
        phone: consultation.user_phone,
      } : null,
      name: consultation.name,
      phone: consultation.phone,
      email: consultation.email,
      type: consultation.type,
      scheduled_at: consultation.scheduled_at,
      status: consultation.status,
      created_at: consultation.created_at,
    }));

    return res.status(200).json({
      success: true,
      data: consultations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch consultations');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get consultation by ID with full details including user info
 * Admin only - includes all consultation info and user details
 */
export async function getConsultationById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    // Get consultation basic info with user
    const [consultationRows] = await db.query(
      `SELECT 
        c.id,
        c.user_id,
        c.name,
        c.phone,
        c.email,
        c.type,
        c.scheduled_at,
        c.status,
        c.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone,
        u.role as user_role
      FROM consultations c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?`,
      [id]
    );

    if (consultationRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    const consultation = consultationRows[0];

    return res.status(200).json({
      success: true,
      data: {
        id: consultation.id,
        user: consultation.user_id ? {
          id: consultation.user_id,
          name: consultation.user_name,
          email: consultation.user_email,
          phone: consultation.user_phone,
          role: consultation.user_role,
        } : null,
        name: consultation.name,
        phone: consultation.phone,
        email: consultation.email,
        type: consultation.type,
        scheduled_at: consultation.scheduled_at,
        status: consultation.status,
        created_at: consultation.created_at,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch consultation');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update consultation status
 * Admin only - validates status transitions
 * Status flow: requested -> scheduled -> completed
 */
export async function updateConsultationStatus(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['requested', 'scheduled', 'completed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Check if consultation exists
    const [consultationRows] = await db.query(
      'SELECT id, status FROM consultations WHERE id = ?',
      [id]
    );

    if (consultationRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    // Update status
    await db.query(
      'UPDATE consultations SET status = ? WHERE id = ?',
      [status, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Consultation status updated successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update consultation status');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update consultation details
 * Admin only - allows updating scheduled_at, type, name, phone, email
 */
export async function updateConsultationDetails(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { scheduled_at, type, name, phone, email } = req.body;

    // Check if consultation exists
    const [consultationRows] = await db.query(
      'SELECT id FROM consultations WHERE id = ?',
      [id]
    );

    if (consultationRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    // Validate type if provided
    if (type && !['on_site', 'online_meeting'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be either "on_site" or "online_meeting"',
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
      // Allow past dates for rescheduling completed consultations
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (scheduled_at !== undefined) {
      const mysqlDateTime = new Date(scheduled_at).toISOString().slice(0, 19).replace('T', ' ');
      updates.push('scheduled_at = ?');
      values.push(mysqlDateTime);
    }

    if (type !== undefined) {
      updates.push('type = ?');
      values.push(type);
    }

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

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one field must be provided for update',
      });
    }

    values.push(id);

    await db.query(
      `UPDATE consultations SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return res.status(200).json({
      success: true,
      message: 'Consultation details updated successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update consultation details');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Delete consultation
 * Admin only - permanently deletes consultation
 */
export async function deleteConsultation(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    // Check if consultation exists
    const [consultationRows] = await db.query(
      'SELECT id FROM consultations WHERE id = ?',
      [id]
    );

    if (consultationRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Consultation not found',
      });
    }

    // Delete consultation
    await db.query('DELETE FROM consultations WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Consultation deleted successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to delete consultation');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

