import { getDb } from '../config/db.config.js';
import bcrypt from 'bcrypt';

// ===== PROFILE CONTROLLERS =====

export async function getMe(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, full_name, email, phone_number, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
}

export async function updateMe(req, res) {
  try {
    const { full_name, email, phone_number } = req.body;
    
    if (!full_name && !email && !phone_number) {
      return res.status(400).json({ 
        success: false, 
        message: 'At least one field (full_name, email, or phone_number) is required' 
      });
    }

    const db = getDb();

    // Check if email is being changed and if it's already taken
    if (email && email !== req.user.email) {
      const [existing] = await db.query(
        'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
        [email, req.user.id]
      );
      
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }

    await db.query(
      'UPDATE users SET full_name = COALESCE(?, full_name), email = COALESCE(?, email), phone_number = COALESCE(?, phone_number) WHERE id = ?',
      [full_name || null, email || null, phone_number || null, req.user.id]
    );

    const [rows] = await db.query(
      'SELECT id, full_name, email, phone_number, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateMe error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
}

export async function updatePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ 
        success: false, 
        message: 'current_password and new_password are required' 
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'New password must be at least 8 characters long' 
      });
    }

    const db = getDb();

    // Get current password hash
    const [userRows] = await db.query(
      'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(current_password, userRows[0].password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(new_password, salt);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('updatePassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update password' });
  }
}

// ===== ADDRESS CONTROLLERS =====

export async function getMyAddresses(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      `SELECT id, label, line_1, line_2, 
       city, state, postal_code, created_at 
       FROM addresses 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('getMyAddresses error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
}

export async function getMyAddress(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const [rows] = await db.query(
      `SELECT id, label, line_1, line_2, 
       city, state, postal_code, created_at 
       FROM addresses 
       WHERE id = ? AND user_id = ? 
       LIMIT 1`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getMyAddress error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch address' });
  }
}

export async function addMyAddress(req, res) {
  try {
    const { label, line_1, line_2, city, state, postal_code } = req.body;
    
    if (!line_1 || !city || !postal_code) {
      return res.status(400).json({ 
        success: false, 
        message: 'line_1, city, and postal_code are required' 
      });
    }

    const db = getDb();

    const [result] = await db.query(
      `INSERT INTO addresses 
       (user_id, label, line_1, line_2, city, state, postal_code) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, label || null, line_1, line_2 || null, 
       city, state || null, postal_code]
    );

    const [rows] = await db.query(
      `SELECT id, label, line_1, line_2, 
       city, state, postal_code, created_at 
       FROM addresses 
       WHERE id = ? AND user_id = ? 
       LIMIT 1`,
      [result.insertId, req.user.id]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('addMyAddress error:', err);
    return res.status(500).json({ success: false, message: 'Failed to add address' });
  }
}

export async function updateMyAddress(req, res) {
  try {
    const { id } = req.params;
    const { label, line_1, line_2, city, state, postal_code } = req.body;

    const db = getDb();

    // Check if address exists and belongs to user
    const [existing] = await db.query(
      'SELECT id FROM addresses WHERE id = ? AND user_id = ? LIMIT 1',
      [id, req.user.id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    await db.query(
      `UPDATE addresses SET 
       label = COALESCE(?, label),
       line_1 = COALESCE(?, line_1),
       line_2 = COALESCE(?, line_2),
       city = COALESCE(?, city),
       state = COALESCE(?, state),
       postal_code = COALESCE(?, postal_code)
       WHERE id = ? AND user_id = ?`,
      [label, line_1, line_2, city, state, postal_code, id, req.user.id]
    );

    const [rows] = await db.query(
      `SELECT id, label, line_1, line_2, 
       city, state, postal_code, created_at 
       FROM addresses 
       WHERE id = ? AND user_id = ? 
       LIMIT 1`,
      [id, req.user.id]
    );

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateMyAddress error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update address' });
  }
}

export async function deleteMyAddress(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [result] = await db.query(
      'DELETE FROM addresses WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    return res.status(200).json({ success: true, message: 'Address deleted' });
  } catch (err) {
    console.error('deleteMyAddress error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
}


// ===== ORDER CONTROLLERS =====

export async function getMyOrders(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      `SELECT o.id, o.order_status as status, o.payment_status, 
       o.subtotal, o.discount_amount, o.total_amount, 
       o.created_at,
       COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('getMyOrders error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
}

export async function getMyOrder(req, res) {
  try {
    const { id } = req.params;
    const orderId = parseInt(id, 10);
    
    // Validate order ID
    if (isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const db = getDb();

    // Get order details with all fields
    const [orderRows] = await db.query(
      `SELECT o.id, o.user_id, o.guest_id, o.address_id, o.subtotal, o.discount_amount, 
       o.total_amount, o.coupon_code, o.order_status, o.payment_status, o.created_at,
       a.line_1 as address_line_1, a.line_2 as address_line_2, a.city, a.state, a.postal_code
       FROM orders o
       LEFT JOIN addresses a ON o.address_id = a.id
       WHERE o.id = ? AND o.user_id = ?
       LIMIT 1`,
      [orderId, req.user.id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderRows[0];
    // Map order_status to status for frontend compatibility
    order.status = order.order_status;

    // Get order items with product details
    const [items] = await db.query(
      `SELECT oi.id, oi.order_id, oi.product_id, oi.custom_build_id, oi.quantity, oi.price_at_purchase,
       p.name as product_name, p.sku as product_sku,
       (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY display_order ASC LIMIT 1) as product_image_url
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?
       ORDER BY oi.id ASC`,
      [orderId]
    );

    order.items = items || [];

    return res.status(200).json({ success: true, data: order });
  } catch (err) {
    console.error('getMyOrder error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch order' });
  }
}

export async function cancelMyOrder(req, res) {
  try {
    const { id } = req.params;
    const orderId = parseInt(id, 10);
    
    // Validate order ID
    if (isNaN(orderId) || orderId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    const db = getDb();

    // Check if order exists and belongs to user
    const [orderRows] = await db.query(
      'SELECT id, order_status FROM orders WHERE id = ? AND user_id = ? LIMIT 1',
      [orderId, req.user.id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const order = orderRows[0];

    // Only allow cancellation of pending orders (not processing or other statuses)
    if (order.order_status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: `Order cannot be cancelled. Current status: ${order.order_status}` 
      });
    }

    // Update order status to cancelled
    await db.query(
      'UPDATE orders SET order_status = ? WHERE id = ? AND user_id = ?',
      ['cancelled', orderId, req.user.id]
    );

    return res.status(200).json({ success: true, message: 'Order cancelled successfully' });
  } catch (err) {
    console.error('cancelMyOrder error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel order' });
  }
}

// ===== BOOKING CONTROLLERS =====

export async function getMyBookings(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      `SELECT b.id, b.service_id, b.status, b.booking_date, b.booking_time,
       b.quoted_amount, b.discount_amount, b.total_amount, b.coupon_code,
       b.created_at, b.admin_notes,
       a.line_1 as address_line_1, a.line_2 as address_line_2, a.city, a.state, a.postal_code,
       s.name as service_name, s.price_type, s.price as service_price
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN addresses a ON b.address_id = a.id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );

    // Map booking_date/booking_time to scheduled_date/scheduled_time for frontend compatibility
    const bookings = rows.map(booking => ({
      ...booking,
      scheduled_date: booking.booking_date,
      scheduled_time: booking.booking_time,
    }));

    return res.status(200).json({ success: true, data: bookings });
  } catch (err) {
    console.error('getMyBookings error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
}

export async function getMyBooking(req, res) {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id, 10);
    
    // Validate booking ID
    if (isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const db = getDb();

    // Get booking with service and address details
    const [rows] = await db.query(
      `SELECT b.*, 
       s.name as service_name, s.price_type, s.price as service_price,
       a.line_1 as address_line_1, a.line_2 as address_line_2, a.city, a.state, a.postal_code
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       LEFT JOIN addresses a ON b.address_id = a.id
       WHERE b.id = ? AND b.user_id = ?
       LIMIT 1`,
      [bookingId, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = rows[0];
    // Map booking_date/booking_time to scheduled_date/scheduled_time for frontend compatibility
    booking.scheduled_date = booking.booking_date;
    booking.scheduled_time = booking.booking_time;
    
    // Format booking_time for display (HH:MM format)
    if (booking.booking_time) {
      const timeStr = booking.booking_time.toString();
      if (timeStr.includes(':')) {
        const [hours, minutes] = timeStr.split(':');
        booking.scheduled_time = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
      }
    }

    return res.status(200).json({ success: true, data: booking });
  } catch (err) {
    console.error('getMyBooking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
}

export async function cancelMyBooking(req, res) {
  try {
    const { id } = req.params;
    const bookingId = parseInt(id, 10);
    
    // Validate booking ID
    if (isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const db = getDb();

    // Check if booking exists and belongs to user
    const [bookingRows] = await db.query(
      'SELECT id, status FROM bookings WHERE id = ? AND user_id = ? LIMIT 1',
      [bookingId, req.user.id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingRows[0];

    // Only allow cancellation of pending or confirmed bookings
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Booking cannot be cancelled at this stage' 
      });
    }

    // Update booking status
    await db.query(
      'UPDATE bookings SET status = ? WHERE id = ? AND user_id = ?',
      ['cancelled', bookingId, req.user.id]
    );

    return res.status(200).json({ success: true, message: 'Booking cancelled successfully' });
  } catch (err) {
    console.error('cancelMyBooking error:', err);
    return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
}

// ===== CONSULTATION CONTROLLERS =====

/**
 * Normalize phone number for comparison
 * Removes all non-digit characters and handles common variations
 * For Pakistan numbers, extracts last 10 digits (mobile numbers)
 * This handles: +92XXXXXXXXXX, 0092XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 */
function normalizePhone(phone) {
  if (!phone) return null;
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // For Pakistan numbers, extract last 10 digits (mobile numbers)
  if (digits.length >= 10) {
    return digits.slice(-10); // Last 10 digits
  }
  return digits;
}

export async function getMyConsultations(req, res) {
  try {
    const db = getDb();
    
    // Get user's email and phone for matching
    const [userRows] = await db.query(
      `SELECT email, phone_number FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = userRows[0];
    const userEmail = user.email ? user.email.trim().toLowerCase() : null;
    const userPhoneNormalized = normalizePhone(user.phone_number);
    
    // Build query to match consultations by:
    // 1. user_id (primary - most reliable)
    // 2. email (case-insensitive, trimmed)
    // 3. phone (normalized - last 10 digits for mobile numbers)
    // Note: For phone matching, we fetch all consultations and filter in JavaScript
    // because MySQL doesn't have easy regex support for removing all non-digits
    let query = `
      SELECT id, name, phone, email, type, scheduled_at, status, created_at
      FROM consultations
      WHERE (
        user_id = ?
        OR (email IS NOT NULL AND LOWER(TRIM(email)) = ?)
        OR (phone IS NOT NULL AND ? IS NOT NULL)
      )
      ORDER BY created_at DESC
    `;
    
    const [allRows] = await db.query(query, [
      req.user.id,                    // user_id match
      userEmail,                      // email match
      userPhoneNormalized             // phone check (will filter in JS)
    ]);
    
    // Filter by normalized phone number in JavaScript
    // This handles phone number variations more reliably
    const rows = allRows.filter(consultation => {
      // If already matched by user_id or email, include it
      if (consultation.user_id === req.user.id) return true;
      if (consultation.email && userEmail && 
          consultation.email.trim().toLowerCase() === userEmail) return true;
      
      // Check phone match with normalization
      if (userPhoneNormalized && consultation.phone) {
        const consultationPhoneNormalized = normalizePhone(consultation.phone);
        if (consultationPhoneNormalized === userPhoneNormalized) {
          return true;
        }
      }
      
      return false;
    });

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('getMyConsultations error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch consultations' });
  }
}

export async function getMyConsultation(req, res) {
  try {
    const { id } = req.params;
    const consultationId = parseInt(id, 10);
    
    // Validate consultation ID
    if (isNaN(consultationId) || consultationId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid consultation ID' });
    }

    const db = getDb();

    // Get user's email and phone for matching
    const [userRows] = await db.query(
      `SELECT email, phone_number FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = userRows[0];
    const userEmail = user.email ? user.email.trim().toLowerCase() : null;
    const userPhoneNormalized = normalizePhone(user.phone_number);

    // Match consultation by user_id, email, or phone
    // Fetch consultation first, then verify ownership
    const [consultationRows] = await db.query(
      `SELECT id, user_id, name, phone, email, type, scheduled_at, status, created_at
       FROM consultations
       WHERE id = ?
       LIMIT 1`,
      [consultationId]
    );

    if (consultationRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Consultation not found' });
    }
    
    const consultation = consultationRows[0];
    
    // Verify ownership by user_id, email, or phone
    let isOwner = false;
    
    // Check user_id match
    if (consultation.user_id === req.user.id) {
      isOwner = true;
    }
    // Check email match (case-insensitive, trimmed)
    else if (consultation.email && userEmail && 
             consultation.email.trim().toLowerCase() === userEmail) {
      isOwner = true;
    }
    // Check phone match (normalized)
    else if (userPhoneNormalized && consultation.phone) {
      const consultationPhoneNormalized = normalizePhone(consultation.phone);
      if (consultationPhoneNormalized === userPhoneNormalized) {
        isOwner = true;
      }
    }
    
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied. This consultation does not belong to you.' });
    }
    
    // Map type to consultation_type for frontend compatibility
    consultation.consultation_type = consultation.type;

    return res.status(200).json({ success: true, data: consultation });
  } catch (err) {
    console.error('getMyConsultation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch consultation' });
  }
}

// ===== PC BUILD CONTROLLERS =====

export async function getMyPCBuilds(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      `SELECT id, user_id, total_estimated_price, configuration_data, created_at
       FROM custom_pc_builds
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Parse configuration_data and include full configuration for frontend
    const builds = rows.map(build => {
      let config = {};
      try {
        config = typeof build.configuration_data === 'string' 
          ? JSON.parse(build.configuration_data) 
          : build.configuration_data;
      } catch (e) {
        console.error('Failed to parse configuration_data:', e);
        config = {};
      }

      // Build a summary of components for display
      const componentSummary = Object.keys(config).filter(key => {
        const value = config[key];
        return value !== null && value !== undefined && 
               (typeof value === 'object' || Array.isArray(value));
      });

      return {
        id: build.id,
        user_id: build.user_id,
        total_estimated_price: build.total_estimated_price,
        total_price: build.total_estimated_price, // Alias for frontend compatibility
        configuration_data: config, // Full configuration with all components
        configuration: config, // Alias for frontend compatibility
        created_at: build.created_at,
        // Extract optional metadata fields from configuration_data if they exist
        build_name: config.build_name || config.name || `PC Build #${build.id}`,
        use_case: config.use_case || config.useCase || null,
        budget: config.budget || null,
        performance_level: config.performance_level || config.performanceLevel || null,
        status: config.status || 'saved',
        // Component summary for quick reference
        component_count: componentSummary.length,
        component_types: componentSummary,
      };
    });

    return res.status(200).json({ success: true, data: builds });
  } catch (err) {
    console.error('getMyPCBuilds error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch PC builds' });
  }
}

export async function getMyPCBuild(req, res) {
  try {
    const { id } = req.params;
    const buildId = parseInt(id, 10);
    
    // Validate build ID
    if (isNaN(buildId) || buildId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid PC build ID' });
    }

    const db = getDb();

    const [buildRows] = await db.query(
      `SELECT id, user_id, total_estimated_price, configuration_data, created_at
       FROM custom_pc_builds
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [buildId, req.user.id]
    );

    if (buildRows.length === 0) {
      return res.status(404).json({ success: false, message: 'PC build not found' });
    }

    const build = buildRows[0];
    
    // Parse configuration_data JSON
    let config = {};
    try {
      config = typeof build.configuration_data === 'string' 
        ? JSON.parse(build.configuration_data) 
        : build.configuration_data;
    } catch (e) {
      console.error('Failed to parse configuration_data:', e);
    }

    // Map fields for frontend compatibility - include full configuration_data
    // The configuration_data contains all selected components in the format:
    // { cpu: {...}, gpu: {...}, ram: [...], motherboard: {...}, etc. }
    const componentKeys = Object.keys(config).filter(key => {
      const value = config[key];
      return value !== null && value !== undefined && 
             (typeof value === 'object' || Array.isArray(value));
    });

    const response = {
      id: build.id,
      user_id: build.user_id,
      total_estimated_price: build.total_estimated_price,
      total_price: build.total_estimated_price, // Alias for frontend compatibility
      configuration_data: config, // Full configuration with all components
      configuration: config, // Alias for frontend compatibility
      created_at: build.created_at,
      // Extract optional metadata fields from configuration_data if they exist
      build_name: config.build_name || config.name || `PC Build #${build.id}`,
      use_case: config.use_case || config.useCase || null,
      budget: config.budget || null,
      performance_level: config.performance_level || config.performanceLevel || null,
      status: config.status || 'saved',
      // Component summary for quick reference
      component_count: componentKeys.length,
      component_types: componentKeys,
    };

    return res.status(200).json({ success: true, data: response });
  } catch (err) {
    console.error('getMyPCBuild error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch PC build' });
  }
}

// ===== REVIEW CONTROLLERS =====

export async function getMyReviews(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      `SELECT r.id, r.product_id, r.service_id, r.rating, r.title, r.comment,
       r.is_verified_purchase, r.is_approved, r.created_at,
       p.name as product_name, s.name as service_name
       FROM reviews r
       LEFT JOIN products p ON r.product_id = p.id
       LEFT JOIN services s ON r.service_id = s.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    // Map is_verified_purchase to is_verified for frontend compatibility
    const reviews = rows.map(review => ({
      ...review,
      is_verified: review.is_verified_purchase,
    }));

    return res.status(200).json({ success: true, data: reviews });
  } catch (err) {
    console.error('getMyReviews error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
}

// ===== SELL REQUEST CONTROLLERS =====

export async function getMySellRequests(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      `SELECT 
        sr.id,
        sr.request_type,
        sr.device_type,
        sr.brand,
        sr.model,
        sr.user_requested_price,
        sr.estimated_price,
        sr.final_offer_price,
        sr.status,
        sr.created_at
      FROM sell_requests sr
      WHERE sr.user_id = ?
      ORDER BY sr.created_at DESC`,
      [req.user.id]
    );

    const requests = rows.map(request => ({
      id: request.id,
      request_type: request.request_type,
      device_type: request.device_type,
      brand: request.brand,
      model: request.model,
      user_requested_price: request.user_requested_price ? parseFloat(request.user_requested_price) : null,
      estimated_price: request.estimated_price ? parseFloat(request.estimated_price) : null,
      final_offer_price: request.final_offer_price ? parseFloat(request.final_offer_price) : null,
      status: request.status,
      created_at: request.created_at,
    }));

    return res.status(200).json({ success: true, data: requests });
  } catch (err) {
    console.error('getMySellRequests error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sell requests' });
  }
}

export async function getMySellRequest(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const requestId = parseInt(id, 10);

    if (isNaN(requestId) || requestId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid sell request ID' });
    }

    // Get sell request with user verification
    const [requestRows] = await db.query(
      `SELECT 
        sr.id,
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
        sr.created_at
      FROM sell_requests sr
      WHERE sr.id = ? AND sr.user_id = ?`,
      [requestId, req.user.id]
    );

    if (requestRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sell request not found' });
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
      [requestId]
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
          postal_code
        FROM addresses
        WHERE id = ? AND user_id = ?`,
        [request.address_id, req.user.id]
      );

      if (addressRows.length > 0) {
        address = {
          id: addressRows[0].id,
          label: addressRows[0].label,
          line_1: addressRows[0].line_1,
          line_2: addressRows[0].line_2,
          city: addressRows[0].city,
          state: addressRows[0].state,
          postal_code: addressRows[0].postal_code,
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: request.id,
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
    console.error('getMySellRequest error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch sell request' });
  }
}

// ===== STATS CONTROLLER =====

/**
 * Get user statistics for dashboard
 * Returns totalOrders, totalSpent, activeBookings, pendingConsultations
 */
export async function getMyStats(req, res) {
  try {
    const db = getDb();
    const userId = req.user.id;

    // Execute all queries in parallel for performance
    const [
      orderStats,
      bookingStats,
      consultationStats,
    ] = await Promise.all([
      // Order statistics: total count and total spent (excluding cancelled)
      db.query(
        `SELECT 
          COUNT(*) as total_orders,
          COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_spent
        FROM orders
        WHERE user_id = ?`,
        [userId]
      ),
      // Active bookings: pending or confirmed
      db.query(
        `SELECT COUNT(*) as active_bookings
        FROM bookings
        WHERE user_id = ? AND status IN ('pending', 'confirmed')`,
        [userId]
      ),
      // Pending consultations: requested or scheduled
      db.query(
        `SELECT COUNT(*) as pending_consultations
        FROM consultations
        WHERE user_id = ? AND status IN ('requested', 'scheduled')`,
        [userId]
      ),
    ]);

    const stats = {
      totalOrders: parseInt(orderStats[0][0].total_orders) || 0,
      totalSpent: parseFloat(orderStats[0][0].total_spent) || 0,
      activeBookings: parseInt(bookingStats[0][0].active_bookings) || 0,
      pendingConsultations: parseInt(consultationStats[0][0].pending_consultations) || 0,
    };

    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error('getMyStats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
}


