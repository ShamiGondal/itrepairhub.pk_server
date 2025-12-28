import { getDb } from '../config/db.config.js';

/**
 * Helper function to handle database errors consistently
 */
function handleDbError(err, defaultMessage) {
  console.error(`${defaultMessage} error:`, err);
  
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
 * Get comprehensive dashboard overview
 * Returns all key metrics and counts
 */
export async function getDashboardOverview(req, res) {
  try {
    const db = getDb();

    // Execute all queries in parallel for performance
    const [
      orderStats,
      bookingStats,
      consultationStats,
      revenueStats,
      customerStats,
      productStats,
      serviceStats,
      reviewStats,
      sellRequestStats,
    ] = await Promise.all([
      // Order statistics
      db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN order_status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN order_status = 'shipped' THEN 1 ELSE 0 END) as shipped,
          SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid,
          SUM(CASE WHEN payment_status = 'unpaid' THEN 1 ELSE 0 END) as unpaid,
          SUM(CASE WHEN payment_status = 'refunded' THEN 1 ELSE 0 END) as refunded,
          SUM(total_amount) as total_revenue,
          SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END) as active_revenue,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
          SUM(CASE WHEN WEEK(created_at) = WEEK(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as this_week,
          SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as this_month
        FROM orders
      `),
      
      // Booking statistics
      db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          SUM(total_amount) as total_revenue,
          SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END) as active_revenue,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
          SUM(CASE WHEN WEEK(created_at) = WEEK(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as this_week,
          SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as this_month
        FROM bookings
      `),
      
      // Consultation statistics
      db.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) as requested,
          SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
          SUM(CASE WHEN WEEK(created_at) = WEEK(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as this_week,
          SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as this_month
        FROM consultations
      `),
      
      // Revenue statistics from payments
      db.query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as total_collected,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
          SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) as refunded_amount,
          SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as failed_amount,
          SUM(CASE WHEN gateway = 'cash' AND status = 'succeeded' THEN amount ELSE 0 END) as cash_collected,
          SUM(CASE WHEN gateway = 'stripe' AND status = 'succeeded' THEN amount ELSE 0 END) as stripe_collected,
          SUM(CASE WHEN gateway = 'local_gateway' AND status = 'succeeded' THEN amount ELSE 0 END) as local_gateway_collected,
          SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'succeeded' THEN amount ELSE 0 END) as today_revenue,
          SUM(CASE WHEN WEEK(created_at) = WEEK(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) AND status = 'succeeded' THEN amount ELSE 0 END) as this_week_revenue,
          SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) AND status = 'succeeded' THEN amount ELSE 0 END) as this_month_revenue
        FROM payments
      `),
      
      // Customer statistics
      db.query(`
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) as customers,
          SUM(CASE WHEN role = 'business' THEN 1 ELSE 0 END) as business_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
          SUM(CASE WHEN role = 'technician' THEN 1 ELSE 0 END) as technicians,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as new_today,
          SUM(CASE WHEN WEEK(created_at) = WEEK(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as new_this_week,
          SUM(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) as new_this_month
        FROM users
      `),
      
      // Product statistics
      db.query(`
        SELECT 
          COUNT(*) as total_products,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_products,
          SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_products,
          SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock,
          SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= 5 THEN 1 ELSE 0 END) as low_stock,
          SUM(stock_quantity) as total_stock_value,
          AVG(price) as avg_price,
          SUM(CASE WHEN condition = 'new' THEN 1 ELSE 0 END) as new_products,
          SUM(CASE WHEN condition = 'used' THEN 1 ELSE 0 END) as used_products
        FROM products
      `),
      
      // Service statistics
      db.query(`
        SELECT 
          COUNT(*) as total_services,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_services,
          SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_services,
          SUM(CASE WHEN service_type = 'hardware' THEN 1 ELSE 0 END) as hardware_services,
          SUM(CASE WHEN service_type = 'software' THEN 1 ELSE 0 END) as software_services,
          SUM(CASE WHEN price_type = 'fixed' THEN 1 ELSE 0 END) as fixed_price_services,
          SUM(CASE WHEN price_type = 'variable' THEN 1 ELSE 0 END) as variable_price_services,
          AVG(CASE WHEN price_type = 'fixed' THEN price ELSE NULL END) as avg_fixed_price
        FROM services
      `),
      
      // Review statistics
      db.query(`
        SELECT 
          COUNT(*) as total_reviews,
          SUM(CASE WHEN is_approved = 1 THEN 1 ELSE 0 END) as approved_reviews,
          SUM(CASE WHEN is_approved = 0 THEN 1 ELSE 0 END) as pending_reviews,
          SUM(CASE WHEN is_verified_purchase = 1 THEN 1 ELSE 0 END) as verified_purchases,
          AVG(rating) as average_rating,
          SUM(CASE WHEN product_id IS NOT NULL THEN 1 ELSE 0 END) as product_reviews,
          SUM(CASE WHEN service_id IS NOT NULL THEN 1 ELSE 0 END) as service_reviews
        FROM reviews
      `),
      
      // Sell request statistics
      db.query(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
          SUM(CASE WHEN status = 'inspection_pending' THEN 1 ELSE 0 END) as inspection_pending,
          SUM(CASE WHEN status = 'purchased' THEN 1 ELSE 0 END) as purchased,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
          SUM(CASE WHEN request_type = 'check_price' THEN 1 ELSE 0 END) as price_checks,
          SUM(CASE WHEN request_type = 'sell_item' THEN 1 ELSE 0 END) as sell_items,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
        FROM sell_requests
      `),
    ]);

    // Ensure numeric values are properly converted
    const reviewsData = reviewStats[0][0];
    if (reviewsData && reviewsData.average_rating !== null && reviewsData.average_rating !== undefined) {
      reviewsData.average_rating = parseFloat(reviewsData.average_rating) || 0;
    } else if (reviewsData) {
      reviewsData.average_rating = 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        orders: orderStats[0][0],
        bookings: bookingStats[0][0],
        consultations: consultationStats[0][0],
        revenue: revenueStats[0][0],
        customers: customerStats[0][0],
        products: productStats[0][0],
        services: serviceStats[0][0],
        reviews: reviewsData || { average_rating: 0 },
        sell_requests: sellRequestStats[0][0],
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch dashboard overview');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get sales analytics with time-series data
 * Supports daily, monthly, yearly aggregations
 */
export async function getSalesAnalytics(req, res) {
  try {
    const db = getDb();
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;

    let salesData;
    
    if (period === 'daily') {
      // Last 30 days
      [salesData] = await db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          SUM(total_amount) as revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(DISTINCT COALESCE(user_id, guest_id)) as unique_customers
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND order_status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
    } else if (period === 'monthly') {
      // Last 12 months or specific year
      [salesData] = await db.query(`
        SELECT 
          YEAR(created_at) as year,
          MONTH(created_at) as month,
          DATE_FORMAT(created_at, '%Y-%m') as period,
          COUNT(*) as order_count,
          SUM(total_amount) as revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(DISTINCT COALESCE(user_id, guest_id)) as unique_customers
        FROM orders
        WHERE YEAR(created_at) = ?
          AND order_status != 'cancelled'
        GROUP BY YEAR(created_at), MONTH(created_at)
        ORDER BY year DESC, month DESC
      `, [year]);
    } else if (period === 'yearly') {
      // All years
      [salesData] = await db.query(`
        SELECT 
          YEAR(created_at) as year,
          COUNT(*) as order_count,
          SUM(total_amount) as revenue,
          AVG(total_amount) as avg_order_value,
          COUNT(DISTINCT COALESCE(user_id, guest_id)) as unique_customers
        FROM orders
        WHERE order_status != 'cancelled'
        GROUP BY YEAR(created_at)
        ORDER BY year DESC
      `);
    }

    // Get booking revenue for comparison
    let bookingData;
    if (period === 'daily') {
      [bookingData] = await db.query(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as booking_count,
          SUM(total_amount) as revenue
        FROM bookings
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND status != 'cancelled'
        GROUP BY DATE(created_at)
      `);
    } else if (period === 'monthly') {
      [bookingData] = await db.query(`
        SELECT 
          MONTH(created_at) as month,
          DATE_FORMAT(created_at, '%Y-%m') as period,
          COUNT(*) as booking_count,
          SUM(total_amount) as revenue
        FROM bookings
        WHERE YEAR(created_at) = ?
          AND status != 'cancelled'
        GROUP BY YEAR(created_at), MONTH(created_at)
      `, [year]);
    } else {
      [bookingData] = await db.query(`
        SELECT 
          YEAR(created_at) as year,
          COUNT(*) as booking_count,
          SUM(total_amount) as revenue
        FROM bookings
        WHERE status != 'cancelled'
        GROUP BY YEAR(created_at)
      `);
    }

    return res.status(200).json({
      success: true,
      data: {
        period,
        year: period === 'monthly' ? year : null,
        sales: salesData,
        bookings: bookingData,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch sales analytics');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get revenue analytics
 * Payment gateway breakdown, trends, comparisons
 */
export async function getRevenueAnalytics(req, res) {
  try {
    const db = getDb();

    const [
      gatewayBreakdown,
      revenueBySource,
      monthlyTrend,
    ] = await Promise.all([
      // Payment gateway breakdown
      db.query(`
        SELECT 
          gateway,
          COUNT(*) as transaction_count,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as collected,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) as refunded
        FROM payments
        GROUP BY gateway
      `),
      
      // Revenue by source (orders vs bookings)
      db.query(`
        SELECT 
          CASE 
            WHEN order_id IS NOT NULL THEN 'orders'
            WHEN booking_id IS NOT NULL THEN 'bookings'
            ELSE 'other'
          END as source,
          COUNT(*) as transaction_count,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as revenue
        FROM payments
        WHERE status = 'succeeded'
        GROUP BY source
      `),
      
      // Monthly revenue trend (last 12 months)
      db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as period,
          SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as revenue,
          COUNT(CASE WHEN status = 'succeeded' THEN 1 ELSE NULL END) as successful_transactions,
          SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END) as refunds
        FROM payments
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY period DESC
      `),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        gateway_breakdown: gatewayBreakdown[0],
        revenue_by_source: revenueBySource[0],
        monthly_trend: monthlyTrend[0],
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch revenue analytics');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get order analytics
 * Status transitions, fulfillment rates, etc.
 */
export async function getOrderAnalytics(req, res) {
  try {
    const db = getDb();

    const [
      statusDistribution,
      fulfillmentMetrics,
      topProducts,
    ] = await Promise.all([
      // Order status distribution over time
      db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as period,
          SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN order_status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN order_status = 'shipped' THEN 1 ELSE 0 END) as shipped,
          SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM orders
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY period DESC
      `),
      
      // Fulfillment metrics
      db.query(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
          COALESCE(ROUND(SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2), 0) as fulfillment_rate,
          COALESCE(ROUND(SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2), 0) as cancellation_rate,
          COALESCE(ROUND(SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2), 0) as payment_completion_rate
        FROM orders
      `),
      
      // Top selling products
      db.query(`
        SELECT 
          p.id,
          p.name,
          p.sku,
          COUNT(oi.id) as order_count,
          SUM(oi.quantity) as units_sold,
          SUM(oi.quantity * oi.price_at_purchase) as total_revenue
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.order_status != 'cancelled'
          AND oi.product_id IS NOT NULL
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_revenue DESC
        LIMIT 10
      `),
    ]);

    // Ensure fulfillment_metrics values are numbers
    const fulfillmentData = fulfillmentMetrics[0][0];
    if (fulfillmentData) {
      fulfillmentData.fulfillment_rate = parseFloat(fulfillmentData.fulfillment_rate) || 0;
      fulfillmentData.cancellation_rate = parseFloat(fulfillmentData.cancellation_rate) || 0;
      fulfillmentData.payment_completion_rate = parseFloat(fulfillmentData.payment_completion_rate) || 0;
      fulfillmentData.total_orders = parseInt(fulfillmentData.total_orders) || 0;
      fulfillmentData.delivered = parseInt(fulfillmentData.delivered) || 0;
      fulfillmentData.cancelled = parseInt(fulfillmentData.cancelled) || 0;
    }

    return res.status(200).json({
      success: true,
      data: {
        status_distribution: statusDistribution[0],
        fulfillment_metrics: fulfillmentData || {
          total_orders: 0,
          delivered: 0,
          cancelled: 0,
          fulfillment_rate: 0,
          cancellation_rate: 0,
          payment_completion_rate: 0,
        },
        top_products: topProducts[0],
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch order analytics');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get booking analytics
 * Service demand, technician performance, etc.
 */
export async function getBookingAnalytics(req, res) {
  try {
    const db = getDb();

    const [
      statusDistribution,
      servicePopularity,
      technicianPerformance,
    ] = await Promise.all([
      // Booking status distribution
      db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as period,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
        FROM bookings
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY period DESC
      `),
      
      // Most popular services
      db.query(`
        SELECT 
          s.id,
          s.name,
          s.service_type,
          s.price_type,
          COUNT(b.id) as booking_count,
          SUM(b.total_amount) as total_revenue,
          AVG(b.total_amount) as avg_revenue
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        WHERE b.status != 'cancelled'
        GROUP BY s.id, s.name, s.service_type, s.price_type
        ORDER BY booking_count DESC
        LIMIT 10
      `),
      
      // Technician performance
      db.query(`
        SELECT 
          u.id,
          u.full_name,
          COUNT(b.id) as total_bookings,
          SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
          SUM(CASE WHEN b.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings,
          ROUND(SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(b.id), 2) as completion_rate
        FROM users u
        LEFT JOIN bookings b ON u.id = b.technician_id
        WHERE u.role = 'technician'
        GROUP BY u.id, u.full_name
        HAVING total_bookings > 0
        ORDER BY completion_rate DESC, total_bookings DESC
        LIMIT 10
      `),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        status_distribution: statusDistribution[0],
        service_popularity: servicePopularity[0],
        technician_performance: technicianPerformance[0],
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch booking analytics');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get customer analytics
 * Growth, retention, segments
 */
export async function getCustomerAnalytics(req, res) {
  try {
    const db = getDb();

    const [
      userGrowth,
      customerSegments,
      topCustomers,
    ] = await Promise.all([
      // User growth over time
      db.query(`
        SELECT 
          DATE_FORMAT(created_at, '%Y-%m') as period,
          SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) as new_customers,
          SUM(CASE WHEN role = 'business' THEN 1 ELSE 0 END) as new_business,
          COUNT(*) as total_new_users
        FROM users
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m')
        ORDER BY period DESC
      `),
      
      // Customer segments by activity
      db.query(`
        SELECT 
          CASE 
            WHEN order_count >= 10 THEN 'VIP'
            WHEN order_count >= 5 THEN 'Regular'
            WHEN order_count >= 1 THEN 'Occasional'
            ELSE 'No Orders'
          END as segment,
          COUNT(*) as customer_count,
          AVG(order_count) as avg_orders,
          AVG(total_spent) as avg_spent
        FROM (
          SELECT 
            u.id,
            COUNT(o.id) as order_count,
            COALESCE(SUM(o.total_amount), 0) as total_spent
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id AND o.order_status != 'cancelled'
          WHERE u.role IN ('customer', 'business')
          GROUP BY u.id
        ) as customer_stats
        GROUP BY segment
      `),
      
      // Top customers by revenue
      db.query(`
        SELECT 
          u.id,
          u.full_name,
          u.email,
          u.role,
          COUNT(DISTINCT o.id) as order_count,
          COUNT(DISTINCT b.id) as booking_count,
          COALESCE(SUM(o.total_amount), 0) + COALESCE(SUM(b.total_amount), 0) as total_spent,
          MAX(GREATEST(COALESCE(o.created_at, '1970-01-01'), COALESCE(b.created_at, '1970-01-01'))) as last_purchase
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.order_status != 'cancelled'
        LEFT JOIN bookings b ON u.id = b.user_id AND b.status != 'cancelled'
        WHERE u.role IN ('customer', 'business')
        GROUP BY u.id, u.full_name, u.email, u.role
        HAVING total_spent > 0
        ORDER BY total_spent DESC
        LIMIT 20
      `),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        user_growth: userGrowth[0],
        customer_segments: customerSegments[0],
        top_customers: topCustomers[0],
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch customer analytics');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get product analytics
 * Stock levels, category performance, etc.
 */
export async function getProductAnalytics(req, res) {
  try {
    const db = getDb();

    const [
      stockAlerts,
      categoryPerformance,
      inventoryValue,
    ] = await Promise.all([
      // Stock alerts
      db.query(`
        SELECT 
          COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock,
          COUNT(CASE WHEN stock_quantity > 0 AND stock_quantity <= 5 THEN 1 END) as low_stock,
          COUNT(CASE WHEN stock_quantity > 5 AND stock_quantity <= 20 THEN 1 END) as medium_stock,
          COUNT(CASE WHEN stock_quantity > 20 THEN 1 END) as high_stock
        FROM products
        WHERE is_active = 1
      `),
      
      // Category performance
      db.query(`
        SELECT 
          pc.id,
          pc.name,
          COUNT(DISTINCT p.id) as product_count,
          SUM(p.stock_quantity) as total_stock,
          COUNT(DISTINCT oi.order_id) as order_count,
          SUM(oi.quantity) as units_sold,
          SUM(oi.quantity * oi.price_at_purchase) as revenue
        FROM product_categories pc
        LEFT JOIN products p ON pc.id = p.category_id
        LEFT JOIN order_items oi ON p.id = oi.product_id
        LEFT JOIN orders o ON oi.order_id = o.id AND o.order_status != 'cancelled'
        GROUP BY pc.id, pc.name
        ORDER BY revenue DESC
      `),
      
      // Inventory value
      db.query(`
        SELECT 
          SUM(stock_quantity * price) as total_inventory_value,
          SUM(CASE WHEN condition = 'new' THEN stock_quantity * price ELSE 0 END) as new_inventory_value,
          SUM(CASE WHEN condition = 'used' THEN stock_quantity * price ELSE 0 END) as used_inventory_value,
          COUNT(*) as total_products,
          SUM(stock_quantity) as total_units
        FROM products
        WHERE is_active = 1
      `),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        stock_alerts: stockAlerts[0][0],
        category_performance: categoryPerformance[0],
        inventory_value: inventoryValue[0][0],
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch product analytics');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get service analytics
 * Performance by service type, category, etc.
 */
export async function getServiceAnalytics(req, res) {
  try {
    const db = getDb();

    const [
      serviceTypeBreakdown,
      categoryPerformance,
      priceTypeAnalysis,
    ] = await Promise.all([
      // Service type breakdown
      db.query(`
        SELECT 
          service_type,
          COUNT(*) as service_count,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count,
          COUNT(DISTINCT b.id) as total_bookings,
          SUM(b.total_amount) as total_revenue
        FROM services s
        LEFT JOIN bookings b ON s.id = b.service_id AND b.status != 'cancelled'
        GROUP BY service_type
      `),
      
      // Service category performance
      db.query(`
        SELECT 
          sc.id,
          sc.name,
          COUNT(DISTINCT s.id) as service_count,
          COUNT(DISTINCT b.id) as booking_count,
          SUM(b.total_amount) as revenue
        FROM service_categories sc
        LEFT JOIN services s ON sc.id = s.category_id
        LEFT JOIN bookings b ON s.id = b.service_id AND b.status != 'cancelled'
        GROUP BY sc.id, sc.name
        ORDER BY revenue DESC
      `),
      
      // Price type analysis
      db.query(`
        SELECT 
          price_type,
          COUNT(*) as service_count,
          COUNT(DISTINCT b.id) as booking_count,
          AVG(CASE WHEN price_type = 'fixed' THEN s.price ELSE NULL END) as avg_fixed_price,
          AVG(b.total_amount) as avg_booking_amount,
          SUM(b.total_amount) as total_revenue
        FROM services s
        LEFT JOIN bookings b ON s.id = b.service_id AND b.status != 'cancelled'
        GROUP BY price_type
      `),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        service_type_breakdown: serviceTypeBreakdown[0],
        category_performance: categoryPerformance[0],
        price_type_analysis: priceTypeAnalysis[0],
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch service analytics');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get recent activities
 * Latest orders, bookings, consultations for quick overview
 */
export async function getRecentActivities(req, res) {
  try {
    const db = getDb();
    const { limit = 10 } = req.query;

    const [
      recentOrders,
      recentBookings,
      recentConsultations,
      recentReviews,
    ] = await Promise.all([
      // Recent orders
      db.query(`
        SELECT 
          o.id,
          o.order_status,
          o.payment_status,
          o.total_amount,
          o.created_at,
          COALESCE(u.full_name, gd.full_name) as customer_name,
          COALESCE(u.email, gd.email) as customer_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN guest_details gd ON o.guest_id = gd.id
        ORDER BY o.created_at DESC
        LIMIT ?
      `, [parseInt(limit)]),
      
      // Recent bookings
      db.query(`
        SELECT 
          b.id,
          b.status,
          b.total_amount,
          b.booking_date,
          b.booking_time,
          b.created_at,
          s.name as service_name,
          COALESCE(u.full_name, gd.full_name) as customer_name,
          COALESCE(u.email, gd.email) as customer_email
        FROM bookings b
        JOIN services s ON b.service_id = s.id
        LEFT JOIN users u ON b.user_id = u.id
        LEFT JOIN guest_details gd ON b.guest_id = gd.id
        ORDER BY b.created_at DESC
        LIMIT ?
      `, [parseInt(limit)]),
      
      // Recent consultations
      db.query(`
        SELECT 
          c.id,
          c.name,
          c.email,
          c.phone,
          c.type,
          c.status,
          c.scheduled_at,
          c.created_at
        FROM consultations c
        ORDER BY c.created_at DESC
        LIMIT ?
      `, [parseInt(limit)]),
      
      // Recent reviews
      db.query(`
        SELECT 
          r.id,
          r.rating,
          r.is_approved,
          r.created_at,
          COALESCE(u.full_name, r.guest_name) as reviewer_name,
          p.name as product_name,
          s.name as service_name
        FROM reviews r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN products p ON r.product_id = p.id
        LEFT JOIN services s ON r.service_id = s.id
        ORDER BY r.created_at DESC
        LIMIT ?
      `, [parseInt(limit)]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        recent_orders: recentOrders[0],
        recent_bookings: recentBookings[0],
        recent_consultations: recentConsultations[0],
        recent_reviews: recentReviews[0],
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch recent activities');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

