import { getDb } from '../config/db.config.js';
import { deleteFile } from '../utils/uploadthing.js';

/**
 * Get all media items
 * SEO-optimized: Fast query with indexed fields, returns only necessary data
 * Response time target: < 200ms
 */
export async function getAllMedia(req, res) {
  try {
    const { section, media_type, is_active, device_version, limit = 50, offset = 0 } = req.query;
    const db = getDb();

    let query = 'SELECT id, media_type, url, alt_text, section, device_version, title, display_order, is_active, created_at FROM site_media WHERE 1=1';
    const params = [];

    if (section) {
      query += ' AND section = ?';
      params.push(section);
    }

    if (media_type) {
      query += ' AND media_type = ?';
      params.push(media_type);
    }

    if (is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(is_active === 'true' || is_active === '1');
    }

    if (device_version) {
      // Show media for 'all' devices OR the specific device_version
      query += ' AND (device_version = ? OR device_version = ?)';
      params.push('all', device_version);
    }

    query += ' ORDER BY section, display_order ASC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: rows.length,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch media' });
  }
}

/**
 * Get media by ID
 * SEO-optimized: Single indexed lookup
 */
export async function getMediaById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [rows] = await db.query(
      'SELECT id, media_type, url, alt_text, section, device_version, title, display_order, is_active, created_at FROM site_media WHERE id = ? LIMIT 1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch media' });
  }
}

/**
 * Get media by section
 * SEO-optimized: Indexed section lookup, ordered by display_order
 * Used for hero sliders, category images, etc.
 */
export async function getMediaBySection(req, res) {
  try {
    const { section } = req.params;
    const { is_active = true, device_version } = req.query;
    const db = getDb();

    let query = 'SELECT id, media_type, url, alt_text, section, device_version, title, display_order, is_active, created_at FROM site_media WHERE section = ? AND is_active = ?';
    const params = [section, is_active === 'true' || is_active === '1'];

    // Filter by device_version if provided
    if (device_version) {
      // Show media for 'all' devices OR the specific device_version
      query += ' AND (device_version = ? OR device_version = ?)';
      params.push('all', device_version);
    }

    query += ' ORDER BY display_order ASC, created_at DESC';

    const [rows] = await db.query(query, params);

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch media by section' });
  }
}

/**
 * Create new media item
 * Admin only - requires authentication
 * SEO: Validates alt_text for image SEO
 */
export async function createMedia(req, res) {
  try {
    const { media_type, url, alt_text, section, title, display_order, is_active, device_version } = req.body;

    // Validation
    if (!media_type || !url || !section) {
      return res.status(400).json({
        success: false,
        message: 'media_type, url, and section are required',
      });
    }

    if (!['image', 'video'].includes(media_type)) {
      return res.status(400).json({
        success: false,
        message: 'media_type must be "image" or "video"',
      });
    }

    if (device_version && !['desktop', 'mobile', 'all'].includes(device_version)) {
      return res.status(400).json({
        success: false,
        message: 'device_version must be "desktop", "mobile", or "all"',
      });
    }

    // SEO: alt_text is required for images
    if (media_type === 'image' && !alt_text) {
      return res.status(400).json({
        success: false,
        message: 'alt_text is required for images (SEO requirement)',
      });
    }

    const db = getDb();

    const [result] = await db.query(
      'INSERT INTO site_media (media_type, url, alt_text, section, device_version, title, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        media_type,
        url,
        alt_text || null,
        section,
        device_version || 'all',
        title || null,
        display_order || 0,
        is_active !== undefined ? is_active : true,
      ]
    );

    const [rows] = await db.query(
      'SELECT id, media_type, url, alt_text, section, device_version, title, display_order, is_active, created_at FROM site_media WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Media with this URL already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create media' });
  }
}

/**
 * Update media item
 * Admin only - requires authentication
 * SEO: Validates alt_text updates for images
 */
export async function updateMedia(req, res) {
  try {
    const { id } = req.params;
    const { url, alt_text, section, title, display_order, is_active, device_version } = req.body;

    // Validate device_version if provided
    if (device_version && !['desktop', 'mobile', 'all'].includes(device_version)) {
      return res.status(400).json({
        success: false,
        message: 'device_version must be "desktop", "mobile", or "all"',
      });
    }

    const db = getDb();

    // First, get current media to check media_type
    const [currentRows] = await db.query(
      'SELECT media_type FROM site_media WHERE id = ? LIMIT 1',
      [id]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    const currentMediaType = currentRows[0].media_type;

    // SEO: If updating to image without alt_text, validate
    if (currentMediaType === 'image' && alt_text === '') {
      return res.status(400).json({
        success: false,
        message: 'alt_text cannot be empty for images (SEO requirement)',
      });
    }

    // Build update query dynamically
    const updates = [];
    const params = [];

    if (url !== undefined) {
      updates.push('url = ?');
      params.push(url);
    }

    if (alt_text !== undefined) {
      updates.push('alt_text = ?');
      params.push(alt_text);
    }

    if (section !== undefined) {
      updates.push('section = ?');
      params.push(section);
    }

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }

    if (display_order !== undefined) {
      updates.push('display_order = ?');
      params.push(display_order);
    }

    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active);
    }

    if (device_version !== undefined) {
      updates.push('device_version = ?');
      params.push(device_version);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(id);

    await db.query(`UPDATE site_media SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await db.query(
      'SELECT id, media_type, url, alt_text, section, device_version, title, display_order, is_active, created_at FROM site_media WHERE id = ? LIMIT 1',
      [id]
    );

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update media' });
  }
}

/**
 * Delete media item
 * Admin only - requires authentication
 * Also deletes the file from UploadThing CDN
 */
export async function deleteMedia(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    // First, get the media to extract file URL/key
    const [mediaRows] = await db.query(
      'SELECT url FROM site_media WHERE id = ? LIMIT 1',
      [id]
    );

    if (mediaRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    const mediaUrl = mediaRows[0].url;

    // Delete from database
    const [result] = await db.query('DELETE FROM site_media WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    // Try to delete from UploadThing (non-blocking, log errors but don't fail)
    if (mediaUrl && mediaUrl.includes('uploadthing.com')) {
      try {
        // Extract key from URL
        const urlObj = new URL(mediaUrl);
        const pathParts = urlObj.pathname.split('/');
        const fileKey = pathParts[pathParts.length - 1];
        
        if (fileKey) {
          await deleteFile(fileKey);
        }
      } catch (deleteError) {
        // Continue - file deleted from DB, UploadThing cleanup is optional
      }
    }

    return res.status(200).json({ success: true, message: 'Media deleted successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete media' });
  }
}

/**
 * Bulk update display order
 * Admin only - for reordering media in sections
 */
export async function updateDisplayOrder(req, res) {
  try {
    const { items } = req.body; // Array of { id, display_order }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'items array is required with id and display_order',
      });
    }

    const db = getDb();

    // Use transaction for bulk update
    await db.query('START TRANSACTION');

    try {
      for (const item of items) {
        if (!item.id || item.display_order === undefined) {
          throw new Error('Each item must have id and display_order');
        }
        await db.query('UPDATE site_media SET display_order = ? WHERE id = ?', [
          item.display_order,
          item.id,
        ]);
      }

      await db.query('COMMIT');

      return res.status(200).json({ success: true, message: 'Display order updated successfully' });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update display order' });
  }
}

