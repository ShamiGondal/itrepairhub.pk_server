import { getDb } from '../config/db.config.js';

/**
 * Get all unique component types for PC Builder
 * Returns only specific product categories used for PC building
 * SEO-optimized: Single query with index
 */
export async function getComponentTypes(req, res) {
  try {
    const db = getDb();

    // Only fetch these specific PC Builder categories by slug
    const allowedSlugs = [
      'pc-case',
      'motherboard',
      'cpu',
      'psu-power-supply-unit',
      'storage',
      'memory',
      'gpu-graphics-card',
      'cooling',
      'pc-fans',
      'monitor'
    ];

    // Get unique component types from product_categories
    // Filter by allowed slugs and only show categories with active products
    const placeholders = allowedSlugs.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT 
        pc.id,
        pc.name,
        pc.slug,
        pc.image_url,
        COUNT(DISTINCT p.id) as product_count
      FROM product_categories pc
      INNER JOIN products p ON pc.id = p.category_id 
        AND p.is_active = 1
      WHERE pc.slug IN (${placeholders})
      GROUP BY pc.id, pc.name, pc.slug, pc.image_url
      HAVING product_count > 0
      ORDER BY 
        CASE pc.slug
          WHEN 'pc-case' THEN 1
          WHEN 'motherboard' THEN 2
          WHEN 'cpu' THEN 3
          WHEN 'psu-power-supply-unit' THEN 4
          WHEN 'storage' THEN 5
          WHEN 'memory' THEN 6
          WHEN 'gpu-graphics-card' THEN 7
          WHEN 'cooling' THEN 8
          WHEN 'pc-fans' THEN 9
          WHEN 'monitor' THEN 10
          ELSE 99
        END ASC`,
      allowedSlugs
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error('Get component types error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch component types',
    });
  }
}

/**
 * Get all products for a specific component type
 * SEO-optimized: Single query with JOIN for images
 */
export async function getComponentsByType(req, res) {
  try {
    const { type } = req.params; // type is category slug
    const db = getDb();

    // First get category by slug
    const [categoryRows] = await db.query(
      `SELECT id, name, slug FROM product_categories WHERE slug = ?`,
      [type]
    );

    if (categoryRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Component type not found',
        data: [],
      });
    }

    const categoryId = categoryRows[0].id;

    // Get all active products for this category
    const [productRows] = await db.query(
      `SELECT 
        p.id,
        p.name,
        p.slug,
        p.sku,
        p.price,
        p.discount_percentage,
        p.short_description,
        p.specifications,
        p.warranty_info,
        p.category_id,
        pc.name as category_name,
        pc.slug as category_slug
      FROM products p
      LEFT JOIN product_categories pc ON p.category_id = pc.id
      WHERE p.category_id = ? AND p.is_active = 1
      ORDER BY p.name ASC`,
      [categoryId]
    );

    // Fetch images for all products
    const productIds = productRows.map(row => row.id);
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

    // Calculate discounted prices and attach images
    const productsWithImages = productRows.map(product => {
      const originalPrice = parseFloat(product.price) || 0;
      const discountPercentage = parseFloat(product.discount_percentage) || 0;
      const discountedPrice = discountPercentage > 0 
        ? originalPrice * (1 - discountPercentage / 100)
        : originalPrice;

      // Parse specifications JSON if it exists
      let specifications = {};
      try {
        specifications = product.specifications ? JSON.parse(product.specifications) : {};
      } catch (e) {
        specifications = {};
      }

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        price: originalPrice,
        original_price: discountPercentage > 0 ? originalPrice : null,
        discounted_price: parseFloat(discountedPrice.toFixed(2)),
        discount_percentage: discountPercentage,
        short_description: product.short_description,
        specifications: specifications,
        warranty_info: product.warranty_info,
        category_id: product.category_id,
        category_name: product.category_name,
        category_slug: product.category_slug,
        images: imagesMap[product.id] || [],
        image_url: imagesMap[product.id]?.find(img => img.display_order === 0)?.image_url || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: productsWithImages,
    });
  } catch (err) {
    console.error('Get components by type error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch components',
    });
  }
}

/**
 * Get all active compatibility rules
 * SEO-optimized: Single query with index
 */
export async function getCompatibilityRules(req, res) {
  try {
    const db = getDb();

    const [rows] = await db.query(
      `SELECT 
        id,
        rule_type,
        category_id,
        rule_name,
        rule_config,
        error_message,
        is_active
      FROM pc_compatibility_rules
      WHERE is_active = 1
      ORDER BY rule_type, category_id ASC`
    );

    // Parse rule_config JSON
    const rules = rows.map(rule => ({
      ...rule,
      rule_config: rule.rule_config ? JSON.parse(rule.rule_config) : {},
    }));

    return res.status(200).json({
      success: true,
      data: rules,
    });
  } catch (err) {
    console.error('Get compatibility rules error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch compatibility rules',
    });
  }
}

/**
 * Validate PC build configuration against compatibility rules
 * This is the core validation engine
 */
export async function validateConfiguration(req, res) {
  try {
    const { configuration } = req.body; // { cpu: {id, ...}, ram: [{id, ...}], ... }
    
    if (!configuration || typeof configuration !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration',
        data: { valid: false, errors: [], warnings: [] },
      });
    }

    const db = getDb();

    // Get all active compatibility rules
    const [ruleRows] = await db.query(
      `SELECT 
        id,
        rule_type,
        category_id,
        rule_name,
        rule_config,
        error_message
      FROM pc_compatibility_rules
      WHERE is_active = 1`
    );

    const errors = [];
    const warnings = [];

    // Get product details for selected components
    const componentProductIds = [];
    Object.values(configuration).forEach(component => {
      if (Array.isArray(component)) {
        component.forEach(item => {
          if (item && item.id) componentProductIds.push(item.id);
        });
      } else if (component && component.id) {
        componentProductIds.push(component.id);
      }
    });

    let productDetailsMap = {};
    if (componentProductIds.length > 0) {
      const placeholders = componentProductIds.map(() => '?').join(',');
      const [productRows] = await db.query(
        `SELECT 
          p.id,
          p.category_id,
          p.specifications,
          pc.name as category_name
        FROM products p
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE p.id IN (${placeholders})`,
        componentProductIds
      );

      productRows.forEach(product => {
        let specs = {};
        try {
          specs = product.specifications ? JSON.parse(product.specifications) : {};
        } catch (e) {
          specs = {};
        }
        productDetailsMap[product.id] = {
          id: product.id,
          category_id: product.category_id,
          category_name: product.category_name,
          specifications: specs,
        };
      });
    }

    // Apply each rule
    ruleRows.forEach(rule => {
      let ruleConfig = {};
      try {
        ruleConfig = rule.rule_config ? JSON.parse(rule.rule_config) : {};
      } catch (e) {
        ruleConfig = {};
      }

      switch (rule.rule_type) {
        case 'max_quantity':
          validateMaxQuantity(rule, ruleConfig, configuration, errors);
          break;
        case 'socket_compatibility':
          validateSocketCompatibility(rule, ruleConfig, configuration, productDetailsMap, errors);
          break;
        case 'form_factor':
          validateFormFactor(rule, ruleConfig, configuration, productDetailsMap, errors);
          break;
        case 'power_requirement':
          validatePowerRequirement(rule, ruleConfig, configuration, productDetailsMap, errors, warnings);
          break;
        case 'memory_type':
          validateMemoryType(rule, ruleConfig, configuration, productDetailsMap, errors);
          break;
        case 'storage_interface':
          validateStorageInterface(rule, ruleConfig, configuration, productDetailsMap, errors);
          break;
        case 'custom':
          validateCustomRule(rule, ruleConfig, configuration, productDetailsMap, errors, warnings);
          break;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings,
      },
    });
  } catch (err) {
    console.error('Validate configuration error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to validate configuration',
      data: { valid: false, errors: ['Validation error occurred'], warnings: [] },
    });
  }
}

// Validation helper functions
function validateMaxQuantity(rule, ruleConfig, configuration, errors) {
  const { max_quantity, component_key } = ruleConfig;
  if (!max_quantity || !component_key) return;

  const component = configuration[component_key];
  if (component) {
    const count = Array.isArray(component) ? component.length : 1;
    if (count > max_quantity) {
      errors.push({
        rule_id: rule.id,
        rule_name: rule.rule_name,
        message: rule.error_message,
        component_key: component_key,
      });
    }
  }
}

function validateSocketCompatibility(rule, ruleConfig, configuration, productDetailsMap, errors) {
  const { cpu_key, motherboard_key, socket_field } = ruleConfig;
  if (!cpu_key || !motherboard_key || !socket_field) return;

  const cpu = configuration[cpu_key];
  const motherboard = configuration[motherboard_key];
  
  if (cpu && motherboard && cpu.id && motherboard.id) {
    const cpuDetails = productDetailsMap[cpu.id];
    const moboDetails = productDetailsMap[motherboard.id];
    
    if (cpuDetails && moboDetails) {
      const cpuSocket = cpuDetails.specifications[socket_field] || cpuDetails.specifications.socket;
      const moboSocket = moboDetails.specifications[socket_field] || moboDetails.specifications.socket;
      
      if (cpuSocket && moboSocket && cpuSocket !== moboSocket) {
        errors.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          message: rule.error_message,
          component_key: motherboard_key,
        });
      }
    }
  }
}

function validateFormFactor(rule, ruleConfig, configuration, productDetailsMap, errors) {
  const { motherboard_key, case_key, form_factor_field } = ruleConfig;
  if (!motherboard_key || !case_key || !form_factor_field) return;

  const motherboard = configuration[motherboard_key];
  const caseComponent = configuration[case_key];
  
  if (motherboard && caseComponent && motherboard.id && caseComponent.id) {
    const moboDetails = productDetailsMap[motherboard.id];
    const caseDetails = productDetailsMap[caseComponent.id];
    
    if (moboDetails && caseDetails) {
      const moboFormFactor = moboDetails.specifications[form_factor_field] || moboDetails.specifications.form_factor;
      const caseFormFactors = caseDetails.specifications.supported_form_factors || 
                             caseDetails.specifications.form_factors || 
                             [];
      
      if (moboFormFactor && caseFormFactors.length > 0) {
        const supported = Array.isArray(caseFormFactors) 
          ? caseFormFactors.includes(moboFormFactor)
          : false;
        
        if (!supported) {
          errors.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            message: rule.error_message,
            component_key: case_key,
          });
        }
      }
    }
  }
}

function validatePowerRequirement(rule, ruleConfig, configuration, productDetailsMap, errors, warnings) {
  const { psu_key, power_field, components } = ruleConfig;
  if (!psu_key || !power_field) return;

  const psu = configuration[psu_key];
  if (!psu || !psu.id) return;

  const psuDetails = productDetailsMap[psu.id];
  if (!psuDetails) return;

  const psuWattage = parseFloat(psuDetails.specifications[power_field] || psuDetails.specifications.wattage || 0);
  
  let totalPower = 0;
  const componentKeys = components || Object.keys(configuration);
  
  componentKeys.forEach(key => {
    if (key === psu_key) return; // Skip PSU itself
    
    const component = configuration[key];
    if (!component) return;

    const items = Array.isArray(component) ? component : [component];
    items.forEach(item => {
      if (item && item.id) {
        const details = productDetailsMap[item.id];
        if (details) {
          const power = parseFloat(details.specifications[power_field] || details.specifications.tdp || details.specifications.power_consumption || 0);
          totalPower += power;
        }
      }
    });
  });

  // Add 20% buffer for safety
  const requiredPower = totalPower * 1.2;

  if (psuWattage < totalPower) {
    errors.push({
      rule_id: rule.id,
      rule_name: rule.rule_name,
      message: rule.error_message,
      component_key: psu_key,
    });
  } else if (psuWattage < requiredPower) {
    warnings.push({
      rule_id: rule.id,
      rule_name: rule.rule_name,
      message: `PSU wattage (${psuWattage}W) is close to required power (${Math.ceil(requiredPower)}W). Consider a higher wattage PSU.`,
      component_key: psu_key,
    });
  }
}

function validateMemoryType(rule, ruleConfig, configuration, productDetailsMap, errors) {
  const { ram_key, motherboard_key, memory_type_field } = ruleConfig;
  if (!ram_key || !motherboard_key || !memory_type_field) return;

  const ram = configuration[ram_key];
  const motherboard = configuration[motherboard_key];
  
  if (!ram || !motherboard) return;

  const ramItems = Array.isArray(ram) ? ram : [ram];
  const moboDetails = motherboard.id ? productDetailsMap[motherboard.id] : null;
  
  if (!moboDetails) return;

  const supportedMemoryTypes = moboDetails.specifications.supported_memory_types || 
                               moboDetails.specifications.memory_types || 
                               [];
  
  ramItems.forEach(ramItem => {
    if (ramItem && ramItem.id) {
      const ramDetails = productDetailsMap[ramItem.id];
      if (ramDetails) {
        const ramType = ramDetails.specifications[memory_type_field] || 
                       ramDetails.specifications.memory_type || 
                       ramDetails.specifications.type;
        
        if (ramType && supportedMemoryTypes.length > 0) {
          const supported = Array.isArray(supportedMemoryTypes) 
            ? supportedMemoryTypes.includes(ramType)
            : false;
          
          if (!supported) {
            errors.push({
              rule_id: rule.id,
              rule_name: rule.rule_name,
              message: rule.error_message,
              component_key: ram_key,
            });
          }
        }
      }
    }
  });
}

function validateStorageInterface(rule, ruleConfig, configuration, productDetailsMap, errors) {
  const { storage_key, motherboard_key, interface_field } = ruleConfig;
  if (!storage_key || !motherboard_key || !interface_field) return;

  const storage = configuration[storage_key];
  const motherboard = configuration[motherboard_key];
  
  if (!storage || !motherboard) return;

  const storageItems = Array.isArray(storage) ? storage : [storage];
  const moboDetails = motherboard.id ? productDetailsMap[motherboard.id] : null;
  
  if (!moboDetails) return;

  const supportedInterfaces = moboDetails.specifications.supported_storage_interfaces || 
                              moboDetails.specifications.storage_interfaces || 
                              [];
  
  storageItems.forEach(storageItem => {
    if (storageItem && storageItem.id) {
      const storageDetails = productDetailsMap[storageItem.id];
      if (storageDetails) {
        const storageInterface = storageDetails.specifications[interface_field] || 
                                 storageDetails.specifications.interface || 
                                 storageDetails.specifications.connection;
        
        if (storageInterface && supportedInterfaces.length > 0) {
          const supported = Array.isArray(supportedInterfaces) 
            ? supportedInterfaces.includes(storageInterface)
            : false;
          
          if (!supported) {
            errors.push({
              rule_id: rule.id,
              rule_name: rule.rule_name,
              message: rule.error_message,
              component_key: storage_key,
            });
          }
        }
      }
    }
  });
}

function validateCustomRule(rule, ruleConfig, configuration, productDetailsMap, errors, warnings) {
  // Custom rules can be extended based on rule_config JSON structure
  // This is a placeholder for future custom validation logic
  const { validation_logic, severity } = ruleConfig;
  
  if (validation_logic === 'example_custom_rule') {
    // Example: Add custom validation here
    // For now, this is extensible for future rules
  }
}

/**
 * Calculate total price for PC build configuration
 * Server-side calculation for data integrity
 */
export async function calculatePrice(req, res) {
  try {
    const { configuration } = req.body;
    
    if (!configuration || typeof configuration !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration',
        data: { subtotal: 0, total: 0, breakdown: [] },
      });
    }

    const db = getDb();

    // Get all product IDs from configuration
    const productIds = [];
    Object.values(configuration).forEach(component => {
      if (Array.isArray(component)) {
        component.forEach(item => {
          if (item && item.id) productIds.push(item.id);
        });
      } else if (component && component.id) {
        productIds.push(component.id);
      }
    });

    if (productIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: { subtotal: 0, total: 0, breakdown: [] },
      });
    }

    // Fetch prices for all products
    const placeholders = productIds.map(() => '?').join(',');
    const [productRows] = await db.query(
      `SELECT 
        id,
        price,
        discount_percentage
      FROM products
      WHERE id IN (${placeholders})`,
      productIds
    );

    const priceMap = {};
    productRows.forEach(product => {
      const originalPrice = parseFloat(product.price) || 0;
      const discountPercentage = parseFloat(product.discount_percentage) || 0;
      const discountedPrice = discountPercentage > 0 
        ? originalPrice * (1 - discountPercentage / 100)
        : originalPrice;
      
      priceMap[product.id] = {
        original_price: originalPrice,
        discounted_price: parseFloat(discountedPrice.toFixed(2)),
        discount_percentage: discountPercentage,
      };
    });

    // Calculate breakdown and total
    let subtotal = 0;
    const breakdown = [];

    Object.entries(configuration).forEach(([componentKey, component]) => {
      if (!component) return;

      const items = Array.isArray(component) ? component : [component];
      items.forEach(item => {
        if (item && item.id && priceMap[item.id]) {
          const priceInfo = priceMap[item.id];
          const itemTotal = priceInfo.discounted_price;
          subtotal += itemTotal;

          breakdown.push({
            component_key: componentKey,
            product_id: item.id,
            product_name: item.name || 'Unknown',
            quantity: 1,
            unit_price: priceInfo.discounted_price,
            original_price: priceInfo.original_price,
            discount_percentage: priceInfo.discount_percentage,
            total: itemTotal,
          });
        }
      });
    });

    const total = parseFloat(subtotal.toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        subtotal: total,
        total: total,
        breakdown: breakdown,
      },
    });
  } catch (err) {
    console.error('Calculate price error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to calculate price',
      data: { subtotal: 0, total: 0, breakdown: [] },
    });
  }
}

/**
 * Checkout PC build - Save build and add to cart
 * Requires authentication
 * SEO-optimized: Transaction-based, atomic operations
 */
export async function checkoutBuild(req, res) {
  const db = getDb();
  
  await db.query('START TRANSACTION');
  
  try {
    const { configuration, total_price } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      await db.query('ROLLBACK');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    if (!configuration || typeof configuration !== 'object') {
      await db.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration',
      });
    }
    
    // Step 1: Save custom PC build
    const finalPrice = parseFloat(total_price) || 0;
    const [buildResult] = await db.query(
      `INSERT INTO custom_pc_builds (user_id, total_estimated_price, configuration_data)
       VALUES (?, ?, ?)`,
      [userId, finalPrice, JSON.stringify(configuration)]
    );
    
    const customBuildId = buildResult.insertId;
    
    // Step 2: Get or create cart for user
    const [cartRows] = await db.query(
      'SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
      [userId]
    );
    
    let cart;
    if (cartRows.length > 0) {
      cart = cartRows[0];
    } else {
      const [cartResult] = await db.query(
        `INSERT INTO carts (user_id, subtotal, discount_amount, total_amount) 
         VALUES (?, 0.00, 0.00, 0.00)`,
        [userId]
      );
      const [newCartRows] = await db.query(
        'SELECT * FROM carts WHERE id = ? LIMIT 1',
        [cartResult.insertId]
      );
      cart = newCartRows[0];
    }
    
    // Step 3: Add custom PC build to cart
    await db.query(
      `INSERT INTO cart_items (cart_id, custom_build_id, quantity, price_at_added, discounted_price)
       VALUES (?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
      [cart.id, customBuildId, finalPrice, finalPrice]
    );
    
    // Step 4: Recalculate cart totals
    const [itemRows] = await db.query(
      `SELECT 
        COALESCE(SUM(ci.discounted_price * ci.quantity), 0) as subtotal
      FROM cart_items ci
      WHERE ci.cart_id = ?`,
      [cart.id]
    );
    
    const subtotal = parseFloat(itemRows[0]?.subtotal || 0);
    const discountAmount = parseFloat(cart.discount_amount || 0);
    const totalAmount = subtotal - discountAmount;
    
    await db.query(
      `UPDATE carts 
       SET subtotal = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [subtotal, totalAmount, cart.id]
    );
    
    await db.query('COMMIT');
    
    return res.status(200).json({
      success: true,
      message: 'PC build added to cart successfully',
      data: {
        custom_build_id: customBuildId,
        cart_id: cart.id,
      },
    });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('Checkout build error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to checkout PC build',
    });
  }
}

/**
 * Save PC build configuration
 * Stores build in custom_pc_builds table
 */
export async function saveBuild(req, res) {
  try {
    const { configuration, total_estimated_price } = req.body;
    const userId = req.user?.id || null; // Optional: can be null for guest builds
    
    if (!configuration || typeof configuration !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration',
      });
    }

    const db = getDb();

    // Calculate total if not provided
    let finalPrice = total_estimated_price;
    if (!finalPrice) {
      // Quick price calculation
      const productIds = [];
      Object.values(configuration).forEach(component => {
        if (Array.isArray(component)) {
          component.forEach(item => {
            if (item && item.id) productIds.push(item.id);
          });
        } else if (component && component.id) {
          productIds.push(component.id);
        }
      });

      if (productIds.length > 0) {
        const placeholders = productIds.map(() => '?').join(',');
        const [productRows] = await db.query(
          `SELECT id, price, discount_percentage FROM products WHERE id IN (${placeholders})`,
          productIds
        );

        let total = 0;
        productRows.forEach(product => {
          const originalPrice = parseFloat(product.price) || 0;
          const discountPercentage = parseFloat(product.discount_percentage) || 0;
          const discountedPrice = discountPercentage > 0 
            ? originalPrice * (1 - discountPercentage / 100)
            : originalPrice;
          total += discountedPrice;
        });
        finalPrice = parseFloat(total.toFixed(2));
      }
    }

    // Save to database
    const [result] = await db.query(
      `INSERT INTO custom_pc_builds (user_id, total_estimated_price, configuration_data)
       VALUES (?, ?, ?)`,
      [userId, finalPrice, JSON.stringify(configuration)]
    );

    return res.status(201).json({
      success: true,
      message: 'Build saved successfully',
      data: {
        id: result.insertId,
        total_estimated_price: finalPrice,
      },
    });
  } catch (err) {
    console.error('Save build error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to save build',
    });
  }
}

