import { getDb } from '../config/db.config.js';

/**
 * Create order from cart
 * Public endpoint - supports both logged-in users and guests
 * SEO-optimized: Transaction-based flow, single-trip data aggregation, <200ms response target
 * 
 * Flow:
 * 1. Validate cart exists and has items
 * 2. Validate all products are still available and in stock
 * 3. Recalculate totals (prices may have changed)
 * 4. Handle address/guest_details:
 *    - Logged-in: Use address_id or create new address
 *    - Guest: Create guest_details
 * 5. Create order
 * 6. Create order_items from cart_items
 * 7. Create payment record (status: 'pending')
 * 8. Clear cart (mark as completed)
 */
export async function createOrder(req, res) {
  const db = getDb();
  
  // Start transaction for data integrity
  await db.query('START TRANSACTION');
  
  try {
    const {
      // For logged-in users
      address_id,
      // For new address (logged-in users)
      new_address,
      // For guest users
      guest_details,
      // Payment gateway
      payment_gateway,
    } = req.body;

    // Determine cart owner
    const userId = req.user?.id || null;
    const guestId = req.body?.guest_id || null;
    // Check both lowercase and original case for session_id header
    const sessionId = req.headers['x-session-id'] || req.headers['X-Session-Id'] || req.cookies?.session_id || null;
    
    if (!userId && !guestId && !sessionId) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'User, guest_id, or session_id is required',
      });
    }

    // Step 1: Get cart with items (most recent active cart)
    let cartQuery = '';
    let cartParams = [];
    
    if (userId) {
      cartQuery = 'SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1';
      cartParams = [userId];
    } else if (guestId) {
      cartQuery = 'SELECT * FROM carts WHERE guest_id = ? ORDER BY updated_at DESC LIMIT 1';
      cartParams = [guestId];
    } else {
      cartQuery = 'SELECT * FROM carts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1';
      cartParams = [sessionId];
    }

    const [cartRows] = await db.query(cartQuery, cartParams);

    if (cartRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Cart not found or already converted to order',
      });
    }

    const cart = cartRows[0];

    // Get cart items (products and custom PC builds, exclude services)
    const [cartItemsRows] = await db.query(
      `SELECT 
        ci.*,
        p.name as product_name,
        p.stock_quantity as current_stock,
        p.is_active as product_is_active,
        p.price as current_price,
        p.discount_percentage as current_discount_percentage,
        cpb.id as custom_build_exists,
        cpb.total_estimated_price as custom_build_price
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      LEFT JOIN custom_pc_builds cpb ON ci.custom_build_id = cpb.id
      WHERE ci.cart_id = ? AND (ci.product_id IS NOT NULL OR ci.custom_build_id IS NOT NULL)`,
      [cart.id]
    );

    if (cartItemsRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Cart is empty',
      });
    }

    // Step 2: Validate all products are still available and in stock (skip validation for custom builds)
    for (const item of cartItemsRows) {
      if (item.product_id) {
        // Validate product items
        if (!item.product_is_active) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Product "${item.product_name}" is no longer available`,
          });
        }

        if (item.current_stock < item.quantity) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${item.product_name}". Only ${item.current_stock} available, but ${item.quantity} requested.`,
          });
        }
      } else if (item.custom_build_id) {
        // Validate custom build exists
        if (!item.custom_build_exists) {
          await db.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: 'Custom PC build no longer exists',
          });
        }
      }
    }

    // Step 3: Recalculate totals (use current prices, but honor cart snapshots for line-item discounts)
    let recalculatedSubtotal = 0;
    const orderItemsData = [];

    for (const item of cartItemsRows) {
      let itemPriceAtPurchase = 0;
      
      if (item.custom_build_id) {
        // Custom PC Build item - use discounted_price directly (already calculated)
        itemPriceAtPurchase = parseFloat(item.discounted_price) || 0;
      } else {
        // Product item - use price snapshot from cart (price_at_added) but apply current discount if different
        const itemPrice = parseFloat(item.price_at_added) || 0;
        const itemDiscountPercentage = parseFloat(item.discount_percentage) || 0;
        itemPriceAtPurchase = itemDiscountPercentage > 0
          ? itemPrice * (1 - itemDiscountPercentage / 100)
          : itemPrice;
      }
      
      const itemTotal = itemPriceAtPurchase * item.quantity;
      recalculatedSubtotal += itemTotal;

      if (item.custom_build_id) {
        // Custom PC Build item
        orderItemsData.push({
          custom_build_id: item.custom_build_id,
          quantity: item.quantity,
          price_at_purchase: parseFloat(itemPriceAtPurchase.toFixed(2)),
        });
      } else {
        // Product item
        orderItemsData.push({
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_purchase: parseFloat(itemPriceAtPurchase.toFixed(2)),
        });
      }
    }

    recalculatedSubtotal = parseFloat(recalculatedSubtotal.toFixed(2));

    // Use cart's stored discount_amount and total_amount (already calculated when promo code was applied)
    // This ensures the order uses the exact discount the user saw when applying the promo code
    let finalDiscountAmount = parseFloat(cart.discount_amount) || 0.00;
    let finalCouponCode = cart.coupon_code;
    
    // Re-validate promo code to ensure it's still valid at checkout time
    if (cart.coupon_code) {
      const [promoRows] = await db.query(
        `SELECT 
          id, code, discount_type, discount_value, min_order_amount, 
          usage_limit, used_count, expires_at, is_active
        FROM promo_codes 
        WHERE code = ? AND is_active = 1
        LIMIT 1`,
        [cart.coupon_code]
      );

      if (promoRows.length > 0) {
        const promoCode = promoRows[0];
        let isValid = true;

        // Check if expired
        if (promoCode.expires_at) {
          const expiresAt = new Date(promoCode.expires_at);
          if (expiresAt < new Date()) {
            isValid = false;
          }
        }

        // Check usage limit
        if (isValid && promoCode.usage_limit !== null && promoCode.used_count >= promoCode.usage_limit) {
          isValid = false;
        }

        // Check minimum order amount (use recalculated subtotal)
        if (isValid && recalculatedSubtotal < promoCode.min_order_amount) {
          isValid = false;
        }

        // If promo code is invalid, clear discount
        if (!isValid) {
          finalDiscountAmount = 0.00;
          finalCouponCode = null;
        } else {
          // Promo code is valid - use cart's stored discount_amount
          // The cart's discount_amount was calculated when promo code was applied
          // We use it directly to maintain consistency with what user saw
          const originalSubtotal = parseFloat(cart.subtotal) || 0.00;
          
          // Only recalculate if subtotal changed significantly (e.g., quantity changed)
          if (originalSubtotal > 0 && Math.abs(recalculatedSubtotal - originalSubtotal) > 0.01) {
            // Subtotal changed - recalculate discount using same promo code logic
            if (promoCode.discount_type === 'percentage') {
              // Percentage discount: recalculate based on new subtotal
              finalDiscountAmount = recalculatedSubtotal * (promoCode.discount_value / 100);
            } else {
              // Fixed amount discount: keep same amount (capped at new subtotal)
              finalDiscountAmount = Math.min(promoCode.discount_value, recalculatedSubtotal);
            }
            finalDiscountAmount = parseFloat(finalDiscountAmount.toFixed(2));
          }
          // If subtotal unchanged, use cart's stored discount_amount (already set above)
        }
      } else {
        // Promo code not found - clear discount
        finalDiscountAmount = 0.00;
        finalCouponCode = null;
      }
    } else {
      // No promo code - no discount
      finalDiscountAmount = 0.00;
      finalCouponCode = null;
    }

    const finalTotalAmount = recalculatedSubtotal - finalDiscountAmount;
    const finalTotalAmountRounded = parseFloat(finalTotalAmount.toFixed(2));

    // Step 4: Handle address/guest_details based on authentication
    const isLoggedIn = !!userId;
    let finalUserId = userId;
    let finalGuestId = guestId;
    let finalAddressId = null;

    if (isLoggedIn) {
      // Logged-in user flow
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
      } else {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'address_id or new_address is required for logged-in users',
        });
      }
    } else {
      // Guest user flow - create guest_details
      if (!guest_details) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'guest_details is required for guest orders',
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

      finalGuestId = guestResult.insertId;
    }

    // Step 5: Create order
    const [orderResult] = await db.query(
      `INSERT INTO orders (
        user_id, guest_id, address_id, subtotal, discount_amount, total_amount, coupon_code, order_status, payment_status
      ) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalUserId,
        finalGuestId,
        finalAddressId,
        recalculatedSubtotal,
        finalDiscountAmount,
        finalTotalAmountRounded,
        finalCouponCode,
        'pending',
        'unpaid',
      ]
    );

    const orderId = orderResult.insertId;

    // Step 6: Create order_items from cart_items
    for (const itemData of orderItemsData) {
      if (itemData.custom_build_id) {
        // Custom PC Build item
        await db.query(
          `INSERT INTO order_items (order_id, custom_build_id, quantity, price_at_purchase) 
           VALUES (?, ?, ?, ?)`,
          [orderId, itemData.custom_build_id, itemData.quantity, itemData.price_at_purchase]
        );
      } else if (itemData.product_id) {
        // Product item
        await db.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) 
           VALUES (?, ?, ?, ?)`,
          [orderId, itemData.product_id, itemData.quantity, itemData.price_at_purchase]
        );

        // Update product stock
        await db.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [itemData.quantity, itemData.product_id]
        );
      }
      // Note: Service items don't need stock updates
    }

    // Step 7: Create payment record
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
      `INSERT INTO payments (user_id, guest_id, order_id, amount, gateway, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        finalUserId,
        finalGuestId,
        orderId,
        finalTotalAmountRounded,
        gateway,
        'pending',
      ]
    );

    // Step 8: Increment promo code used_count if applied
    if (finalCouponCode) {
      const [promoRows] = await db.query(
        'SELECT id FROM promo_codes WHERE code = ? LIMIT 1',
        [finalCouponCode]
      );
      if (promoRows.length > 0) {
        await db.query(
          'UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?',
          [promoRows[0].id]
        );
      }
    }

    // Step 9: Clear cart (delete cart_items, then cart)
    await db.query('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);
    await db.query('DELETE FROM carts WHERE id = ?', [cart.id]);

    // Commit transaction
    await db.query('COMMIT');

    // Fetch created order with items
    const [orderRows] = await db.query(
      `SELECT 
        o.*,
        GROUP_CONCAT(
          CONCAT(oi.quantity, 'x ', p.name) 
          SEPARATOR ', '
        ) as items_summary
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE o.id = ?
      GROUP BY o.id
      LIMIT 1`,
      [orderId]
    );

    // Fetch payment
    const [paymentRows] = await db.query(
      'SELECT id, user_id, guest_id, order_id, amount, gateway, transaction_id, status, created_at FROM payments WHERE order_id = ? LIMIT 1',
      [orderId]
    );

    return res.status(201).json({
      success: true,
      data: {
        order: orderRows[0],
        payment: paymentRows[0],
      },
      message: 'Order created successfully',
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Order creation error:', err);
    
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        message: 'Invalid foreign key reference',
      });
    }
    
    if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({
        success: false,
        message: 'Order must have either user_id or guest_id',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Get order by ID
 * Users can only view their own orders, admins can view any
 * SEO-optimized: Single SELECT query with JOIN
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Single query to fetch order with items
    const [orderRows] = await db.query(
      `SELECT 
        o.*
       FROM orders o
       WHERE o.id = ? LIMIT 1`,
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderRows[0];

    // Permission check: user can only view their own, admin can view any
    if (req.user) {
      if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied',
        });
      }
    } else {
      // Guest can only view if they have guest_id match (would need session check)
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Fetch order items
    const [orderItemsRows] = await db.query(
      `SELECT 
        oi.*,
        p.name as product_name,
        p.slug as product_slug,
        p.image_url as product_image_url
      FROM order_items oi
      INNER JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?`,
      [id]
    );

    // Fetch payment if exists
    const [paymentRows] = await db.query(
      'SELECT id, user_id, guest_id, order_id, amount, gateway, transaction_id, status, created_at FROM payments WHERE order_id = ? LIMIT 1',
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        order: order,
        items: orderItemsRows,
        payment: paymentRows.length > 0 ? paymentRows[0] : null,
      },
    });
  } catch (err) {
    console.error('Get order error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
    });
  }
}

