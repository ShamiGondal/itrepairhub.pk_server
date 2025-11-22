import { getDb } from '../config/db.config.js';

/**
 * Create a new service booking
 * Public endpoint - supports both logged-in users and guests
 * SEO-optimized: Transaction-based flow, single-trip data aggregation
 * 
 * Flow:
 * 1. Validate service exists and get price_type
 * 2. Handle address/guest_details:
 *    - Logged-in: Use address_id or create new address
 *    - Guest: Create guest_details
 * 3. Create booking
 * 4. If price_type = 'fixed': Create payment with pending status
 */
export async function createBooking(req, res) {
  const db = getDb();
  
  // Start transaction for data integrity
  await db.query('START TRANSACTION');
  
  try {
    const {
      service_id,
      booking_date,
      booking_time,
      // For logged-in users
      address_id,
      // For new address (logged-in users)
      new_address,
      // For guest users
      guest_details,
      // Payment gateway (for fixed price services)
      payment_gateway,
      // Promo code (for fixed price services)
      coupon_code,
    } = req.body;

    // Validation: service_id, booking_date, booking_time are required
    if (!service_id || !booking_date || !booking_time) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'service_id, booking_date, and booking_time are required',
      });
    }

    // Validate booking_date and booking_time
    const bookingDateTime = new Date(`${booking_date}T${booking_time}`);
    if (isNaN(bookingDateTime.getTime())) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid booking_date or booking_time format',
      });
    }

    // Check if booking is in the future
    if (bookingDateTime <= new Date()) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Booking date and time must be in the future',
      });
    }

    // Check if user is logged in
    const isLoggedIn = !!req.user?.id;
    let userId = null;
    let guestId = null;
    let finalAddressId = null;

    // Step 1: Validate service exists and get price_type with discount
    const [serviceRows] = await db.query(
      'SELECT id, name, price_type, price, discount_percentage, is_active FROM services WHERE id = ? LIMIT 1',
      [service_id]
    );

    if (serviceRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Service not found',
      });
    }

    const service = serviceRows[0];

    if (!service.is_active) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Service is not active',
      });
    }

    // Step 2: Handle address/guest_details based on authentication
    if (isLoggedIn) {
      // Logged-in user flow
      userId = req.user.id;

      if (address_id) {
        // Validate that address belongs to user
        const [addressRows] = await db.query(
          'SELECT id FROM addresses WHERE id = ? AND user_id = ? LIMIT 1',
          [address_id, userId]
        );

        if (addressRows.length === 0) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Invalid address_id or address does not belong to user',
          });
        }

        finalAddressId = address_id;
      } else if (new_address) {
        // Create new address for logged-in user
        const { label, line_1, line_2, city, state, postal_code } = new_address;

        if (!line_1 || !city || !postal_code) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'new_address requires line_1, city, and postal_code',
          });
        }

        const [addressResult] = await db.query(
          `INSERT INTO addresses (user_id, label, line_1, line_2, city, state, postal_code) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            label?.trim() || null,
            line_1.trim(),
            line_2?.trim() || null,
            city.trim(),
            state?.trim() || null,
            postal_code.trim(),
          ]
        );

        finalAddressId = addressResult.insertId;
      }
      // If neither address_id nor new_address provided, finalAddressId remains null
    } else {
      // Guest user flow - create guest_details
      if (!guest_details) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'guest_details is required for guest bookings',
        });
      }

      const { full_name, email, phone_number, address_line_1, address_line_2, city, state, postal_code } = guest_details;

      if (!full_name || !email || !phone_number) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'guest_details requires full_name, email, and phone_number',
        });
      }

      const [guestResult] = await db.query(
        `INSERT INTO guest_details (full_name, email, phone_number, address_line_1, address_line_2, city, state, postal_code) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          full_name.trim(),
          email.trim(),
          phone_number.trim(),
          address_line_1?.trim() || null,
          address_line_2?.trim() || null,
          city?.trim() || null,
          state?.trim() || null,
          postal_code?.trim() || null,
        ]
      );

      guestId = guestResult.insertId;
    }

    // Step 3: Calculate pricing (only for fixed price services)
    let quotedAmount = null;
    let discountAmount = 0.00;
    let totalAmount = null;
    let finalCouponCode = null;
    let promoCodeId = null;

    if (service.price_type === 'fixed' && service.price) {
      // Calculate quoted_amount (service price after line-item discount)
      const originalPrice = parseFloat(service.price) || 0;
      const lineItemDiscountPercentage = parseFloat(service.discount_percentage) || 0;
      quotedAmount = lineItemDiscountPercentage > 0
        ? originalPrice * (1 - lineItemDiscountPercentage / 100)
        : originalPrice;
      quotedAmount = parseFloat(quotedAmount.toFixed(2));

      // Validate and apply promo code if provided
      if (coupon_code) {
        const [promoRows] = await db.query(
          `SELECT 
            id, code, discount_type, discount_value, min_order_amount, 
            usage_limit, used_count, expires_at, is_active
          FROM promo_codes 
          WHERE code = ? AND is_active = 1
          LIMIT 1`,
          [coupon_code.toUpperCase().trim()]
        );

        if (promoRows.length === 0) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Invalid or inactive promo code',
          });
        }

        const promoCode = promoRows[0];

        // Check if expired
        if (promoCode.expires_at) {
          const expiresAt = new Date(promoCode.expires_at);
          if (expiresAt < new Date()) {
            await db.query('ROLLBACK');
            return res.status(400).json({
              success: false,
              message: 'Promo code has expired',
            });
          }
        }

        // Check usage limit
        if (promoCode.usage_limit !== null && promoCode.used_count >= promoCode.usage_limit) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Promo code usage limit reached',
          });
        }

        // Check minimum order amount
        if (quotedAmount < promoCode.min_order_amount) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Minimum order amount of ${promoCode.min_order_amount} required`,
            min_order_amount: promoCode.min_order_amount,
          });
        }

        // Calculate discount amount
        if (promoCode.discount_type === 'percentage') {
          discountAmount = quotedAmount * (promoCode.discount_value / 100);
        } else {
          discountAmount = promoCode.discount_value;
        }
        // Ensure discount doesn't exceed quoted amount
        discountAmount = Math.min(discountAmount, quotedAmount);
        discountAmount = parseFloat(discountAmount.toFixed(2));

        finalCouponCode = promoCode.code;
        promoCodeId = promoCode.id;
      }

      // Calculate total amount
      totalAmount = quotedAmount - discountAmount;
      totalAmount = parseFloat(totalAmount.toFixed(2));
    }

    // Step 4: Create booking with pricing information
    const [bookingResult] = await db.query(
      `INSERT INTO bookings (
        user_id, guest_id, service_id, address_id, booking_date, booking_time, 
        quoted_amount, discount_amount, total_amount, coupon_code, status
      ) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        guestId,
        service_id,
        finalAddressId,
        booking_date,
        booking_time,
        quotedAmount,
        discountAmount,
        totalAmount,
        finalCouponCode,
        'pending',
      ]
    );

    const bookingId = bookingResult.insertId;

    // Step 5: Increment promo code used_count if applied
    if (promoCodeId) {
      await db.query(
        'UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?',
        [promoCodeId]
      );
    }

    // Step 6: Create payment if price_type is 'fixed'
    let payment = null;
    if (service.price_type === 'fixed' && totalAmount !== null) {
      // Use provided gateway or default to 'local_gateway'
      const gateway = payment_gateway || 'local_gateway';
      
      // Validate gateway
      if (!['local_gateway', 'cash', 'stripe'].includes(gateway)) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Invalid payment gateway',
        });
      }

      const [paymentResult] = await db.query(
        `INSERT INTO payments (user_id, guest_id, booking_id, amount, gateway, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userId,
          guestId,
          bookingId,
          totalAmount, // Use total_amount (after all discounts)
          gateway,
          'pending',
        ]
      );

      // Fetch created payment
      const [paymentRows] = await db.query(
        'SELECT id, user_id, guest_id, booking_id, amount, gateway, transaction_id, status, created_at FROM payments WHERE id = ? LIMIT 1',
        [paymentResult.insertId]
      );

      payment = paymentRows[0];
    }

    // Commit transaction
    await db.query('COMMIT');

    // Fetch created booking with service details
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
        s.name as service_name,
        s.price_type,
        s.price as service_price
       FROM bookings b
       INNER JOIN services s ON b.service_id = s.id
       WHERE b.id = ? LIMIT 1`,
      [bookingId]
    );

    return res.status(201).json({
      success: true,
      data: {
        booking: bookingRows[0],
        payment: payment,
      },
      message: 'Booking created successfully',
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Booking creation error:', err);
    
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Invalid foreign key reference',
      });
    }
    
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({
        success: false,
        message: 'Booking must have either user_id or guest_id',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Get all bookings for the authenticated user
 * SEO-optimized: Single SELECT query with JOIN for service details
 */
export async function getMyBookings(req, res) {
  try {
    const db = getDb();
    
    const [rows] = await db.query(
      `SELECT 
        b.id, 
        b.user_id, 
        b.guest_id, 
        b.service_id, 
        b.address_id, 
        b.technician_id, 
        b.booking_date, 
        b.booking_time, 
        b.status, 
        b.admin_notes, 
        b.created_at,
        s.name as service_name,
        s.price_type,
        s.price as service_price,
        s.slug as service_slug
       FROM bookings b
       INNER JOIN services s ON b.service_id = s.id
       WHERE b.user_id = ?
       ORDER BY b.booking_date DESC, b.booking_time DESC, b.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error('Get bookings error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
    });
  }
}

/**
 * Get a single booking by ID
 * Users can only view their own bookings, admins can view any
 * SEO-optimized: Single SELECT query with JOIN and permission check
 */
export async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Single query to fetch booking with service details
    const [rows] = await db.query(
      `SELECT 
        b.id, 
        b.user_id, 
        b.guest_id, 
        b.service_id, 
        b.address_id, 
        b.technician_id, 
        b.booking_date, 
        b.booking_time, 
        b.status, 
        b.admin_notes, 
        b.created_at,
        s.name as service_name,
        s.price_type,
        s.price as service_price,
        s.slug as service_slug
       FROM bookings b
       INNER JOIN services s ON b.service_id = s.id
       WHERE b.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    const booking = rows[0];

    // Permission check: user can only view their own, admin can view any
    if (req.user.role !== 'admin' && booking.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Fetch payment if exists (for fixed price services)
    let payment = null;
    if (booking.price_type === 'fixed') {
      const [paymentRows] = await db.query(
        'SELECT id, user_id, guest_id, booking_id, amount, gateway, transaction_id, status, created_at FROM payments WHERE booking_id = ? LIMIT 1',
        [id]
      );
      if (paymentRows.length > 0) {
        payment = paymentRows[0];
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        booking: booking,
        payment: payment,
      },
    });
  } catch (err) {
    console.error('Get booking error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
    });
  }
}

/**
 * Get user's saved addresses
 * SEO-optimized: Single SELECT query
 */
export async function getMyAddresses(req, res) {
  try {
    const db = getDb();
    
    const [rows] = await db.query(
      'SELECT id, label, line_1, line_2, city, state, postal_code, created_at FROM addresses WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error('Get addresses error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch addresses',
    });
  }
}

