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
 * Get all compatibility rules with filtering and pagination
 * Admin only - requires authentication
 */
export async function getAllCompatibilityRules(req, res) {
  try {
    const db = getDb();
    const {
      rule_type,
      category_id,
      is_active,
      search,
      page = 1,
      limit = 50,
      sort = 'created_at',
      order = 'DESC',
    } = req.query;

    // Build WHERE clause
    const whereConditions = [];
    const queryParams = [];

    if (rule_type) {
      whereConditions.push('pcr.rule_type = ?');
      queryParams.push(rule_type);
    }

    if (category_id) {
      whereConditions.push('pcr.category_id = ?');
      queryParams.push(category_id);
    }

    if (is_active !== undefined) {
      whereConditions.push('pcr.is_active = ?');
      queryParams.push(is_active === 'true' ? 1 : 0);
    }

    if (search) {
      whereConditions.push('(pcr.rule_name LIKE ? OR pcr.error_message LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort and order
    const allowedSortFields = ['created_at', 'updated_at', 'rule_name', 'rule_type', 'id'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get compatibility rules with category info
    const [ruleRows] = await db.query(
      `SELECT 
        pcr.id,
        pcr.rule_type,
        pcr.category_id,
        pcr.rule_name,
        pcr.rule_config,
        pcr.error_message,
        pcr.is_active,
        pcr.created_at,
        pcr.updated_at,
        pc.name as category_name,
        pc.slug as category_slug
      FROM pc_compatibility_rules pcr
      LEFT JOIN product_categories pc ON pcr.category_id = pc.id
      ${whereClause}
      ORDER BY pcr.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
      FROM pc_compatibility_rules pcr
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Format rules - parse JSON rule_config
    const rules = ruleRows.map(rule => {
      let ruleConfig = null;
      if (rule.rule_config) {
        if (typeof rule.rule_config === 'string') {
          try {
            ruleConfig = JSON.parse(rule.rule_config);
          } catch (e) {
            ruleConfig = null;
          }
        } else {
          ruleConfig = rule.rule_config;
        }
      }

      return {
        id: rule.id,
        rule_type: rule.rule_type,
        category_id: rule.category_id,
        category_name: rule.category_name,
        category_slug: rule.category_slug,
        rule_name: rule.rule_name,
        rule_config: ruleConfig,
        error_message: rule.error_message,
        is_active: rule.is_active === 1,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      };
    });

    return res.status(200).json({
      success: true,
      data: rules,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch compatibility rules');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get compatibility rule by ID
 * Admin only - includes full rule details
 */
export async function getCompatibilityRuleById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    const [ruleRows] = await db.query(
      `SELECT 
        pcr.id,
        pcr.rule_type,
        pcr.category_id,
        pcr.rule_name,
        pcr.rule_config,
        pcr.error_message,
        pcr.is_active,
        pcr.created_at,
        pcr.updated_at,
        pc.name as category_name,
        pc.slug as category_slug
      FROM pc_compatibility_rules pcr
      LEFT JOIN product_categories pc ON pcr.category_id = pc.id
      WHERE pcr.id = ?`,
      [id]
    );

    if (ruleRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Compatibility rule not found',
      });
    }

    const rule = ruleRows[0];
    let ruleConfig = null;
    if (rule.rule_config) {
      if (typeof rule.rule_config === 'string') {
        try {
          ruleConfig = JSON.parse(rule.rule_config);
        } catch (e) {
          ruleConfig = null;
        }
      } else {
        ruleConfig = rule.rule_config;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: rule.id,
        rule_type: rule.rule_type,
        category_id: rule.category_id,
        category_name: rule.category_name,
        category_slug: rule.category_slug,
        rule_name: rule.rule_name,
        rule_config: ruleConfig,
        error_message: rule.error_message,
        is_active: rule.is_active === 1,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch compatibility rule');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Create compatibility rule
 * Admin only - creates a new compatibility rule
 */
export async function createCompatibilityRule(req, res) {
  try {
    const db = getDb();
    const {
      rule_type,
      category_id,
      rule_name,
      rule_config,
      error_message,
      is_active = true,
    } = req.body;

    // Validation
    const validRuleTypes = ['max_quantity', 'socket_compatibility', 'form_factor', 'power_requirement', 'memory_type', 'storage_interface', 'custom'];
    if (!rule_type || !validRuleTypes.includes(rule_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid rule_type. Must be one of: ${validRuleTypes.join(', ')}`,
      });
    }

    if (!rule_name || !rule_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'rule_name is required',
      });
    }

    if (!rule_config || typeof rule_config !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'rule_config must be a valid JSON object',
      });
    }

    if (!error_message || !error_message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'error_message is required',
      });
    }

    // Validate category_id if provided
    if (category_id) {
      const [categoryRows] = await db.query(
        'SELECT id FROM product_categories WHERE id = ?',
        [category_id]
      );
      if (categoryRows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category_id',
        });
      }
    }

    // Insert rule
    const [result] = await db.query(
      `INSERT INTO pc_compatibility_rules 
        (rule_type, category_id, rule_name, rule_config, error_message, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        rule_type,
        category_id || null,
        rule_name.trim(),
        JSON.stringify(rule_config),
        error_message.trim(),
        is_active ? 1 : 0,
      ]
    );

    // Fetch created rule
    const [ruleRows] = await db.query(
      `SELECT 
        pcr.id,
        pcr.rule_type,
        pcr.category_id,
        pcr.rule_name,
        pcr.rule_config,
        pcr.error_message,
        pcr.is_active,
        pcr.created_at,
        pcr.updated_at,
        pc.name as category_name,
        pc.slug as category_slug
      FROM pc_compatibility_rules pcr
      LEFT JOIN product_categories pc ON pcr.category_id = pc.id
      WHERE pcr.id = ?`,
      [result.insertId]
    );

    const rule = ruleRows[0];
    let ruleConfig = null;
    if (rule.rule_config) {
      if (typeof rule.rule_config === 'string') {
        try {
          ruleConfig = JSON.parse(rule.rule_config);
        } catch (e) {
          ruleConfig = null;
        }
      } else {
        ruleConfig = rule.rule_config;
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        id: rule.id,
        rule_type: rule.rule_type,
        category_id: rule.category_id,
        category_name: rule.category_name,
        category_slug: rule.category_slug,
        rule_name: rule.rule_name,
        rule_config: ruleConfig,
        error_message: rule.error_message,
        is_active: rule.is_active === 1,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      },
      message: 'Compatibility rule created successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to create compatibility rule');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update compatibility rule
 * Admin only - updates an existing compatibility rule
 */
export async function updateCompatibilityRule(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;
    const {
      rule_type,
      category_id,
      rule_name,
      rule_config,
      error_message,
      is_active,
    } = req.body;

    // Check if rule exists
    const [existingRows] = await db.query(
      'SELECT id FROM pc_compatibility_rules WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Compatibility rule not found',
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (rule_type !== undefined) {
      const validRuleTypes = ['max_quantity', 'socket_compatibility', 'form_factor', 'power_requirement', 'memory_type', 'storage_interface', 'custom'];
      if (!validRuleTypes.includes(rule_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid rule_type. Must be one of: ${validRuleTypes.join(', ')}`,
        });
      }
      updates.push('rule_type = ?');
      values.push(rule_type);
    }

    if (category_id !== undefined) {
      if (category_id === null || category_id === '') {
        updates.push('category_id = NULL');
      } else {
        // Validate category_id
        const [categoryRows] = await db.query(
          'SELECT id FROM product_categories WHERE id = ?',
          [category_id]
        );
        if (categoryRows.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid category_id',
          });
        }
        updates.push('category_id = ?');
        values.push(category_id);
      }
    }

    if (rule_name !== undefined) {
      if (!rule_name || !rule_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'rule_name cannot be empty',
        });
      }
      updates.push('rule_name = ?');
      values.push(rule_name.trim());
    }

    if (rule_config !== undefined) {
      if (typeof rule_config !== 'object') {
        return res.status(400).json({
          success: false,
          message: 'rule_config must be a valid JSON object',
        });
      }
      updates.push('rule_config = ?');
      values.push(JSON.stringify(rule_config));
    }

    if (error_message !== undefined) {
      if (!error_message || !error_message.trim()) {
        return res.status(400).json({
          success: false,
          message: 'error_message cannot be empty',
        });
      }
      updates.push('error_message = ?');
      values.push(error_message.trim());
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    values.push(id);

    // Update rule
    await db.query(
      `UPDATE pc_compatibility_rules SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated rule
    const [ruleRows] = await db.query(
      `SELECT 
        pcr.id,
        pcr.rule_type,
        pcr.category_id,
        pcr.rule_name,
        pcr.rule_config,
        pcr.error_message,
        pcr.is_active,
        pcr.created_at,
        pcr.updated_at,
        pc.name as category_name,
        pc.slug as category_slug
      FROM pc_compatibility_rules pcr
      LEFT JOIN product_categories pc ON pcr.category_id = pc.id
      WHERE pcr.id = ?`,
      [id]
    );

    const rule = ruleRows[0];
    let ruleConfig = null;
    if (rule.rule_config) {
      if (typeof rule.rule_config === 'string') {
        try {
          ruleConfig = JSON.parse(rule.rule_config);
        } catch (e) {
          ruleConfig = null;
        }
      } else {
        ruleConfig = rule.rule_config;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: rule.id,
        rule_type: rule.rule_type,
        category_id: rule.category_id,
        category_name: rule.category_name,
        category_slug: rule.category_slug,
        rule_name: rule.rule_name,
        rule_config: ruleConfig,
        error_message: rule.error_message,
        is_active: rule.is_active === 1,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      },
      message: 'Compatibility rule updated successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update compatibility rule');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Delete compatibility rule
 * Admin only - deletes a compatibility rule
 */
export async function deleteCompatibilityRule(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    // Check if rule exists
    const [existingRows] = await db.query(
      'SELECT id FROM pc_compatibility_rules WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Compatibility rule not found',
      });
    }

    // Delete rule
    await db.query('DELETE FROM pc_compatibility_rules WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Compatibility rule deleted successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to delete compatibility rule');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get all custom PC builds with filtering and pagination
 * Admin only - includes user info and build details
 */
export async function getAllCustomPCBuilds(req, res) {
  try {
    const db = getDb();
    const {
      user_id,
      search,
      page = 1,
      limit = 50,
      sort = 'created_at',
      order = 'DESC',
    } = req.query;

    // Build WHERE clause
    const whereConditions = [];
    const queryParams = [];

    if (user_id) {
      whereConditions.push('cpb.user_id = ?');
      queryParams.push(user_id);
    }

    if (search) {
      whereConditions.push('(u.full_name LIKE ? OR u.email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Validate sort and order
    const allowedSortFields = ['created_at', 'total_estimated_price', 'id'];
    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Calculate pagination
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const offset = (pageNum - 1) * limitNum;

    // Main query to get custom PC builds with user info
    const [buildRows] = await db.query(
      `SELECT 
        cpb.id,
        cpb.user_id,
        cpb.total_estimated_price,
        cpb.configuration_data,
        cpb.created_at,
        u.full_name as user_name,
        u.email as user_email
      FROM custom_pc_builds cpb
      LEFT JOIN users u ON cpb.user_id = u.id
      ${whereClause}
      ORDER BY cpb.${sortField} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...queryParams, limitNum, offset]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total
      FROM custom_pc_builds cpb
      LEFT JOIN users u ON cpb.user_id = u.id
      ${whereClause}`,
      queryParams
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    // Format builds - parse JSON configuration_data
    const builds = buildRows.map(build => {
      let configData = null;
      if (build.configuration_data) {
        if (typeof build.configuration_data === 'string') {
          try {
            configData = JSON.parse(build.configuration_data);
          } catch (e) {
            configData = null;
          }
        } else {
          configData = build.configuration_data;
        }
      }

      return {
        id: build.id,
        user_id: build.user_id,
        user_name: build.user_name,
        user_email: build.user_email,
        total_estimated_price: parseFloat(build.total_estimated_price) || 0,
        configuration_data: configData,
        created_at: build.created_at,
      };
    });

    return res.status(200).json({
      success: true,
      data: builds,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch custom PC builds');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Get custom PC build by ID with full details
 * Admin only - includes user info and full configuration
 */
export async function getCustomPCBuildById(req, res) {
  try {
    const db = getDb();
    const { id } = req.params;

    const [buildRows] = await db.query(
      `SELECT 
        cpb.id,
        cpb.user_id,
        cpb.total_estimated_price,
        cpb.configuration_data,
        cpb.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.phone_number as user_phone
      FROM custom_pc_builds cpb
      LEFT JOIN users u ON cpb.user_id = u.id
      WHERE cpb.id = ?`,
      [id]
    );

    if (buildRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Custom PC build not found',
      });
    }

    const build = buildRows[0];
    let configData = null;
    if (build.configuration_data) {
      if (typeof build.configuration_data === 'string') {
        try {
          configData = JSON.parse(build.configuration_data);
        } catch (e) {
          configData = null;
        }
      } else {
        configData = build.configuration_data;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: build.id,
        user_id: build.user_id,
        user: build.user_id ? {
          name: build.user_name,
          email: build.user_email,
          phone: build.user_phone,
        } : null,
        total_estimated_price: parseFloat(build.total_estimated_price) || 0,
        configuration_data: configData,
        created_at: build.created_at,
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch custom PC build');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

