import { getDb } from '../config/db.config.js';

/**
 * Get ads for a blog post by slug or post ID
 * GET /v1/blog/posts/:slugOrId/ads
 */
export async function getAdsByPost(req, res) {
  try {
    const { slugOrId } = req.params;
    const db = getDb();

    let postId = null;
    if (/^\d+$/.test(slugOrId)) {
      postId = parseInt(slugOrId);
    } else {
      const [postRows] = await db.query(
        'SELECT id FROM blog_posts WHERE slug = ? AND is_published = 1 LIMIT 1',
        [slugOrId]
      );
      if (postRows.length === 0) {
        return res.status(404).json({ success: false, message: 'Post not found', data: null });
      }
      postId = postRows[0].id;
    }

    const [rows] = await db.query(
      `SELECT ba.id, ba.image_url, ba.redirect_url, ba.alt_text, ba.placement, bpa.display_order
       FROM blog_post_ads bpa
       JOIN blog_ads ba ON ba.id = bpa.ad_id AND ba.is_active = 1
       WHERE bpa.post_id = ?
       ORDER BY ba.placement, bpa.display_order ASC`,
      [postId]
    );

    const grouped = {
      sidebar: [],
      in_content_top: [],
      in_content_mid: [],
      in_content_bottom: [],
    };

    rows.forEach((row) => {
      const ad = {
        id: row.id,
        image_url: row.image_url,
        redirect_url: row.redirect_url,
        alt_text: row.alt_text,
        placement: row.placement,
      };
      if (grouped[row.placement] && Array.isArray(grouped[row.placement])) {
        grouped[row.placement].push(ad);
      }
    });

    return res.status(200).json({ success: true, data: grouped });
  } catch (err) {
    console.error('Get blog post ads error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch ads', data: null });
  }
}
