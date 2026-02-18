import { getDb } from '../config/db.config.js';

const PLACEMENTS = ['sidebar', 'in_content_top', 'in_content_mid', 'in_content_bottom'];

/**
 * List all blog ads
 * GET /v1/admin/blog/ads
 */
export async function getAllAds(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      `SELECT id, image_url, redirect_url, alt_text, placement, display_order, is_active, created_at, updated_at
       FROM blog_ads
       ORDER BY placement, display_order ASC, id ASC`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Get blog ads error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch ads' });
  }
}

/**
 * Get single ad by ID
 * GET /v1/admin/blog/ads/:id
 */
export async function getAdById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, image_url, redirect_url, alt_text, placement, display_order, is_active, created_at, updated_at FROM blog_ads WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get blog ad error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch ad' });
  }
}

/**
 * Create new ad
 * POST /v1/admin/blog/ads
 */
export async function createAd(req, res) {
  try {
    const { image_url, redirect_url, alt_text, placement, display_order, is_active } = req.body;

    if (!image_url?.trim() || !redirect_url?.trim()) {
      return res.status(400).json({ success: false, message: 'image_url and redirect_url are required' });
    }
    if (!placement || !PLACEMENTS.includes(placement)) {
      return res.status(400).json({ success: false, message: `placement must be one of: ${PLACEMENTS.join(', ')}` });
    }

    const db = getDb();
    const [result] = await db.query(
      'INSERT INTO blog_ads (image_url, redirect_url, alt_text, placement, display_order, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [
        image_url.trim(),
        redirect_url.trim(),
        alt_text?.trim() || null,
        placement,
        display_order !== undefined ? parseInt(display_order) : 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );

    const [rows] = await db.query(
      'SELECT id, image_url, redirect_url, alt_text, placement, display_order, is_active, created_at, updated_at FROM blog_ads WHERE id = ?',
      [result.insertId]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Create blog ad error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create ad' });
  }
}

/**
 * Update ad
 * PUT /v1/admin/blog/ads/:id
 */
export async function updateAd(req, res) {
  try {
    const { id } = req.params;
    const { image_url, redirect_url, alt_text, placement, display_order, is_active } = req.body;
    const db = getDb();

    const [existing] = await db.query('SELECT * FROM blog_ads WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    const e = existing[0];

    const updates = [];
    const params = [];

    if (image_url !== undefined) {
      updates.push('image_url = ?');
      params.push(image_url.trim());
    }
    if (redirect_url !== undefined) {
      updates.push('redirect_url = ?');
      params.push(redirect_url.trim());
    }
    if (alt_text !== undefined) {
      updates.push('alt_text = ?');
      params.push(alt_text?.trim() || null);
    }
    if (placement !== undefined) {
      if (!PLACEMENTS.includes(placement)) {
        return res.status(400).json({ success: false, message: `placement must be one of: ${PLACEMENTS.join(', ')}` });
      }
      updates.push('placement = ?');
      params.push(placement);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      params.push(parseInt(display_order));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(200).json({ success: true, data: e });
    }

    params.push(id);
    await db.query(`UPDATE blog_ads SET ${updates.join(', ')} WHERE id = ?`, params);

    const [rows] = await db.query(
      'SELECT id, image_url, redirect_url, alt_text, placement, display_order, is_active, created_at, updated_at FROM blog_ads WHERE id = ?',
      [id]
    );
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Update blog ad error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update ad' });
  }
}

/**
 * Delete ad
 * DELETE /v1/admin/blog/ads/:id
 */
export async function deleteAd(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [result] = await db.query('DELETE FROM blog_ads WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }
    return res.status(200).json({ success: true, message: 'Ad deleted' });
  } catch (err) {
    console.error('Delete blog ad error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete ad' });
  }
}

/**
 * Set ads for a post (replace all assignments)
 * PUT /v1/admin/blog/posts/:id/ads
 * Body: { ad_ids: [{ ad_id: number, display_order: number }, ...] }
 */
export async function setPostAds(req, res) {
  try {
    const { id } = req.params;
    const { ad_ids } = req.body;
    const db = getDb();

    const [postRows] = await db.query('SELECT id FROM blog_posts WHERE id = ?', [id]);
    if (postRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    await db.query('DELETE FROM blog_post_ads WHERE post_id = ?', [id]);

    const assignments = Array.isArray(ad_ids) ? ad_ids : [];
    if (assignments.length > 0) {
      const values = assignments.map((a, i) => [
        id,
        a.ad_id,
        a.display_order !== undefined ? a.display_order : i,
      ]);
      const placeholders = values.map(() => '(?, ?, ?)').join(', ');
      const flat = values.flat();
      await db.query(
        `INSERT INTO blog_post_ads (post_id, ad_id, display_order) VALUES ${placeholders}`,
        flat
      );
    }

    const [rows] = await db.query(
      `SELECT ba.id, ba.image_url, ba.redirect_url, ba.alt_text, ba.placement, bpa.display_order
       FROM blog_post_ads bpa
       JOIN blog_ads ba ON ba.id = bpa.ad_id
       WHERE bpa.post_id = ?
       ORDER BY ba.placement, bpa.display_order ASC`,
      [id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Set post ads error:', err);
    return res.status(500).json({ success: false, message: 'Failed to set post ads' });
  }
}

/**
 * Get ads assigned to a post
 * GET /v1/admin/blog/posts/:id/ads
 */
export async function getPostAds(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();

    const [rows] = await db.query(
      `SELECT ba.id, ba.image_url, ba.redirect_url, ba.alt_text, ba.placement, bpa.display_order
       FROM blog_post_ads bpa
       JOIN blog_ads ba ON ba.id = bpa.ad_id
       WHERE bpa.post_id = ?
       ORDER BY ba.placement, bpa.display_order ASC`,
      [id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Get post ads error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch post ads' });
  }
}
