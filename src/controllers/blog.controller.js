import { getDb } from '../config/db.config.js';

/**
 * Parse JSON fields safely
 */
function parseJsonField(val) {
  if (!val) return null;
  try {
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch {
    return null;
  }
}

/**
 * List published blog posts (paginated, filter by category)
 * GET /v1/blog/posts
 */
export async function getAllPosts(req, res) {
  try {
    const { category_id, category_slug, page = 1, limit = 12 } = req.query;
    const db = getDb();

    const conditions = ['bp.is_published = 1'];
    const values = [];

    if (category_id) {
      conditions.push('bp.category_id = ?');
      values.push(category_id);
    }
    if (category_slug) {
      conditions.push('bc.slug = ?');
      values.push(category_slug);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await db.query(
      `SELECT 
        bp.id, bp.category_id, bp.author_id, bp.title, bp.slug, bp.excerpt,
        bp.featured_image_url, bp.featured_image_alt, bp.published_at, bp.last_updated_at,
        bc.name as category_name, bc.slug as category_slug,
        ba.full_name as author_name, ba.title as author_title, ba.avatar_url as author_avatar
      FROM blog_posts bp
      LEFT JOIN blog_categories bc ON bp.category_id = bc.id
      LEFT JOIN blog_authors ba ON bp.author_id = ba.id
      ${whereClause}
      ORDER BY bp.published_at DESC
      LIMIT ? OFFSET ?`,
      [...values, limitNum, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       ${whereClause}`,
      values
    );
    const total = countRows[0]?.total ?? 0;

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('Get blog posts error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
}

/**
 * Get single post by slug
 * GET /v1/blog/posts/:slug
 */
export async function getPostBySlug(req, res) {
  try {
    const { slug } = req.params;
    const db = getDb();

    const [rows] = await db.query(
      `SELECT 
        bp.*,
        bc.name as category_name, bc.slug as category_slug, bc.link_target as category_link_target,
        ba.full_name as author_name, ba.title as author_title, ba.bio as author_bio, ba.avatar_url as author_avatar
      FROM blog_posts bp
      LEFT JOIN blog_categories bc ON bp.category_id = bc.id
      LEFT JOIN blog_authors ba ON bp.author_id = ba.id
      WHERE bp.slug = ? AND bp.is_published = 1
      LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const post = rows[0];
    post.related_product_ids = parseJsonField(post.related_product_ids);
    post.related_service_ids = parseJsonField(post.related_service_ids);
    post.faq_schema = parseJsonField(post.faq_schema);

    return res.status(200).json({ success: true, data: post });
  } catch (err) {
    console.error('Get blog post error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
}

/**
 * List blog categories
 * GET /v1/blog/categories
 */
export async function getCategories(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      `SELECT id, name, slug, description, meta_title, meta_description, link_target, display_order
       FROM blog_categories
       WHERE is_active = 1
       ORDER BY display_order ASC, name ASC`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Get blog categories error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
}

/**
 * Get category by slug with posts (hub page)
 * GET /v1/blog/categories/:slug
 */
export async function getCategoryBySlug(req, res) {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 12 } = req.query;
    const db = getDb();

    const [catRows] = await db.query(
      `SELECT id, name, slug, description, meta_title, meta_description, link_target
       FROM blog_categories WHERE slug = ? AND is_active = 1 LIMIT 1`,
      [slug]
    );

    if (catRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const category = catRows[0];
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const offset = (pageNum - 1) * limitNum;

    const [postRows] = await db.query(
      `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image_url, bp.featured_image_alt,
              bp.published_at, ba.full_name as author_name
       FROM blog_posts bp
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       WHERE bp.category_id = ? AND bp.is_published = 1
       ORDER BY bp.published_at DESC
       LIMIT ? OFFSET ?`,
      [category.id, limitNum, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM blog_posts WHERE category_id = ? AND is_published = 1`,
      [category.id]
    );
    const total = countRows[0]?.total ?? 0;

    return res.status(200).json({
      success: true,
      data: {
        ...category,
        posts: postRows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    console.error('Get blog category error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch category' });
  }
}

/**
 * Get related posts (same category/silo)
 * GET /v1/blog/posts/:slug/related
 */
export async function getRelatedPosts(req, res) {
  try {
    const { slug } = req.params;
    const limit = Math.min(10, parseInt(req.query.limit) || 3);
    const db = getDb();

    const [postRows] = await db.query(
      `SELECT id, category_id, slug FROM blog_posts WHERE slug = ? AND is_published = 1 LIMIT 1`,
      [slug]
    );

    if (postRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const { id: postId, category_id } = postRows[0];
    if (!category_id) {
      return res.status(200).json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image_url, bp.featured_image_alt, bp.published_at
       FROM blog_posts bp
       WHERE bp.category_id = ? AND bp.id != ? AND bp.is_published = 1
       ORDER BY bp.published_at DESC
       LIMIT ?`,
      [category_id, postId, limit]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Get related posts error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch related posts' });
  }
}
