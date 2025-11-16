import { getDb } from '../config/db.config.js';

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
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
}

export async function updateMe(req, res) {
  try {
    const { full_name, phone_number } = req.body;
    if (!full_name && !phone_number) {
      return res
        .status(400)
        .json({ success: false, message: 'Nothing to update (full_name or phone_number required)' });
    }

    const db = getDb();

    await db.query(
      'UPDATE users SET full_name = COALESCE(?, full_name), phone_number = COALESCE(?, phone_number) WHERE id = ?',
      [full_name || null, phone_number || null, req.user.id]
    );

    const [rows] = await db.query(
      'SELECT id, full_name, email, phone_number, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
}

export async function getMyAddresses(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, label, line_1, line_2, city, state, postal_code, created_at FROM addresses WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
}

export async function addMyAddress(req, res) {
  try {
    const { label, line_1, line_2, city, state, postal_code } = req.body;
    if (!line_1 || !city || !postal_code) {
      return res
        .status(400)
        .json({ success: false, message: 'line_1, city, and postal_code are required' });
    }

    const db = getDb();
    const [result] = await db.query(
      'INSERT INTO addresses (user_id, label, line_1, line_2, city, state, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, label || null, line_1, line_2 || null, city, state || null, postal_code]
    );

    const [rows] = await db.query(
      'SELECT id, label, line_1, line_2, city, state, postal_code, created_at FROM addresses WHERE id = ? AND user_id = ? LIMIT 1',
      [result.insertId, req.user.id]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to add address' });
  }
}

export async function deleteMyAddress(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [result] = await db.query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [
      id,
      req.user.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Address not found' });
    }

    return res.status(200).json({ success: true, message: 'Address deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete address' });
  }
}


