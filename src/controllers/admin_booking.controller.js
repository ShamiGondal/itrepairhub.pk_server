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
 * Get all technicians (users with technician or admin role)
 * Admin only - for technician assignment dropdown
 */
export async function getTechnicians(req, res) {
  try {
    const db = getDb();
    
    const [rows] = await db.query(
      `SELECT id, full_name, email, phone_number, role 
       FROM users 
       WHERE role IN ('technician', 'admin')
       ORDER BY full_name ASC`
    );

    return res.status(200).json({
      success: true,
      data: rows.map(tech => ({
        id: tech.id,
        name: tech.full_name,
        email: tech.email,
        phone: tech.phone_number,
        role: tech.role,
      })),
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch technicians');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get all bookings with filtering, pagination, and search
 * Admin only - requires authentication
 * Supports filtering by status, date range, customer, service, technician
 */
export async function getAllBookings(req, res) {
  try {
    const db = getDb();
    const {
      status,
      start_date,
      end_date,
      customer_email,
      customer_name,
      service_id,
      technician_id,
      booking_id,
      page = 1,
      limit = 50,
      sort = 'booking_date',
      order = 'DESC',
    } = req.query;

    // Build WHERE clause
    const whereConditions = [];
    const queryParams = [];

    if (status) {
      whereConditions.push('b.status = ?');
      queryParams.push(status);
    }

    if (start_date) {
      whereConditions.push('DATE(b.booking_date) >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('DATE(b.booking_date) <= ?');
      queryParams.push(end_date);
    }

    if (booking_id) {
      whereConditions.push('b.id = ?');
      queryParams.push(parseInt(booking_id));
    }

    if (service_id) {
      whereConditions.push('b.service_id = ?');
      queryParams.push(parseInt(service_id));
    }

    if (technician_id) {
      whereConditions.push('b.technician_id = ?');
      queryParams.push(parseInt(technician_id));
    }

    if (customer_email) {
      whereConditions.push('(u.email LIKE ? OR gd.email LIKE ?)');
      const emailPattern = `%${customer_email}%`;
      queryParams.push(emailPattern, emailPattern);
    }

    if (customer_name) {
      whereConditions.push('(u.full_name LIKE ? OR gd.full_name LIKE ?)');
      const namePattern = `%${customer_name}%`;
      queryParams.push(namePattern, namePattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort and order
    const allowedSortFields = ['created_at', 'booking_date', 'booking_time', 'total_amount', 'id', 'status'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'booking_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get bookings with customer and service info
    const [bookingRows] = await db.query(
      `SELECT 
        b.id,
        b.user_id,
        b.guest_id,
        b.service_id,
        b.address_id,
        b.technician_id,
        b.quoted_amount,
        b.discount_amount,
        b.total_amount,
        b.coupon_code,
        b.booking_date,
        b.booking_time,
        b.status,
        b.admin_notes,
        b.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone,
        gd.full_name as guest_name,
        gd.email as guest_email,
        gd.phone_number as guest_phone,
        s.name as service_name,
        s.price_type as service_price_type,
        s.price as service_price,
        s.slug as service_slug,
        t.full_name as technician_name,
        t.email as technician_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN guest_details gd ON b.guest_id = gd.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN users t ON b.technician_id = t.id
      ${whereClause}
      ORDER BY b.${sortField} ${sortOrder}, b.booking_time ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN guest_details gd ON b.guest_id = gd.id
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Format bookings with customer info
    const bookings = bookingRows.map(booking => ({
      id: booking.id,
      customer: {
        type: booking.user_id ? 'registered' : 'guest',
        name: booking.user_name || booking.guest_name || 'Unknown',
        email: booking.user_email || booking.guest_email || null,
        phone: booking.user_phone || booking.guest_phone || null,
      },
      service: {
        id: booking.service_id,
        name: booking.service_name,
        slug: booking.service_slug,
        price_type: booking.service_price_type,
        price: booking.service_price ? parseFloat(booking.service_price) : null,
      },
      technician: booking.technician_id ? {
        id: booking.technician_id,
        name: booking.technician_name,
        email: booking.technician_email,
      } : null,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      totals: {
        quoted_amount: booking.quoted_amount ? parseFloat(booking.quoted_amount) : null,
        discount_amount: booking.discount_amount ? parseFloat(booking.discount_amount) : 0,
        total_amount: booking.total_amount ? parseFloat(booking.total_amount) : null,
      },
      coupon_code: booking.coupon_code,
      status: booking.status,
      admin_notes: booking.admin_notes,
      created_at: booking.created_at,
    }));

    return res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch bookings');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get booking by ID with full details
 * Admin only - includes all booking info, customer, service, payment, address, technician
 */
export async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Get booking with customer, service, technician, and address info
    const [bookingRows] = await db.query(
      `SELECT 
        b.*,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone,
        gd.full_name as guest_name,
        gd.email as guest_email,
        gd.phone_number as guest_phone,
        gd.address_line_1 as guest_address_line_1,
        gd.address_line_2 as guest_address_line_2,
        gd.city as guest_city,
        gd.state as guest_state,
        gd.postal_code as guest_postal_code,
        a.label as address_label,
        a.line_1 as address_line_1,
        a.line_2 as address_line_2,
        a.city as address_city,
        a.state as address_state,
        a.postal_code as address_postal_code,
        s.name as service_name,
        s.slug as service_slug,
        s.price_type as service_price_type,
        s.price as service_price,
        s.short_description as service_description,
        sc.name as service_category_name,
        sc.slug as service_category_slug,
        t.full_name as technician_name,
        t.email as technician_email,
        t.phone_number as technician_phone
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN guest_details gd ON b.guest_id = gd.id
      LEFT JOIN addresses a ON b.address_id = a.id
      LEFT JOIN services s ON b.service_id = s.id
      LEFT JOIN service_categories sc ON s.category_id = sc.id
      LEFT JOIN users t ON b.technician_id = t.id
      WHERE b.id = ?
      LIMIT 1`,
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    const booking = bookingRows[0];

    // Get service images
    let serviceImages = [];
    if (booking.service_id) {
      const [imageRows] = await db.query(
        `SELECT id, image_url, alt_text, display_order 
         FROM service_images 
         WHERE service_id = ? 
         ORDER BY display_order ASC`,
        [booking.service_id]
      );
      serviceImages = imageRows.map(img => ({
        id: img.id,
        image_url: img.image_url,
        alt_text: img.alt_text,
        display_order: img.display_order,
      }));
    }

    // Get payment info (for fixed price services)
    let payment = null;
    if (booking.service_price_type === 'fixed') {
      const [paymentRows] = await db.query(
        `SELECT 
          id,
          user_id,
          guest_id,
          booking_id,
          amount,
          gateway,
          transaction_id,
          status,
          created_at
        FROM payments 
        WHERE booking_id = ?
        ORDER BY created_at DESC`,
        [id]
      );

      if (paymentRows.length > 0) {
        payment = {
          id: paymentRows[0].id,
          amount: parseFloat(paymentRows[0].amount),
          gateway: paymentRows[0].gateway,
          transaction_id: paymentRows[0].transaction_id,
          status: paymentRows[0].status,
          created_at: paymentRows[0].created_at,
        };
      }
    }

    // Format booking response
    const bookingData = {
      id: booking.id,
      customer: {
        type: booking.user_id ? 'registered' : 'guest',
        user_id: booking.user_id,
        guest_id: booking.guest_id,
        name: booking.user_name || booking.guest_name || 'Unknown',
        email: booking.user_email || booking.guest_email || null,
        phone: booking.user_phone || booking.guest_phone || null,
      },
      service: {
        id: booking.service_id,
        name: booking.service_name,
        slug: booking.service_slug,
        price_type: booking.service_price_type,
        price: booking.service_price ? parseFloat(booking.service_price) : null,
        description: booking.service_description,
        category: booking.service_category_name ? {
          name: booking.service_category_name,
          slug: booking.service_category_slug,
        } : null,
        images: serviceImages,
      },
      technician: booking.technician_id ? {
        id: booking.technician_id,
        name: booking.technician_name,
        email: booking.technician_email,
        phone: booking.technician_phone,
      } : null,
      address: booking.address_id ? {
        id: booking.address_id,
        label: booking.address_label,
        line_1: booking.address_line_1,
        line_2: booking.address_line_2,
        city: booking.address_city,
        state: booking.address_state,
        postal_code: booking.address_postal_code,
      } : (booking.guest_address_line_1 ? {
        line_1: booking.guest_address_line_1,
        line_2: booking.guest_address_line_2,
        city: booking.guest_city,
        state: booking.guest_state,
        postal_code: booking.guest_postal_code,
      } : null),
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      totals: {
        quoted_amount: booking.quoted_amount ? parseFloat(booking.quoted_amount) : null,
        discount_amount: booking.discount_amount ? parseFloat(booking.discount_amount) : 0,
        total_amount: booking.total_amount ? parseFloat(booking.total_amount) : null,
      },
      coupon_code: booking.coupon_code,
      status: booking.status,
      admin_notes: booking.admin_notes,
      payment: payment,
      created_at: booking.created_at,
    };

    return res.status(200).json({
      success: true,
      data: bookingData,
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch booking');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update booking status
 * Admin only - validates status transitions
 */
export async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const db = getDb();

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Check if booking exists
    const [bookingRows] = await db.query(
      'SELECT id, status, service_id FROM bookings WHERE id = ? LIMIT 1',
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    const currentBooking = bookingRows[0];

    // Validate status transition
    const currentStatus = currentBooking.status;
    
    // Business logic: Can't change status if already cancelled or completed
    if (currentStatus === 'cancelled' && status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status of a cancelled booking',
      });
    }

    if (currentStatus === 'completed' && status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status of a completed booking',
      });
    }

    // Update booking status
    await db.query(
      'UPDATE bookings SET status = ? WHERE id = ?',
      [status, id]
    );

    // If cancelling, handle payment refund
    if (status === 'cancelled' && currentStatus !== 'cancelled') {
      // Check if payment exists and was paid
      const [paymentRows] = await db.query(
        'SELECT id, status FROM payments WHERE booking_id = ? LIMIT 1',
        [id]
      );

      if (paymentRows.length > 0 && paymentRows[0].status === 'succeeded') {
        // Map 'refunded' status - same for both tables
        await db.query(
          'UPDATE payments SET status = ? WHERE booking_id = ?',
          ['refunded', id]
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
      data: {
        booking_id: id,
        old_status: currentStatus,
        new_status: status,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update booking status');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update payment status (for fixed price services)
 * Admin only - for manual payment recording
 */
export async function updatePaymentStatus(req, res) {
  try {
    const { id } = req.params;
    const { payment_status, transaction_id, gateway } = req.body;
    const db = getDb();

    // Validate payment status
    // Accept both order payment_status values ('unpaid', 'paid', 'refunded') 
    // and payment status values ('pending', 'succeeded', 'failed', 'refunded')
    const validOrderStatuses = ['unpaid', 'paid', 'refunded'];
    const validPaymentStatuses = ['pending', 'succeeded', 'failed', 'refunded'];
    const allValidStatuses = [...validOrderStatuses, ...validPaymentStatuses];
    
    if (!payment_status || !allValidStatuses.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validOrderStatuses.join(', ')} or ${validPaymentStatuses.join(', ')}`,
      });
    }

    // Check if booking exists and has fixed price service
    const [bookingRows] = await db.query(
      `SELECT b.id, b.service_id, s.price_type, b.total_amount 
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    const booking = bookingRows[0];

    if (booking.price_type !== 'fixed') {
      return res.status(400).json({
        success: false,
        message: 'Payment status can only be updated for fixed price services',
      });
    }

    // Map payment status to payments.status enum
    // Accept both order payment_status values and payment status values
    // orders.payment_status: 'unpaid', 'paid', 'refunded'
    // payments.status: 'pending', 'succeeded', 'failed', 'refunded'
    const paymentStatusMap = {
      'unpaid': 'pending',
      'paid': 'succeeded',
      'refunded': 'refunded',
      'pending': 'pending',
      'succeeded': 'succeeded',
      'failed': 'failed',
    };
    const mappedPaymentStatus = paymentStatusMap[payment_status] || payment_status;

    // Update or create payment record
    const [paymentRows] = await db.query(
      'SELECT id FROM payments WHERE booking_id = ? LIMIT 1',
      [id]
    );

    if (paymentRows.length > 0) {
      // Update existing payment
      const updateFields = ['status = ?'];
      const updateParams = [mappedPaymentStatus];

      if (transaction_id) {
        updateFields.push('transaction_id = ?');
        updateParams.push(transaction_id);
      }

      if (gateway) {
        // Validate gateway enum
        const validGateways = ['stripe', 'local_gateway', 'cash'];
        if (validGateways.includes(gateway)) {
          updateFields.push('gateway = ?');
          updateParams.push(gateway);
        }
      }

      updateParams.push(paymentRows[0].id);

      try {
        await db.query(
          `UPDATE payments SET ${updateFields.join(', ')} WHERE id = ?`,
          updateParams
        );
      } catch (dbErr) {
        console.error('Payment update error:', dbErr);
        if (dbErr.code === 'WARN_DATA_TRUNCATED' || dbErr.errno === 1265) {
          return res.status(400).json({
            success: false,
            message: `Invalid data for payment update. Status: ${mappedPaymentStatus}, Gateway: ${gateway || 'not provided'}`,
          });
        }
        throw dbErr;
      }
    } else {
      // Create new payment record
      const [bookingData] = await db.query(
        'SELECT user_id, guest_id, total_amount FROM bookings WHERE id = ? LIMIT 1',
        [id]
      );

      if (bookingData.length > 0 && bookingData[0].total_amount) {
        // Validate gateway
        const validGateways = ['stripe', 'local_gateway', 'cash'];
        const finalGateway = gateway && validGateways.includes(gateway) ? gateway : 'local_gateway';

        try {
          await db.query(
            `INSERT INTO payments (user_id, guest_id, booking_id, amount, gateway, transaction_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              bookingData[0].user_id,
              bookingData[0].guest_id,
              id,
              bookingData[0].total_amount,
              finalGateway,
              transaction_id || null,
              mappedPaymentStatus,
            ]
          );
        } catch (dbErr) {
          console.error('Payment insert error:', dbErr);
          if (dbErr.code === 'WARN_DATA_TRUNCATED' || dbErr.errno === 1265) {
            return res.status(400).json({
              success: false,
              message: `Invalid data for payment creation. Status: ${mappedPaymentStatus}, Gateway: ${finalGateway}`,
            });
          }
          throw dbErr;
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment status updated successfully',
      data: {
        booking_id: id,
        payment_status,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update payment status');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Assign technician to booking
 * Admin only
 */
export async function assignTechnician(req, res) {
  try {
    const { id } = req.params;
    const { technician_id } = req.body;
    const db = getDb();

    // Check if booking exists
    const [bookingRows] = await db.query(
      'SELECT id FROM bookings WHERE id = ? LIMIT 1',
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // If technician_id provided, validate it exists and has technician role
    if (technician_id) {
      const [techRows] = await db.query(
        'SELECT id, full_name, role FROM users WHERE id = ? AND role IN (?, ?) LIMIT 1',
        [technician_id, 'technician', 'admin']
      );

      if (techRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid technician_id or user is not a technician',
        });
      }
    }

    // Update booking technician
    await db.query(
      'UPDATE bookings SET technician_id = ? WHERE id = ?',
      [technician_id || null, id]
    );

    return res.status(200).json({
      success: true,
      message: technician_id ? 'Technician assigned successfully' : 'Technician unassigned successfully',
      data: {
        booking_id: id,
        technician_id: technician_id || null,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to assign technician');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update booking date and time
 * Admin only
 */
export async function updateBookingDateTime(req, res) {
  try {
    const { id } = req.params;
    const { booking_date, booking_time } = req.body;
    const db = getDb();

    // Validate both date and time are provided
    if (!booking_date || !booking_time) {
      return res.status(400).json({
        success: false,
        message: 'booking_date and booking_time are required',
      });
    }

    // Validate date and time format
    const bookingDateTime = new Date(`${booking_date}T${booking_time}`);
    if (isNaN(bookingDateTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking_date or booking_time format',
      });
    }

    // Check if booking exists
    const [bookingRows] = await db.query(
      'SELECT id, status FROM bookings WHERE id = ? LIMIT 1',
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Can't update date/time for cancelled or completed bookings
    if (bookingRows[0].status === 'cancelled' || bookingRows[0].status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update date/time for cancelled or completed bookings',
      });
    }

    // Update booking date and time
    await db.query(
      'UPDATE bookings SET booking_date = ?, booking_time = ? WHERE id = ?',
      [booking_date, booking_time, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Booking date and time updated successfully',
      data: {
        booking_id: id,
        booking_date,
        booking_time,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update booking date and time');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update quoted amount (for variable price services)
 * Admin only - recalculates total_amount if discount exists
 */
export async function updateQuotedAmount(req, res) {
  try {
    const { id } = req.params;
    const { quoted_amount } = req.body;
    const db = getDb();

    // Validate quoted_amount
    if (quoted_amount === undefined || quoted_amount === null) {
      return res.status(400).json({
        success: false,
        message: 'quoted_amount is required',
      });
    }

    const quotedAmount = parseFloat(quoted_amount);
    if (isNaN(quotedAmount) || quotedAmount < 0) {
      return res.status(400).json({
        success: false,
        message: 'quoted_amount must be a valid positive number',
      });
    }

    // Check if booking exists and has variable price service
    const [bookingRows] = await db.query(
      `SELECT b.id, b.discount_amount, b.coupon_code, s.price_type 
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    const booking = bookingRows[0];

    if (booking.price_type !== 'variable') {
      return res.status(400).json({
        success: false,
        message: 'Quoted amount can only be updated for variable price services',
      });
    }

    // Recalculate total_amount based on discount
    const discountAmount = parseFloat(booking.discount_amount) || 0;
    const totalAmount = quotedAmount - discountAmount;
    const finalTotalAmount = Math.max(0, parseFloat(totalAmount.toFixed(2)));

    // Update booking
    await db.query(
      'UPDATE bookings SET quoted_amount = ?, total_amount = ? WHERE id = ?',
      [quotedAmount, finalTotalAmount, id]
    );

    // If payment exists, update payment amount
    const [paymentRows] = await db.query(
      'SELECT id FROM payments WHERE booking_id = ? LIMIT 1',
      [id]
    );

    if (paymentRows.length > 0) {
      await db.query(
        'UPDATE payments SET amount = ? WHERE booking_id = ?',
        [finalTotalAmount, id]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Quoted amount updated successfully',
      data: {
        booking_id: id,
        quoted_amount: quotedAmount,
        discount_amount: discountAmount,
        total_amount: finalTotalAmount,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update quoted amount');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Cancel booking
 * Admin only - cancels booking, handles refunds
 */
export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const db = getDb();

    // Check if booking exists
    const [bookingRows] = await db.query(
      'SELECT id, status FROM bookings WHERE id = ? LIMIT 1',
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    const booking = bookingRows[0];

    // Can't cancel already cancelled or completed bookings
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled',
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed booking',
      });
    }

    await db.query('START TRANSACTION');

    try {
      // Update booking status
      await db.query(
        'UPDATE bookings SET status = ? WHERE id = ?',
        ['cancelled', id]
      );

      // Handle payment refund if payment was made
      const [paymentRows] = await db.query(
        'SELECT id, status FROM payments WHERE booking_id = ? LIMIT 1',
        [id]
      );

      if (paymentRows.length > 0 && paymentRows[0].status === 'succeeded') {
        await db.query(
          'UPDATE payments SET status = ? WHERE booking_id = ?',
          ['refunded', id]
        );
      }

      await db.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully',
        data: {
          booking_id: id,
          reason: reason || null,
        },
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to cancel booking');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Add admin note to booking
 * Admin only - for internal notes
 */
export async function addAdminNote(req, res) {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const db = getDb();

    if (!note || !note.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Note is required',
      });
    }

    // Check if booking exists
    const [bookingRows] = await db.query(
      'SELECT id, admin_notes FROM bookings WHERE id = ? LIMIT 1',
      [id]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Append note to existing admin_notes
    const existingNotes = bookingRows[0].admin_notes || '';
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${note.trim()}`;
    const updatedNotes = existingNotes 
      ? `${existingNotes}\n${newNote}`
      : newNote;

    await db.query(
      'UPDATE bookings SET admin_notes = ? WHERE id = ?',
      [updatedNotes, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Note added successfully',
      data: {
        booking_id: id,
        note: newNote,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to add note');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

