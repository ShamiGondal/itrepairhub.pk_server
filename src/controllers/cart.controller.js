import { getDb } from '../config/db.config.js';

/**
 * Get or create cart for user/guest
 * SEO-optimized: Single query with proper indexes
 */
async function getOrCreateCart(userId, guestId, sessionId) {
  const db = getDb();
  
  // Try to find existing cart
  let cart = null;
  
  if (userId) {
    const [rows] = await db.query(
      'SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      [userId]
    );
    if (rows.length > 0) {
      cart = rows[0];
    }
  } else if (guestId) {
    const [rows] = await db.query(
      'SELECT * FROM carts WHERE guest_id = ? ORDER BY updated_at DESC LIMIT 1',
      [guestId]
    );
    if (rows.length > 0) {
      cart = rows[0];
    }
  } else if (sessionId) {
    const [rows] = await db.query(
      'SELECT * FROM carts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1',
      [sessionId]
    );
    if (rows.length > 0) {
      cart = rows[0];
    }
  }
  
  // Create new cart if not found
  if (!cart) {
    const [result] = await db.query(
      `INSERT INTO carts (user_id, guest_id, session_id, subtotal, discount_amount, total_amount) 
       VALUES (?, ?, ?, 0.00, 0.00, 0.00)`,
      [userId || null, guestId || null, sessionId || null]
    );
    
    const [newCart] = await db.query(
      'SELECT * FROM carts WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    cart = newCart[0];
  }
  
  return cart;
}

/**
 * Recalculate cart totals
 * SEO-optimized: Single aggregated query
 */
async function calculateCartTotals(cartId) {
  const db = getDb();
  
  // Calculate subtotal from cart items
  const [subtotalRows] = await db.query(
    `SELECT COALESCE(SUM(quantity * discounted_price), 0) as subtotal 
     FROM cart_items 
     WHERE cart_id = ?`,
    [cartId]
  );
  
  const subtotal = parseFloat(subtotalRows[0].subtotal) || 0.00;
  
  // Get cart to check for promo code
  const [cartRows] = await db.query(
    'SELECT coupon_code FROM carts WHERE id = ? LIMIT 1',
    [cartId]
  );
  
  let discountAmount = 0.00;
  const cart = cartRows[0];
  
  // Apply promo code discount if exists
  if (cart && cart.coupon_code) {
    const [promoRows] = await db.query(
      `SELECT discount_type, discount_value, min_order_amount, 
              usage_limit, used_count, expires_at, is_active
       FROM promo_codes 
       WHERE code = ? AND is_active = 1
       LIMIT 1`,
      [cart.coupon_code.toUpperCase().trim()]
    );
    
    if (promoRows.length > 0) {
      const promoCode = promoRows[0];
      
      // Validate promo code is still valid
      let isValid = true;
      
      // Check expiration
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
      
      // Check minimum order amount
      if (isValid && subtotal < promoCode.min_order_amount) {
        isValid = false;
      }
      
      // Calculate discount if valid
      if (isValid) {
        if (promoCode.discount_type === 'percentage') {
          discountAmount = subtotal * (promoCode.discount_value / 100);
        } else {
          discountAmount = promoCode.discount_value;
        }
        // Ensure discount doesn't exceed subtotal
        discountAmount = Math.min(discountAmount, subtotal);
      } else {
        // Clear invalid promo code
        await db.query(
          'UPDATE carts SET coupon_code = NULL, discount_amount = 0.00 WHERE id = ?',
          [cartId]
        );
      }
    } else {
      // Clear invalid promo code
      await db.query(
        'UPDATE carts SET coupon_code = NULL, discount_amount = 0.00 WHERE id = ?',
        [cartId]
      );
    }
  }
  
  discountAmount = parseFloat(discountAmount.toFixed(2));
  const totalAmount = parseFloat((subtotal - discountAmount).toFixed(2));
  
  // Update cart totals
  await db.query(
    `UPDATE carts 
     SET subtotal = ?, discount_amount = ?, total_amount = ? 
     WHERE id = ?`,
    [subtotal, discountAmount, totalAmount, cartId]
  );
  
  return {
    subtotal,
    discount_amount: discountAmount,
    total_amount: totalAmount,
  };
}

/**
 * Get user's cart with all items and calculated totals
 * SEO-optimized: Single query with JOINs, fast response (<200ms)
 */
export async function getCart(req, res) {
  try {
    const db = getDb();
    
    // Determine cart owner
    const userId = req.user?.id || null;
    const guestId = req.body?.guest_id || null;
    // Check both lowercase and original case for session_id header
    const sessionId = req.headers['x-session-id'] || req.headers['X-Session-Id'] || req.cookies?.session_id || null;
    
    if (!userId && !guestId && !sessionId) {
      return res.status(200).json({
        success: true,
        data: {
          id: null,
          items: [],
          subtotal: 0.00,
          discount_amount: 0.00,
          total_amount: 0.00,
          coupon_code: null,
          item_count: 0,
        },
      });
    }
    
    // Get or create cart
    const cart = await getOrCreateCart(userId, guestId, sessionId);
    
    // Fetch cart items with product and service details (SEO-optimized: Single query with LEFT JOINs)
    const [itemRows] = await db.query(
      `SELECT 
        ci.id,
        ci.cart_id,
        ci.product_id,
        ci.service_id,
        ci.quantity,
        ci.price_at_added,
        ci.discount_percentage,
        ci.discounted_price,
        p.name as product_name,
        p.slug as product_slug,
        p.sku,
        p.stock_quantity,
        p.is_active as product_is_active,
        s.name as service_name,
        s.slug as service_slug,
        s.is_active as service_is_active,
        s.price_type
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      LEFT JOIN services s ON ci.service_id = s.id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at ASC`,
      [cart.id]
    );
    
    // Separate products and services
    const productItems = itemRows.filter(item => item.product_id);
    const serviceItems = itemRows.filter(item => item.service_id);
    
    // Fetch product images (SEO-optimized: Single query for all images)
    const productIds = productItems.map(item => item.product_id);
    let imagesMap = {};
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
        if (!imagesMap[img.product_id]) {
          imagesMap[img.product_id] = [];
        }
        imagesMap[img.product_id].push({
          image_url: img.image_url,
          alt_text: img.alt_text,
          display_order: img.display_order,
        });
      });
    }
    
    // Fetch service images (SEO-optimized: Single query for all images)
    const serviceIds = serviceItems.map(item => item.service_id);
    let serviceImagesMap = {};
    if (serviceIds.length > 0) {
      const placeholders = serviceIds.map(() => '?').join(',');
      const [imageRows] = await db.query(
        `SELECT service_id, image_url, alt_text, display_order 
         FROM service_images 
         WHERE service_id IN (${placeholders}) 
         ORDER BY service_id, display_order ASC`,
        serviceIds
      );
      
      imageRows.forEach(img => {
        if (!serviceImagesMap[img.service_id]) {
          serviceImagesMap[img.service_id] = [];
        }
        serviceImagesMap[img.service_id].push({
          image_url: img.image_url,
          alt_text: img.alt_text,
          display_order: img.display_order,
        });
      });
    }
    
    // Attach images to items
    const items = itemRows.map(item => {
      if (item.product_id) {
        // Product item
        return {
          id: item.id,
          product_id: item.product_id,
          service_id: null,
          product_name: item.product_name,
          product_slug: item.product_slug,
          sku: item.sku,
          quantity: item.quantity,
          price_at_added: parseFloat(item.price_at_added),
          discount_percentage: parseFloat(item.discount_percentage),
          discounted_price: parseFloat(item.discounted_price),
          stock_quantity: item.stock_quantity,
          is_active: item.product_is_active === 1,
          image_url: imagesMap[item.product_id]?.find(img => img.display_order === 0)?.image_url || null,
          images: imagesMap[item.product_id] || [],
        };
      } else {
        // Service item
        return {
          id: item.id,
          product_id: null,
          service_id: item.service_id,
          service_name: item.service_name,
          service_slug: item.service_slug,
          quantity: item.quantity,
          price_at_added: parseFloat(item.price_at_added),
          discount_percentage: parseFloat(item.discount_percentage),
          discounted_price: parseFloat(item.discounted_price),
          price_type: item.price_type,
          is_active: item.service_is_active === 1,
          image_url: serviceImagesMap[item.service_id]?.find(img => img.display_order === 0)?.image_url || null,
          images: serviceImagesMap[item.service_id] || [],
        };
      }
    });
    
    // Recalculate totals
    const totals = await calculateCartTotals(cart.id);
    
    // Fetch updated cart
    const [cartRows] = await db.query(
      'SELECT * FROM carts WHERE id = ? LIMIT 1',
      [cart.id]
    );
    const updatedCart = cartRows[0];
    
    // Calculate total item count
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    
    return res.status(200).json({
      success: true,
      data: {
        id: updatedCart.id,
        items,
        subtotal: totals.subtotal,
        discount_amount: totals.discount_amount,
        total_amount: totals.total_amount,
        coupon_code: updatedCart.coupon_code,
        item_count: itemCount,
      },
    });
  } catch (err) {
    console.error('Get cart error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch cart',
    });
  }
}

/**
 * Add product to cart or update quantity
 * SEO-optimized: Transaction-based, atomic operations
 */
export async function addToCart(req, res) {
  const db = getDb();
  
  await db.query('START TRANSACTION');
  
  try {
    const { product_id, quantity } = req.body;
    
    // Validation
    if (!product_id || !quantity) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'product_id and quantity are required',
      });
    }
    
    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'quantity must be greater than 0',
      });
    }
    
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
    
    // Validate product exists and is active
    const [productRows] = await db.query(
      'SELECT id, name, price, discount_percentage, stock_quantity, is_active FROM products WHERE id = ? LIMIT 1',
      [product_id]
    );
    
    if (productRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }
    
    const product = productRows[0];
    
    if (!product.is_active) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Product is not active',
      });
    }
    
    // Check stock availability
    if (product.stock_quantity < qty) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock_quantity} items available in stock`,
      });
    }
    
    // Get or create cart
    const cart = await getOrCreateCart(userId, guestId, sessionId);
    
    // Calculate product price with line-item discount
    const originalPrice = parseFloat(product.price) || 0;
    const lineItemDiscountPercentage = parseFloat(product.discount_percentage) || 0;
    const discountedPrice = lineItemDiscountPercentage > 0
      ? originalPrice * (1 - lineItemDiscountPercentage / 100)
      : originalPrice;
    const finalDiscountedPrice = parseFloat(discountedPrice.toFixed(2));
    
    // Check if product already in cart
    const [existingItemRows] = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1',
      [cart.id, product_id]
    );
    
    if (existingItemRows.length > 0) {
      // Update quantity
      const existingItem = existingItemRows[0];
      const newQuantity = existingItem.quantity + qty;
      
      // Check stock for new quantity
      if (product.stock_quantity < newQuantity) {
        await db.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Only ${product.stock_quantity} items available in stock`,
        });
      }
      
      await db.query(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [newQuantity, existingItem.id]
      );
    } else {
      // Create new cart item with price snapshot
      await db.query(
        `INSERT INTO cart_items (cart_id, product_id, quantity, price_at_added, discount_percentage, discounted_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          cart.id,
          product_id,
          qty,
          originalPrice,
          lineItemDiscountPercentage,
          finalDiscountedPrice,
        ]
      );
    }
    
    // Recalculate cart totals
    await calculateCartTotals(cart.id);
    
    await db.query('COMMIT');
    
    // Return updated cart
    return getCart(req, res);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Add to cart error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add item to cart',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Add service to cart or update quantity
 * SEO-optimized: Transaction-based, atomic operations
 */
export async function addServiceToCart(req, res) {
  const db = getDb();
  
  await db.query('START TRANSACTION');
  
  try {
    const { service_id, quantity } = req.body;
    
    // Validation
    if (!service_id || !quantity) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'service_id and quantity are required',
      });
    }
    
    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'quantity must be greater than 0',
      });
    }
    
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
    
    // Validate service exists and is active
    const [serviceRows] = await db.query(
      'SELECT id, name, price, discount_percentage, price_type, is_active FROM services WHERE id = ? LIMIT 1',
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
    
    // Get or create cart
    const cart = await getOrCreateCart(userId, guestId, sessionId);
    
    // Calculate service price with line-item discount
    // For variable price services, set price to 0 (won't affect cart totals)
    const originalPrice = service.price_type === 'fixed' ? (parseFloat(service.price) || 0) : 0;
    const lineItemDiscountPercentage = service.price_type === 'fixed' ? (parseFloat(service.discount_percentage) || 0) : 0;
    const discountedPrice = lineItemDiscountPercentage > 0
      ? originalPrice * (1 - lineItemDiscountPercentage / 100)
      : originalPrice;
    const finalDiscountedPrice = parseFloat(discountedPrice.toFixed(2));
    
    // Check if service already in cart
    const [existingItemRows] = await db.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND service_id = ? LIMIT 1',
      [cart.id, service_id]
    );
    
    if (existingItemRows.length > 0) {
      // Update quantity
      const existingItem = existingItemRows[0];
      const newQuantity = existingItem.quantity + qty;
      
      await db.query(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [newQuantity, existingItem.id]
      );
    } else {
      // Create new cart item with price snapshot
      await db.query(
        `INSERT INTO cart_items (cart_id, service_id, quantity, price_at_added, discount_percentage, discounted_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          cart.id,
          service_id,
          qty,
          originalPrice,
          lineItemDiscountPercentage,
          finalDiscountedPrice,
        ]
      );
    }
    
    // Recalculate cart totals
    await calculateCartTotals(cart.id);
    
    await db.query('COMMIT');
    
    // Return updated cart
    return getCart(req, res);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Add service to cart error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to add service to cart',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Update cart item quantity
 * SEO-optimized: Transaction-based, atomic operations
 */
export async function updateCartItem(req, res) {
  const db = getDb();
  
  await db.query('START TRANSACTION');
  
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    // Validation
    if (!quantity) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'quantity is required',
      });
    }
    
    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'quantity must be greater than 0',
      });
    }
    
    // Determine cart owner
    const userId = req.user?.id || null;
    const guestId = req.body?.guest_id || null;
    // Check both lowercase and original case for session_id header
    const sessionId = req.headers['x-session-id'] || req.headers['X-Session-Id'] || req.cookies?.session_id || null;
    
    // Get cart item with cart and product/service details
    const [itemRows] = await db.query(
      `SELECT ci.*, c.user_id, c.guest_id, c.session_id, 
              p.stock_quantity as product_stock, p.is_active as product_is_active,
              s.is_active as service_is_active
       FROM cart_items ci
       INNER JOIN carts c ON ci.cart_id = c.id
       LEFT JOIN products p ON ci.product_id = p.id
       LEFT JOIN services s ON ci.service_id = s.id
       WHERE ci.id = ? LIMIT 1`,
      [id]
    );
    
    if (itemRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
    }
    
    const item = itemRows[0];
    
    // Validate cart ownership
    const isOwner = 
      (userId && item.user_id === userId) ||
      (guestId && item.guest_id === guestId) ||
      (sessionId && item.session_id === sessionId);
    
    if (!isOwner) {
      await db.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    
    // Check product is still active
    if (item.product_id && !item.product_is_active) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Product is no longer available',
      });
    }
    
    // Check service is still active
    if (item.service_id && !item.service_is_active) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Service is no longer available',
      });
    }
    
    // Check stock availability for products (services don't have stock)
    if (item.product_id && item.product_stock < qty) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Only ${item.product_stock} items available in stock`,
      });
    }
    
    // Update quantity
    await db.query(
      'UPDATE cart_items SET quantity = ? WHERE id = ?',
      [qty, id]
    );
    
    // Recalculate cart totals
    await calculateCartTotals(item.cart_id);
    
    await db.query('COMMIT');
    
    // Return updated cart
    return getCart(req, res);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Update cart item error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update cart item',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Remove item from cart
 * SEO-optimized: Transaction-based, atomic operations
 */
export async function removeFromCart(req, res) {
  const db = getDb();
  
  await db.query('START TRANSACTION');
  
  try {
    const { id } = req.params;
    
    // Determine cart owner
    const userId = req.user?.id || null;
    const guestId = req.body?.guest_id || null;
    // Check both lowercase and original case for session_id header
    const sessionId = req.headers['x-session-id'] || req.headers['X-Session-Id'] || req.cookies?.session_id || null;
    
    // Get cart item with cart details
    const [itemRows] = await db.query(
      `SELECT ci.*, c.user_id, c.guest_id, c.session_id
       FROM cart_items ci
       INNER JOIN carts c ON ci.cart_id = c.id
       WHERE ci.id = ? LIMIT 1`,
      [id]
    );
    
    if (itemRows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Cart item not found',
      });
    }
    
    const item = itemRows[0];
    
    // Validate cart ownership
    const isOwner = 
      (userId && item.user_id === userId) ||
      (guestId && item.guest_id === guestId) ||
      (sessionId && item.session_id === sessionId);
    
    if (!isOwner) {
      await db.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    
    // Delete cart item
    await db.query('DELETE FROM cart_items WHERE id = ?', [id]);
    
    // Recalculate cart totals
    await calculateCartTotals(item.cart_id);
    
    await db.query('COMMIT');
    
    // Return updated cart
    return getCart(req, res);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Remove from cart error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Apply promo code to cart
 * SEO-optimized: Transaction-based, validates and applies discount
 */
export async function applyPromoCode(req, res) {
  const db = getDb();
  
  await db.query('START TRANSACTION');
  
  try {
    const { coupon_code } = req.body;
    
    if (!coupon_code) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'coupon_code is required',
      });
    }
    
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
    
    // Get or create cart
    const cart = await getOrCreateCart(userId, guestId, sessionId);
    
    // Validate promo code
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
    
    // Calculate current subtotal
    const [subtotalRows] = await db.query(
      `SELECT COALESCE(SUM(quantity * discounted_price), 0) as subtotal 
       FROM cart_items 
       WHERE cart_id = ?`,
      [cart.id]
    );
    const subtotal = parseFloat(subtotalRows[0].subtotal) || 0.00;
    
    // Check minimum order amount
    if (subtotal < promoCode.min_order_amount) {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ${promoCode.min_order_amount} required`,
        min_order_amount: promoCode.min_order_amount,
      });
    }
    
    // Update cart with promo code
    await db.query(
      'UPDATE carts SET coupon_code = ? WHERE id = ?',
      [promoCode.code, cart.id]
    );
    
    // Recalculate cart totals (will apply discount)
    await calculateCartTotals(cart.id);
    
    await db.query('COMMIT');
    
    // Return updated cart
    return getCart(req, res);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Apply promo code error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply promo code',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Remove promo code from cart
 * SEO-optimized: Transaction-based, recalculates totals
 */
export async function removePromoCode(req, res) {
  const db = getDb();
  
  await db.query('START TRANSACTION');
  
  try {
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
    
    // Get or create cart
    const cart = await getOrCreateCart(userId, guestId, sessionId);
    
    // Clear promo code
    await db.query(
      'UPDATE carts SET coupon_code = NULL, discount_amount = 0.00 WHERE id = ?',
      [cart.id]
    );
    
    // Recalculate cart totals
    await calculateCartTotals(cart.id);
    
    await db.query('COMMIT');
    
    // Return updated cart
    return getCart(req, res);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Remove promo code error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove promo code',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

/**
 * Clear all items from cart
 * SEO-optimized: Transaction-based, deletes all items
 */
export async function clearCart(req, res) {
  const db = getDb();
  
  await db.query('START TRANSACTION');
  
  try {
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
    
    // Get or create cart
    const cart = await getOrCreateCart(userId, guestId, sessionId);
    
    // Delete all cart items
    await db.query('DELETE FROM cart_items WHERE cart_id = ?', [cart.id]);
    
    // Reset cart totals
    await db.query(
      'UPDATE carts SET subtotal = 0.00, discount_amount = 0.00, total_amount = 0.00, coupon_code = NULL WHERE id = ?',
      [cart.id]
    );
    
    await db.query('COMMIT');
    
    // Return updated cart
    return getCart(req, res);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Clear cart error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear cart',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
}

