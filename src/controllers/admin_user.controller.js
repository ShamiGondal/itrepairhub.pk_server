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
 * Get all users with filtering, pagination, and statistics
 * Admin only - requires authentication
 * Supports filtering by role, email, name, and search
 */
export async function getAllUsers(req, res) {
  try {
    const db = getDb();
    const {
      role,
      email,
      name,
      search,
      page = 1,
      limit = 50,
      sort = 'created_at',
      order = 'DESC',
    } = req.query;

    // Build WHERE clause
    const whereConditions = [];
    const queryParams = [];

    if (role) {
      whereConditions.push('u.role = ?');
      queryParams.push(role);
    }

    if (email) {
      whereConditions.push('u.email LIKE ?');
      queryParams.push(`%${email}%`);
    }

    if (name) {
      whereConditions.push('u.full_name LIKE ?');
      queryParams.push(`%${name}%`);
    }

    if (search) {
      whereConditions.push('(u.full_name LIKE ? OR u.email LIKE ? OR u.phone_number LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort and order
    const allowedSortFields = ['created_at', 'full_name', 'email', 'role', 'id'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get users with statistics
    const [userRows] = await db.query(
      `SELECT 
        u.id,
        u.full_name,
        u.email,
        u.phone_number,
        u.role,
        u.auth_provider,
        u.created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'pending' THEN o.id END) as pending_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'processing' THEN o.id END) as processing_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'shipped' THEN o.id END) as shipped_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'delivered' THEN o.id END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'cancelled' THEN o.id END) as cancelled_orders,
        COUNT(DISTINCT b.id) as total_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'pending' THEN b.id END) as pending_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as confirmed_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END) as cancelled_bookings,
        COUNT(DISTINCT c.id) as total_consultations,
        COUNT(DISTINCT CASE WHEN c.status = 'requested' THEN c.id END) as requested_consultations,
        COUNT(DISTINCT CASE WHEN c.status = 'scheduled' THEN c.id END) as scheduled_consultations,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_consultations
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
      LEFT JOIN bookings b ON u.id = b.user_id
      LEFT JOIN consultations c ON u.id = c.user_id
      ${whereClause}
      GROUP BY u.id
      ORDER BY u.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Format users with statistics
    const users = userRows.map(user => ({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone_number,
      role: user.role,
      auth_provider: user.auth_provider,
      created_at: user.created_at,
      statistics: {
        orders: {
          total: parseInt(user.total_orders) || 0,
          pending: parseInt(user.pending_orders) || 0,
          processing: parseInt(user.processing_orders) || 0,
          shipped: parseInt(user.shipped_orders) || 0,
          delivered: parseInt(user.delivered_orders) || 0,
          cancelled: parseInt(user.cancelled_orders) || 0,
        },
        bookings: {
          total: parseInt(user.total_bookings) || 0,
          pending: parseInt(user.pending_bookings) || 0,
          confirmed: parseInt(user.confirmed_bookings) || 0,
          completed: parseInt(user.completed_bookings) || 0,
          cancelled: parseInt(user.cancelled_bookings) || 0,
        },
        consultations: {
          total: parseInt(user.total_consultations) || 0,
          requested: parseInt(user.requested_consultations) || 0,
          scheduled: parseInt(user.scheduled_consultations) || 0,
          completed: parseInt(user.completed_consultations) || 0,
        },
      },
    }));

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch users');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get user by ID with full details and statistics
 * Admin only - includes all user info, orders, bookings, consultations
 */
export async function getUserById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    // Get user basic info
    const [userRows] = await db.query(
      `SELECT 
        id,
        full_name,
        email,
        phone_number,
        role,
        auth_provider,
        created_at
      FROM users
      WHERE id = ?`,
      [id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userRows[0];

    // Get user statistics
    const [orderStats] = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN order_status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN order_status = 'shipped' THEN 1 END) as shipped,
        COUNT(CASE WHEN order_status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) as cancelled
      FROM orders
      WHERE user_id = ?`,
      [id]
    );

    const [bookingStats] = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM bookings
      WHERE user_id = ?`,
      [id]
    );

    const [consultationStats] = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'requested' THEN 1 END) as requested,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM consultations
      WHERE user_id = ?`,
      [id]
    );

    // Get user addresses
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
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
        auth_provider: user.auth_provider,
        created_at: user.created_at,
        addresses: addressRows,
        statistics: {
          orders: {
            total: parseInt(orderStats[0].total) || 0,
            pending: parseInt(orderStats[0].pending) || 0,
            processing: parseInt(orderStats[0].processing) || 0,
            shipped: parseInt(orderStats[0].shipped) || 0,
            delivered: parseInt(orderStats[0].delivered) || 0,
            cancelled: parseInt(orderStats[0].cancelled) || 0,
          },
          bookings: {
            total: parseInt(bookingStats[0].total) || 0,
            pending: parseInt(bookingStats[0].pending) || 0,
            confirmed: parseInt(bookingStats[0].confirmed) || 0,
            completed: parseInt(bookingStats[0].completed) || 0,
            cancelled: parseInt(bookingStats[0].cancelled) || 0,
          },
          consultations: {
            total: parseInt(consultationStats[0].total) || 0,
            requested: parseInt(consultationStats[0].requested) || 0,
            scheduled: parseInt(consultationStats[0].scheduled) || 0,
            completed: parseInt(consultationStats[0].completed) || 0,
          },
        },
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch user');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update user role
 * Admin only - allows changing user roles
 */
export async function updateUserRole(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['customer', 'business', 'admin', 'technician'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be one of: customer, business, admin, technician',
      });
    }

    // Check if user exists
    const [userRows] = await db.query(
      'SELECT id, role FROM users WHERE id = ?',
      [id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update role
    await db.query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );

    return res.status(200).json({
      success: true,
      message: 'User role updated successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update user role');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get all guest users with filtering, pagination, and statistics
 * Admin only - requires authentication
 * Groups by composite key (email + phone_number) to show unique guests only
 * Aggregates all orders, bookings, and consultations for the same composite key
 */
export async function getAllGuestUsers(req, res) {
  try {
    const db = getDb();
    const {
      email,
      phone,
      name,
      search,
      page = 1,
      limit = 50,
      sort = 'created_at',
      order = 'DESC',
    } = req.query;

    // Build WHERE clause for filtering
    const whereConditions = [];
    const queryParams = [];

    if (email) {
      whereConditions.push('gd.email LIKE ?');
      queryParams.push(`%${email}%`);
    }

    if (phone) {
      whereConditions.push('gd.phone_number LIKE ?');
      queryParams.push(`%${phone}%`);
    }

    if (name) {
      whereConditions.push('gd.full_name LIKE ?');
      queryParams.push(`%${name}%`);
    }

    if (search) {
      whereConditions.push('(gd.full_name LIKE ? OR gd.email LIKE ? OR gd.phone_number LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort and order
    const allowedSortFields = ['created_at', 'full_name', 'email', 'phone_number'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get unique guest users grouped by composite key (email + phone_number)
    // Aggregates all statistics across all guest_details records with the same email and phone
    const [guestRows] = await db.query(
      `SELECT 
        MIN(gd.id) as id,
        MAX(gd.full_name) as full_name,
        gd.email,
        gd.phone_number,
        MAX(gd.address_line_1) as address_line_1,
        MAX(gd.address_line_2) as address_line_2,
        MAX(gd.city) as city,
        MAX(gd.state) as state,
        MAX(gd.postal_code) as postal_code,
        MIN(gd.created_at) as created_at,
        CONCAT(gd.email, '|', gd.phone_number) as composite_key,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'pending' THEN o.id END) as pending_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'processing' THEN o.id END) as processing_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'shipped' THEN o.id END) as shipped_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'delivered' THEN o.id END) as delivered_orders,
        COUNT(DISTINCT CASE WHEN o.order_status = 'cancelled' THEN o.id END) as cancelled_orders,
        COUNT(DISTINCT b.id) as total_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'pending' THEN b.id END) as pending_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as confirmed_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
        COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END) as cancelled_bookings,
        COUNT(DISTINCT c.id) as total_consultations,
        COUNT(DISTINCT CASE WHEN c.status = 'requested' THEN c.id END) as requested_consultations,
        COUNT(DISTINCT CASE WHEN c.status = 'scheduled' THEN c.id END) as scheduled_consultations,
        COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END) as completed_consultations
      FROM guest_details gd
      LEFT JOIN guest_details gd_all ON (gd_all.email = gd.email AND gd_all.phone_number = gd.phone_number)
      LEFT JOIN orders o ON o.guest_id = gd_all.id
      LEFT JOIN bookings b ON b.guest_id = gd_all.id
      LEFT JOIN consultations c ON (LOWER(c.email) = LOWER(gd.email) AND c.phone = gd.phone_number)
      ${whereClause}
      GROUP BY gd.email, gd.phone_number
      ORDER BY ${sortField === 'created_at' ? 'MIN(gd.created_at)' : `MAX(gd.${sortField})`} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count of unique composite keys for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(DISTINCT CONCAT(gd.email, '|', gd.phone_number)) as total
      FROM guest_details gd
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Format guest users with aggregated statistics
    const guests = guestRows.map(guest => ({
      id: guest.id, // Use the minimum ID as the representative ID
      full_name: guest.full_name,
      email: guest.email,
      phone_number: guest.phone_number,
      address: {
        line_1: guest.address_line_1,
        line_2: guest.address_line_2,
        city: guest.city,
        state: guest.state,
        postal_code: guest.postal_code,
      },
      composite_key: guest.composite_key,
      created_at: guest.created_at,
      statistics: {
        orders: {
          total: parseInt(guest.total_orders) || 0,
          pending: parseInt(guest.pending_orders) || 0,
          processing: parseInt(guest.processing_orders) || 0,
          shipped: parseInt(guest.shipped_orders) || 0,
          delivered: parseInt(guest.delivered_orders) || 0,
          cancelled: parseInt(guest.cancelled_orders) || 0,
        },
        bookings: {
          total: parseInt(guest.total_bookings) || 0,
          pending: parseInt(guest.pending_bookings) || 0,
          confirmed: parseInt(guest.confirmed_bookings) || 0,
          completed: parseInt(guest.completed_bookings) || 0,
          cancelled: parseInt(guest.cancelled_bookings) || 0,
        },
        consultations: {
          total: parseInt(guest.total_consultations) || 0,
          requested: parseInt(guest.requested_consultations) || 0,
          scheduled: parseInt(guest.scheduled_consultations) || 0,
          completed: parseInt(guest.completed_consultations) || 0,
        },
      },
    }));

    return res.status(200).json({
      success: true,
      data: guests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch guest users');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get guest user by ID with full details and statistics
 * Admin only - includes all guest info, address, and comprehensive statistics
 * Aggregates statistics from all guest_details records with the same composite key
 */
export async function getGuestUserById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    // Get guest basic info to find the composite key
    const [guestRows] = await db.query(
      'SELECT * FROM guest_details WHERE id = ? LIMIT 1',
      [id]
    );

    if (guestRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Guest user not found',
      });
    }

    const guest = guestRows[0];
    const compositeKey = `${guest.email}|${guest.phone_number}`;

    // Get all guest_details IDs with the same composite key
    const [allGuestIds] = await db.query(
      `SELECT id FROM guest_details 
       WHERE email = ? AND phone_number = ?`,
      [guest.email, guest.phone_number]
    );

    const guestIds = allGuestIds.map(row => row.id);

    // Get aggregated statistics from all guest records with the same composite key
    const [orderStats] = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN order_status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN order_status = 'processing' THEN 1 END) as processing,
        COUNT(CASE WHEN order_status = 'shipped' THEN 1 END) as shipped,
        COUNT(CASE WHEN order_status = 'delivered' THEN 1 END) as delivered,
        COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) as cancelled
      FROM orders
      WHERE guest_id IN (?)`,
      [guestIds]
    );

    const [bookingStats] = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM bookings
      WHERE guest_id IN (?)`,
      [guestIds]
    );

    const [consultationStats] = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'requested' THEN 1 END) as requested,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM consultations
      WHERE (LOWER(email) = LOWER(?) AND phone = ?)`,
      [guest.email, guest.phone_number]
    );

    // Get the most recent address information (or use the first guest's address)
    const [latestGuest] = await db.query(
      `SELECT 
        address_line_1, address_line_2, city, state, postal_code
      FROM guest_details
      WHERE email = ? AND phone_number = ?
      ORDER BY created_at DESC
      LIMIT 1`,
      [guest.email, guest.phone_number]
    );

    const addressInfo = latestGuest[0] || {
      address_line_1: guest.address_line_1,
      address_line_2: guest.address_line_2,
      city: guest.city,
      state: guest.state,
      postal_code: guest.postal_code,
    };

    // Get the earliest created_at for this composite key
    const [earliestCreated] = await db.query(
      `SELECT MIN(created_at) as created_at
      FROM guest_details
      WHERE email = ? AND phone_number = ?`,
      [guest.email, guest.phone_number]
    );

    return res.status(200).json({
      success: true,
      data: {
        id: guest.id, // Representative ID
        full_name: guest.full_name,
        email: guest.email,
        phone_number: guest.phone_number,
        address: {
          line_1: addressInfo.address_line_1,
          line_2: addressInfo.address_line_2,
          city: addressInfo.city,
          state: addressInfo.state,
          postal_code: addressInfo.postal_code,
        },
        composite_key: compositeKey,
        created_at: earliestCreated[0].created_at || guest.created_at,
        total_guest_records: guestIds.length, // Number of guest_details records with this composite key
        statistics: {
          orders: {
            total: parseInt(orderStats[0].total) || 0,
            pending: parseInt(orderStats[0].pending) || 0,
            processing: parseInt(orderStats[0].processing) || 0,
            shipped: parseInt(orderStats[0].shipped) || 0,
            delivered: parseInt(orderStats[0].delivered) || 0,
            cancelled: parseInt(orderStats[0].cancelled) || 0,
          },
          bookings: {
            total: parseInt(bookingStats[0].total) || 0,
            pending: parseInt(bookingStats[0].pending) || 0,
            confirmed: parseInt(bookingStats[0].confirmed) || 0,
            completed: parseInt(bookingStats[0].completed) || 0,
            cancelled: parseInt(bookingStats[0].cancelled) || 0,
          },
          consultations: {
            total: parseInt(consultationStats[0].total) || 0,
            requested: parseInt(consultationStats[0].requested) || 0,
            scheduled: parseInt(consultationStats[0].scheduled) || 0,
            completed: parseInt(consultationStats[0].completed) || 0,
          },
        },
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch guest user');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

