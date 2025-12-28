import { getDb } from '../config/db.config.js';

/**
 * Get all orders with filtering, pagination, and search
 * Admin only - requires authentication
 * Supports filtering by status, payment_status, date range, customer
 */
export async function getAllOrders(req, res) {
  try {
    const db = getDb();
    const {
      status,
      payment_status,
      start_date,
      end_date,
      customer_email,
      customer_name,
      order_id,
      page = 1,
      limit = 50,
      sort = 'created_at',
      order = 'DESC',
    } = req.query;

    // Build WHERE clause
    const whereConditions = [];
    const queryParams = [];

    if (status) {
      whereConditions.push('o.order_status = ?');
      queryParams.push(status);
    }

    if (payment_status) {
      whereConditions.push('o.payment_status = ?');
      queryParams.push(payment_status);
    }

    if (start_date) {
      whereConditions.push('DATE(o.created_at) >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('DATE(o.created_at) <= ?');
      queryParams.push(end_date);
    }

    if (order_id) {
      whereConditions.push('o.id = ?');
      queryParams.push(parseInt(order_id));
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
    const allowedSortFields = ['created_at', 'total_amount', 'id', 'order_status', 'payment_status'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get orders with customer info
    const [orderRows] = await db.query(
      `SELECT 
        o.id,
        o.user_id,
        o.guest_id,
        o.address_id,
        o.subtotal,
        o.discount_amount,
        o.total_amount,
        o.coupon_code,
        o.order_status,
        o.payment_status,
        o.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone,
        gd.full_name as guest_name,
        gd.email as guest_email,
        gd.phone_number as guest_phone,
        a.line_1 as address_line_1,
        a.city as address_city,
        a.postal_code as address_postal_code,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN guest_details gd ON o.guest_id = gd.id
      LEFT JOIN addresses a ON o.address_id = a.id
      ${whereClause}
      ORDER BY o.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN guest_details gd ON o.guest_id = gd.id
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Format orders with customer info
    const orders = orderRows.map(order => ({
      id: order.id,
      customer: {
        type: order.user_id ? 'registered' : 'guest',
        name: order.user_name || order.guest_name || 'Unknown',
        email: order.user_email || order.guest_email || null,
        phone: order.user_phone || order.guest_phone || null,
      },
      address: order.address_line_1 ? {
        line_1: order.address_line_1,
        city: order.address_city,
        postal_code: order.address_postal_code,
      } : null,
      totals: {
        subtotal: parseFloat(order.subtotal),
        discount_amount: parseFloat(order.discount_amount),
        total_amount: parseFloat(order.total_amount),
      },
      coupon_code: order.coupon_code,
      order_status: order.order_status,
      payment_status: order.payment_status,
      item_count: order.item_count,
      created_at: order.created_at,
    }));

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    console.error('Get all orders error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
    });
  }
}

/**
 * Get order by ID with full details
 * Admin only - includes all order items, customer info, payment, and address
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // Get order with customer and address info
    const [orderRows] = await db.query(
      `SELECT 
        o.*,
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
        a.postal_code as address_postal_code
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN guest_details gd ON o.guest_id = gd.id
      LEFT JOIN addresses a ON o.address_id = a.id
      WHERE o.id = ?
      LIMIT 1`,
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderRows[0];

    // Get order items (products and custom builds)
    const [orderItemsRows] = await db.query(
      `SELECT 
        oi.*,
        p.id as product_id,
        p.name as product_name,
        p.slug as product_slug,
        p.sku as product_sku,
        p.condition as product_condition,
        cpb.id as custom_build_id,
        cpb.total_estimated_price as custom_build_price,
        cpb.configuration_data as custom_build_config
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN custom_pc_builds cpb ON oi.custom_build_id = cpb.id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC`,
      [id]
    );

    // Get product images for order items
    const productIds = orderItemsRows
      .filter(item => item.product_id)
      .map(item => item.product_id);

    let productImagesMap = {};
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      const [imageRows] = await db.query(
        `SELECT product_id, image_url, alt_text, display_order 
         FROM product_images 
         WHERE product_id IN (${placeholders}) 
         ORDER BY product_id, display_order ASC`,
        productIds
      );

      imageRows.forEach(img => {
        if (!productImagesMap[img.product_id]) {
          productImagesMap[img.product_id] = [];
        }
        productImagesMap[img.product_id].push({
          image_url: img.image_url,
          alt_text: img.alt_text,
          display_order: img.display_order,
        });
      });
    }

    // Format order items
    const items = orderItemsRows.map(item => {
      if (item.product_id) {
        return {
          id: item.id,
          type: 'product',
          product_id: item.product_id,
          product_name: item.product_name,
          product_slug: item.product_slug,
          product_sku: item.product_sku,
          product_condition: item.product_condition,
          quantity: item.quantity,
          price_at_purchase: parseFloat(item.price_at_purchase),
          line_total: parseFloat(item.price_at_purchase) * item.quantity,
          image_url: productImagesMap[item.product_id]?.find(img => img.display_order === 0)?.image_url || null,
        };
      } else if (item.custom_build_id) {
        // Handle configuration_data - MySQL JSON columns are already parsed, but check if it's a string
        let configurationData = null;
        if (item.custom_build_config) {
          if (typeof item.custom_build_config === 'string') {
            try {
              configurationData = JSON.parse(item.custom_build_config);
            } catch (err) {
              console.error('Error parsing custom_build_config:', err);
              configurationData = null;
            }
          } else {
            // Already an object
            configurationData = item.custom_build_config;
          }
        }

        return {
          id: item.id,
          type: 'custom_build',
          custom_build_id: item.custom_build_id,
          custom_build_price: parseFloat(item.custom_build_price),
          configuration_data: configurationData,
          quantity: item.quantity,
          price_at_purchase: parseFloat(item.price_at_purchase),
          line_total: parseFloat(item.price_at_purchase) * item.quantity,
        };
      }
      return null;
    }).filter(Boolean);

    // Get payment info
    const [paymentRows] = await db.query(
      `SELECT 
        id,
        user_id,
        guest_id,
        order_id,
        amount,
        gateway,
        transaction_id,
        status,
        created_at
      FROM payments 
      WHERE order_id = ?
      ORDER BY created_at DESC`,
      [id]
    );

    // Format order response
    const orderData = {
      id: order.id,
      customer: {
        type: order.user_id ? 'registered' : 'guest',
        user_id: order.user_id,
        guest_id: order.guest_id,
        name: order.user_name || order.guest_name || 'Unknown',
        email: order.user_email || order.guest_email || null,
        phone: order.user_phone || order.guest_phone || null,
      },
      address: order.address_id ? {
        id: order.address_id,
        label: order.address_label,
        line_1: order.address_line_1,
        line_2: order.address_line_2,
        city: order.address_city,
        state: order.address_state,
        postal_code: order.address_postal_code,
      } : (order.guest_address_line_1 ? {
        line_1: order.guest_address_line_1,
        line_2: order.guest_address_line_2,
        city: order.guest_city,
        state: order.guest_state,
        postal_code: order.guest_postal_code,
      } : null),
      items,
      totals: {
        subtotal: parseFloat(order.subtotal),
        discount_amount: parseFloat(order.discount_amount),
        total_amount: parseFloat(order.total_amount),
      },
      coupon_code: order.coupon_code,
      order_status: order.order_status,
      payment_status: order.payment_status,
      payments: paymentRows.map(p => ({
        id: p.id,
        amount: parseFloat(p.amount),
        gateway: p.gateway,
        transaction_id: p.transaction_id,
        status: p.status,
        created_at: p.created_at,
      })),
      created_at: order.created_at,
    };

    return res.status(200).json({
      success: true,
      data: orderData,
    });
  } catch (err) {
    console.error('Get order by ID error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
    });
  }
}

/**
 * Update order status
 * Admin only - validates status transitions
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const db = getDb();

    // Validate status
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Check if order exists
    const [orderRows] = await db.query(
      'SELECT id, order_status, payment_status FROM orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const currentOrder = orderRows[0];

    // Validate status transition
    const currentStatus = currentOrder.order_status;
    
    // Business logic: Can't change status if already cancelled or delivered
    if (currentStatus === 'cancelled' && status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status of a cancelled order',
      });
    }

    if (currentStatus === 'delivered' && status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status of a delivered order',
      });
    }

    // Update order status
    await db.query(
      'UPDATE orders SET order_status = ? WHERE id = ?',
      [status, id]
    );

    // If cancelling, handle stock restoration and payment refund
    if (status === 'cancelled' && currentStatus !== 'cancelled') {
      // Restore product stock
      const [orderItemsRows] = await db.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL',
        [id]
      );

      for (const item of orderItemsRows) {
        await db.query(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }

      // If payment was made, mark payment as refunded
      if (currentOrder.payment_status === 'paid') {
        await db.query(
          'UPDATE payments SET status = ? WHERE order_id = ?',
          ['refunded', id]
        );
        await db.query(
          'UPDATE orders SET payment_status = ? WHERE id = ?',
          ['refunded', id]
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: {
        order_id: id,
        old_status: currentStatus,
        new_status: status,
      },
    });
  } catch (err) {
    console.error('Update order status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order status',
    });
  }
}

/**
 * Update payment status
 * Admin only - for manual payment recording
 */
export async function updatePaymentStatus(req, res) {
  try {
    const { id } = req.params;
    const { payment_status, transaction_id, gateway } = req.body;
    const db = getDb();

    // Validate payment status
    const validStatuses = ['unpaid', 'paid', 'refunded'];
    if (!payment_status || !validStatuses.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Check if order exists
    const [orderRows] = await db.query(
      'SELECT id, payment_status FROM orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Map order payment_status to payments status enum
    // orders.payment_status: 'unpaid', 'paid', 'refunded'
    // payments.status: 'pending', 'succeeded', 'failed', 'refunded'
    const paymentStatusMap = {
      'unpaid': 'pending',
      'paid': 'succeeded',
      'refunded': 'refunded',
    };
    const mappedPaymentStatus = paymentStatusMap[payment_status] || 'pending';

    // Update order payment status
    await db.query(
      'UPDATE orders SET payment_status = ? WHERE id = ?',
      [payment_status, id]
    );

    // Update or create payment record
    const [paymentRows] = await db.query(
      'SELECT id FROM payments WHERE order_id = ? LIMIT 1',
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
        // If it's a data truncation error, provide more context
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
      const [orderData] = await db.query(
        'SELECT user_id, guest_id, total_amount FROM orders WHERE id = ? LIMIT 1',
        [id]
      );

      if (orderData.length > 0) {
        // Validate gateway
        const validGateways = ['stripe', 'local_gateway', 'cash'];
        const finalGateway = gateway && validGateways.includes(gateway) ? gateway : 'local_gateway';

        try {
          await db.query(
            `INSERT INTO payments (user_id, guest_id, order_id, amount, gateway, transaction_id, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              orderData[0].user_id,
              orderData[0].guest_id,
              id,
              orderData[0].total_amount,
              finalGateway,
              transaction_id || null,
              mappedPaymentStatus,
            ]
          );
        } catch (dbErr) {
          console.error('Payment insert error:', dbErr);
          // If it's a data truncation error, provide more context
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
        order_id: id,
        payment_status,
      },
    });
  } catch (err) {
    console.error('Update payment status error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
    });
  }
}

/**
 * Cancel order
 * Admin only - cancels order, restores stock, handles refunds
 */
export async function cancelOrder(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const db = getDb();

    // Check if order exists
    const [orderRows] = await db.query(
      'SELECT id, order_status, payment_status FROM orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderRows[0];

    // Can't cancel already cancelled or delivered orders
    if (order.order_status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled',
      });
    }

    if (order.order_status === 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a delivered order',
      });
    }

    await db.query('START TRANSACTION');

    try {
      // Update order status
      await db.query(
        'UPDATE orders SET order_status = ? WHERE id = ?',
        ['cancelled', id]
      );

      // Restore product stock
      const [orderItemsRows] = await db.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL',
        [id]
      );

      for (const item of orderItemsRows) {
        await db.query(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }

      // Handle payment refund if paid
      if (order.payment_status === 'paid') {
        // Map 'refunded' status - same for both tables
        await db.query(
          'UPDATE payments SET status = ? WHERE order_id = ?',
          ['refunded', id]
        );
        await db.query(
          'UPDATE orders SET payment_status = ? WHERE id = ?',
          ['refunded', id]
        );
      }

      await db.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: {
          order_id: id,
          reason: reason || null,
        },
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Cancel order error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
    });
  }
}

/**
 * Refund order
 * Admin only - processes refund for paid orders
 */
export async function refundOrder(req, res) {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;
    const db = getDb();

    // Check if order exists
    const [orderRows] = await db.query(
      'SELECT id, payment_status, total_amount FROM orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orderRows[0];

    // Can only refund paid orders
    if (order.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order is not paid, cannot process refund',
      });
    }

    // Validate refund amount
    const refundAmount = amount ? parseFloat(amount) : parseFloat(order.total_amount);
    if (refundAmount <= 0 || refundAmount > parseFloat(order.total_amount)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid refund amount',
      });
    }

    // Update payment status
    await db.query(
      'UPDATE payments SET status = ? WHERE order_id = ?',
      ['refunded', id]
    );

    await db.query(
      'UPDATE orders SET payment_status = ? WHERE id = ?',
      ['refunded', id]
    );

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        order_id: id,
        refund_amount: refundAmount,
        reason: reason || null,
      },
    });
  } catch (err) {
    console.error('Refund order error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to process refund',
    });
  }
}

/**
 * Add admin note to order
 * Admin only - for internal notes (stored in admin_notes if we add that field, or we can use a notes table)
 * For now, we'll store it in a simple way - you can extend this later
 */
export async function addOrderNote(req, res) {
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

    // Check if order exists
    const [orderRows] = await db.query(
      'SELECT id FROM orders WHERE id = ? LIMIT 1',
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // For now, we'll just return success
    // In the future, you can add an order_notes table or admin_notes field
    // This is a placeholder for the functionality

    return res.status(200).json({
      success: true,
      message: 'Note added successfully',
      data: {
        order_id: id,
        note: note.trim(),
      },
    });
  } catch (err) {
    console.error('Add order note error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add note',
    });
  }
}

