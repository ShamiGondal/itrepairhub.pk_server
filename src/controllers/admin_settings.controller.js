import bcrypt from 'bcryptjs';
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
 * Get admin profile
 * Admin only - returns current admin user information
 */
export async function getAdminProfile(req, res) {
  try {
    const db = getDb();
    const userId = req.user.id;

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
      WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userRows[0];

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
      },
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to fetch admin profile');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Update admin profile
 * Admin only - allows updating full_name and phone_number
 */
export async function updateAdminProfile(req, res) {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { full_name, phone_number } = req.body;

    // Validation
    if (!full_name && !phone_number) {
      return res.status(400).json({
        success: false,
        message: 'At least one field (full_name or phone_number) must be provided',
      });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (full_name !== undefined) {
      if (!full_name || !full_name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'full_name cannot be empty',
        });
      }
      updates.push('full_name = ?');
      values.push(full_name.trim());
    }

    if (phone_number !== undefined) {
      // Allow null for phone_number (optional field)
      if (phone_number === null || phone_number === '') {
        updates.push('phone_number = NULL');
      } else {
        updates.push('phone_number = ?');
        values.push(phone_number.trim());
      }
    }

    values.push(userId);

    // Update profile
    await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Fetch updated profile
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
      WHERE id = ? LIMIT 1`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      data: {
        id: userRows[0].id,
        full_name: userRows[0].full_name,
        email: userRows[0].email,
        phone_number: userRows[0].phone_number,
        role: userRows[0].role,
        auth_provider: userRows[0].auth_provider,
        created_at: userRows[0].created_at,
      },
      message: 'Profile updated successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to update admin profile');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

/**
 * Change admin password
 * Admin only - allows changing password (only for local auth users)
 */
export async function changeAdminPassword(req, res) {
  try {
    const db = getDb();
    const userId = req.user.id;
    const { current_password, new_password } = req.body;

    // Validation
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'current_password and new_password are required',
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long',
      });
    }

    // Get current user info
    const [userRows] = await db.query(
      'SELECT id, password_hash, auth_provider FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userRows[0];

    // Check if user is using local authentication
    if (user.auth_provider !== 'local') {
      return res.status(400).json({
        success: false,
        message: `Password change is not available for ${user.auth_provider} authenticated users`,
      });
    }

    // Verify current password
    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'No password set for this account',
      });
    }

    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, userId]
    );

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err) {
    const errorResponse = handleDbError(err, 'Failed to change password');
    return res.status(errorResponse.status).json(errorResponse.response);
  }
}

