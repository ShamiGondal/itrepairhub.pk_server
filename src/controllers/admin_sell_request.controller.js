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
 * Get all sell requests with filtering, pagination, and search
 * Admin only - requires authentication
 * Supports filtering by status, request_type, user, date range
 */
export async function getAllSellRequests(req, res) {
  try {
    const db = getDb();
    const {
      status,
      request_type,
      user_id,
      user_email,
      user_name,
      device_type,
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
      whereConditions.push('sr.status = ?');
      queryParams.push(status);
    }

    if (request_type) {
      whereConditions.push('sr.request_type = ?');
      queryParams.push(request_type);
    }

    if (user_id) {
      whereConditions.push('sr.user_id = ?');
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

    if (device_type) {
      whereConditions.push('sr.device_type LIKE ?');
      queryParams.push(`%${device_type}%`);
    }

    if (start_date) {
      whereConditions.push('DATE(sr.created_at) >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('DATE(sr.created_at) <= ?');
      queryParams.push(end_date);
    }

    if (search) {
      whereConditions.push('(sr.device_type LIKE ? OR sr.brand LIKE ? OR sr.model LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort and order
    const allowedSortFields = ['created_at', 'status', 'device_type', 'user_requested_price', 'estimated_price', 'final_offer_price', 'id'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get sell requests with user info
    const [requestRows] = await db.query(
      `SELECT 
        sr.id,
        sr.user_id,
        sr.request_type,
        sr.device_type,
        sr.brand,
        sr.model,
        sr.specifications,
        sr.condition_notes,
        sr.user_requested_price,
        sr.estimated_price,
        sr.final_offer_price,
        sr.address_id,
        sr.contact_number,
        sr.status,
        sr.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone
      FROM sell_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      ${whereClause}
      ORDER BY sr.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
      FROM sell_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Parse JSON fields and format requests
    const requests = requestRows.map(request => {
      // Parse specifications
      let specifications = {};
      if (request.specifications) {
        try {
          specifications = typeof request.specifications === 'string' 
            ? JSON.parse(request.specifications) 
            : request.specifications;
        } catch (e) {
          specifications = {};
        }
      }

      // Parse condition_notes
      let condition_notes = null;
      if (request.condition_notes) {
        try {
          condition_notes = typeof request.condition_notes === 'string' 
            ? JSON.parse(request.condition_notes) 
            : request.condition_notes;
        } catch (e) {
          condition_notes = null;
        }
      }

      return {
        id: request.id,
        user: {
          id: request.user_id,
          name: request.user_name,
          email: request.user_email,
          phone: request.user_phone,
        },
        request_type: request.request_type,
        device_type: request.device_type,
        brand: request.brand,
        model: request.model,
        specifications,
        condition_notes,
        pricing: {
          user_requested_price: request.user_requested_price ? parseFloat(request.user_requested_price) : null,
          estimated_price: request.estimated_price ? parseFloat(request.estimated_price) : null,
          final_offer_price: request.final_offer_price ? parseFloat(request.final_offer_price) : null,
        },
        address_id: request.address_id,
        contact_number: request.contact_number,
        status: request.status,
        created_at: request.created_at,
      };
    });

    return res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch sell requests');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get sell request by ID with full details including images and address
 * Admin only - includes all request info, user, images, address
 */
export async function getSellRequestById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    // Get sell request basic info with user
    const [requestRows] = await db.query(
      `SELECT 
        sr.id,
        sr.user_id,
        sr.request_type,
        sr.device_type,
        sr.brand,
        sr.model,
        sr.specifications,
        sr.condition_notes,
        sr.user_requested_price,
        sr.estimated_price,
        sr.final_offer_price,
        sr.address_id,
        sr.contact_number,
        sr.status,
        sr.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone,
        u.role as user_role
      FROM sell_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.id = ?`,
      [id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sell request not found',
      });
    }

    const request = requestRows[0];

    // Parse JSON fields
    let specifications = {};
    if (request.specifications) {
      try {
        specifications = typeof request.specifications === 'string' 
          ? JSON.parse(request.specifications) 
          : request.specifications;
      } catch (e) {
        specifications = {};
      }
    }

    let condition_notes = null;
    if (request.condition_notes) {
      try {
        condition_notes = typeof request.condition_notes === 'string' 
          ? JSON.parse(request.condition_notes) 
          : request.condition_notes;
      } catch (e) {
        condition_notes = null;
      }
    }

    // Get images
    const [imageRows] = await db.query(
      `SELECT 
        id,
        image_url,
        alt_text,
        display_order
      FROM sell_request_images
      WHERE sell_request_id = ?
      ORDER BY display_order ASC`,
      [id]
    );

    // Get address if address_id exists
    let address = null;
    if (request.address_id) {
      const [addressRows] = await db.query(
        `SELECT 
          id,
          label,
          line_1,
          line_2,
          city,
          state,
          postal_code,
          created_at
        FROM addresses
        WHERE id = ?`,
        [request.address_id]
      );

      if (addressRows.length > 0) {
        address = addressRows[0];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: request.id,
        user: {
          id: request.user_id,
          name: request.user_name,
          email: request.user_email,
          phone: request.user_phone,
          role: request.user_role,
        },
        request_type: request.request_type,
        device_type: request.device_type,
        brand: request.brand,
        model: request.model,
        specifications,
        condition_notes,
        pricing: {
          user_requested_price: request.user_requested_price ? parseFloat(request.user_requested_price) : null,
          estimated_price: request.estimated_price ? parseFloat(request.estimated_price) : null,
          final_offer_price: request.final_offer_price ? parseFloat(request.final_offer_price) : null,
        },
        address,
        contact_number: request.contact_number,
        status: request.status,
        images: imageRows.map(img => ({
          id: img.id,
          image_url: img.image_url,
          alt_text: img.alt_text,
          display_order: img.display_order,
        })),
        created_at: request.created_at,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch sell request');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update sell request status
 * Admin only - validates status transitions
 * Status flow: submitted -> inspection_pending -> purchased/rejected
 */
export async function updateSellRequestStatus(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status, note } = req.body;

    // Validate status
    const validStatuses = ['submitted', 'inspection_pending', 'purchased', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Check if request exists
    const [requestRows] = await db.query(
      'SELECT id, status FROM sell_requests WHERE id = ?',
      [id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sell request not found',
      });
    }

    const currentStatus = requestRows[0].status;

    // Validate status transition (basic validation)
    // Allow any transition for flexibility, but you can add stricter rules here
    if (status === 'purchased' && currentStatus === 'submitted') {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark as purchased without inspection. Please set status to inspection_pending first.',
      });
    }

    // Update status
    await db.query(
      'UPDATE sell_requests SET status = ? WHERE id = ?',
      [status, id]
    );

    // If note provided, add it to admin_notes (we'll use condition_notes or create a notes field)
    // For now, we can store notes in a separate table or use condition_notes
    // Let's add a simple notes field update if needed

    return res.status(200).json({
      success: true,
      message: 'Sell request status updated successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update sell request status');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update sell request prices
 * Admin only - allows setting estimated_price and final_offer_price
 */
export async function updateSellRequestPrices(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { estimated_price, final_offer_price } = req.body;

    // Check if request exists
    const [requestRows] = await db.query(
      'SELECT id FROM sell_requests WHERE id = ?',
      [id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sell request not found',
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (estimated_price !== undefined) {
      const price = parseFloat(estimated_price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: 'estimated_price must be a valid positive number',
        });
      }
      updates.push('estimated_price = ?');
      values.push(price);
    }

    if (final_offer_price !== undefined) {
      const price = parseFloat(final_offer_price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: 'final_offer_price must be a valid positive number',
        });
      }
      updates.push('final_offer_price = ?');
      values.push(price);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one price field (estimated_price or final_offer_price) must be provided',
      });
    }

    values.push(id);

    await db.query(
      `UPDATE sell_requests SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return res.status(200).json({
      success: true,
      message: 'Sell request prices updated successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update sell request prices');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Add inspection notes/comments
 * Admin only - allows adding notes for inspection team
 * We'll store notes in condition_notes or create a separate notes system
 * For now, we'll append to condition_notes as a notes array
 */
export async function addInspectionNotes(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { note, note_type = 'inspection' } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note is required',
      });
    }

    // Check if request exists
    const [requestRows] = await db.query(
      'SELECT id, condition_notes FROM sell_requests WHERE id = ?',
      [id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sell request not found',
      });
    }

    // Get existing condition_notes
    let conditionNotes = null;
    if (requestRows[0].condition_notes) {
      try {
        conditionNotes = typeof requestRows[0].condition_notes === 'string' 
          ? JSON.parse(requestRows[0].condition_notes) 
          : requestRows[0].condition_notes;
      } catch (e) {
        conditionNotes = {};
      }
    } else {
      conditionNotes = {};
    }

    // Add note with timestamp
    if (!conditionNotes.admin_notes) {
      conditionNotes.admin_notes = [];
    }
    
    conditionNotes.admin_notes.push({
      note: note.trim(),
      note_type,
      added_at: new Date().toISOString(),
    });

    // Update condition_notes
    await db.query(
      'UPDATE sell_requests SET condition_notes = ? WHERE id = ?',
      [JSON.stringify(conditionNotes), id]
    );

    return res.status(200).json({
      success: true,
      message: 'Inspection note added successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to add inspection note');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

