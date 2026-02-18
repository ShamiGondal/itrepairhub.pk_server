import { getDb } from '../config/db.config.js';
import { slugify, generateUniqueSlug } from '../utils/slugify.js';

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

function stringifyJson(val) {
  if (val === null || val === undefined) return null;
  try {
    return typeof val === 'string' ? val : JSON.stringify(val);
  } catch {
    return null;
  }
}

// ============ AUTHORS ============

export async function getAllAuthors(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, full_name, title, bio, avatar_url, created_at, updated_at FROM blog_authors ORDER BY full_name ASC'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Get authors error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch authors' });
  }
}

export async function getAuthorById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, full_name, title, bio, avatar_url, created_at, updated_at FROM blog_authors WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Author not found' });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get author error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch author' });
  }
}

export async function createAuthor(req, res) {
  try {
    const { full_name, title, bio, avatar_url } = req.body;
    if (!full_name?.trim()) {
      return res.status(400).json({ success: false, message: 'full_name is required' });
    }
    const db = getDb();
    const [result] = await db.query(
      'INSERT INTO blog_authors (full_name, title, bio, avatar_url) VALUES (?, ?, ?, ?)',
      [full_name.trim(), title?.trim() || null, bio?.trim() || null, avatar_url?.trim() || null]
    );
    const [rows] = await db.query(
      'SELECT id, full_name, title, bio, avatar_url, created_at, updated_at FROM blog_authors WHERE id = ?',
      [result.insertId]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Create author error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create author' });
  }
}

export async function updateAuthor(req, res) {
  try {
    const { id } = req.params;
    const { full_name, title, bio, avatar_url } = req.body;
    const db = getDb();
    const [existing] = await db.query('SELECT id, full_name, title, bio, avatar_url FROM blog_authors WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Author not found' });
    }
    const e = existing[0];
    await db.query(
      'UPDATE blog_authors SET full_name = ?, title = ?, bio = ?, avatar_url = ? WHERE id = ?',
      [
        full_name !== undefined ? full_name.trim() : e.full_name,
        title !== undefined ? (title?.trim() || null) : e.title,
        bio !== undefined ? (bio?.trim() || null) : e.bio,
        avatar_url !== undefined ? (avatar_url?.trim() || null) : e.avatar_url,
        id,
      ]
    );
    const [rows] = await db.query(
      'SELECT id, full_name, title, bio, avatar_url, created_at, updated_at FROM blog_authors WHERE id = ?',
      [id]
    );
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Update author error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update author' });
  }
}

export async function deleteAuthor(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [existing] = await db.query('SELECT id FROM blog_authors WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Author not found' });
    }
    await db.query('UPDATE blog_posts SET author_id = NULL WHERE author_id = ?', [id]);
    await db.query('DELETE FROM blog_authors WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Author deleted' });
  } catch (err) {
    console.error('Delete author error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete author' });
  }
}

// ============ CATEGORIES ============

export async function getAllCategories(req, res) {
  try {
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, name, slug, description, meta_title, meta_description, link_target, display_order, is_active, created_at, updated_at FROM blog_categories ORDER BY display_order ASC, name ASC'
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Get categories error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
}

export async function getCategoryById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [rows] = await db.query(
      'SELECT id, name, slug, description, meta_title, meta_description, link_target, display_order, is_active, created_at, updated_at FROM blog_categories WHERE id = ? LIMIT 1',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Get category error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch category' });
  }
}

export async function createCategory(req, res) {
  try {
    const { name, slug, description, meta_title, meta_description, link_target, display_order, is_active } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    const db = getDb();
    const baseSlug = slug?.trim() || slugify(name);
    const checkSlugExists = async (s) => {
      const [ex] = await db.query('SELECT id FROM blog_categories WHERE slug = ?', [s]);
      return ex.length > 0;
    };
    const finalSlug = await generateUniqueSlug(baseSlug, checkSlugExists);

    const [result] = await db.query(
      `INSERT INTO blog_categories (name, slug, description, meta_title, meta_description, link_target, display_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        finalSlug,
        description?.trim() || null,
        meta_title?.trim() || null,
        meta_description?.trim() || null,
        link_target?.trim() || null,
        display_order !== undefined ? parseInt(display_order) : 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );
    const [rows] = await db.query(
      'SELECT id, name, slug, description, meta_title, meta_description, link_target, display_order, is_active, created_at, updated_at FROM blog_categories WHERE id = ?',
      [result.insertId]
    );
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Create category error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create category' });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, slug, description, meta_title, meta_description, link_target, display_order, is_active } = req.body;
    const db = getDb();
    const [existing] = await db.query('SELECT id, slug FROM blog_categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    let finalSlug = existing[0].slug;
    if (slug !== undefined || name !== undefined) {
      const baseSlug = slug?.trim() || (name ? slugify(name) : existing[0].slug);
      const checkSlugExists = async (s) => {
        const [ex] = await db.query('SELECT id FROM blog_categories WHERE slug = ? AND id != ?', [s, id]);
        return ex.length > 0;
      };
      finalSlug = await generateUniqueSlug(baseSlug, checkSlugExists);
    }

    await db.query(
      `UPDATE blog_categories SET
        name = COALESCE(?, name),
        slug = ?,
        description = COALESCE(?, description),
        meta_title = COALESCE(?, meta_title),
        meta_description = COALESCE(?, meta_description),
        link_target = COALESCE(?, link_target),
        display_order = COALESCE(?, display_order),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        name !== undefined ? name.trim() : null,
        finalSlug,
        description !== undefined ? (description?.trim() || null) : null,
        meta_title !== undefined ? (meta_title?.trim() || null) : null,
        meta_description !== undefined ? (meta_description?.trim() || null) : null,
        link_target !== undefined ? (link_target?.trim() || null) : null,
        display_order !== undefined ? parseInt(display_order) : null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id,
      ]
    );
    const [rows] = await db.query(
      'SELECT id, name, slug, description, meta_title, meta_description, link_target, display_order, is_active, created_at, updated_at FROM blog_categories WHERE id = ?',
      [id]
    );
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('Update category error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update category' });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [existing] = await db.query('SELECT id FROM blog_categories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    await db.query('UPDATE blog_posts SET category_id = NULL WHERE category_id = ?', [id]);
    await db.query('DELETE FROM blog_categories WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Category deleted' });
  } catch (err) {
    console.error('Delete category error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
}

// ============ POSTS ============

export async function getAllPosts(req, res) {
  try {
    const { category_id, is_published, page = 1, limit = 20, search } = req.query;
    const db = getDb();

    const conditions = [];
    const values = [];
    if (category_id) {
      conditions.push('bp.category_id = ?');
      values.push(category_id);
    }
    if (is_published !== undefined) {
      conditions.push('bp.is_published = ?');
      values.push(is_published === 'true' || is_published === '1' ? 1 : 0);
    }
    if (search) {
      conditions.push('(bp.title LIKE ? OR bp.excerpt LIKE ?)');
      const p = `%${search}%`;
      values.push(p, p);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const [rows] = await db.query(
      `SELECT bp.id, bp.category_id, bp.author_id, bp.title, bp.slug, bp.excerpt, bp.featured_image_url,
              bp.published_at, bp.is_published, bp.created_at,
              bc.name as category_name, bc.slug as category_slug,
              ba.full_name as author_name
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       ${whereClause}
       ORDER BY bp.published_at DESC, bp.created_at DESC
       LIMIT ? OFFSET ?`,
      [...values, limitNum, offset]
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM blog_posts bp ${whereClause}`,
      values
    );
    const total = countRows[0]?.total ?? 0;

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error('Get admin posts error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
}

export async function getPostById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [rows] = await db.query(
      `SELECT bp.*, bc.name as category_name, bc.slug as category_slug, ba.full_name as author_name
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       WHERE bp.id = ? LIMIT 1`,
      [id]
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
    console.error('Get post error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch post' });
  }
}

export async function createPost(req, res) {
  try {
    const {
      category_id,
      author_id,
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      featured_image_alt,
      meta_title,
      meta_description,
      published_at,
      last_updated_at,
      is_published,
      related_product_ids,
      related_service_ids,
      faq_schema,
      link_target,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ success: false, message: 'title is required' });
    }

    const db = getDb();
    const baseSlug = slug?.trim() || slugify(title);
    const checkSlugExists = async (s) => {
      const [ex] = await db.query('SELECT id FROM blog_posts WHERE slug = ?', [s]);
      return ex.length > 0;
    };
    const finalSlug = await generateUniqueSlug(baseSlug, checkSlugExists);

    const [result] = await db.query(
      `INSERT INTO blog_posts (
        category_id, author_id, title, slug, excerpt, content,
        featured_image_url, featured_image_alt, meta_title, meta_description,
        published_at, last_updated_at, is_published,
        related_product_ids, related_service_ids, faq_schema, link_target
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category_id || null,
        author_id || null,
        title.trim(),
        finalSlug,
        excerpt?.trim() || null,
        content?.trim() || null,
        featured_image_url?.trim() || null,
        featured_image_alt?.trim() || null,
        meta_title?.trim() || null,
        meta_description?.trim() || null,
        published_at || null,
        last_updated_at || null,
        is_published ? 1 : 0,
        stringifyJson(related_product_ids),
        stringifyJson(related_service_ids),
        stringifyJson(faq_schema),
        link_target?.trim() || null,
      ]
    );

    const [rows] = await db.query(
      `SELECT bp.*, bc.name as category_name, bc.slug as category_slug, ba.full_name as author_name
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       WHERE bp.id = ?`,
      [result.insertId]
    );
    const post = rows[0];
    post.related_product_ids = parseJsonField(post.related_product_ids);
    post.related_service_ids = parseJsonField(post.related_service_ids);
    post.faq_schema = parseJsonField(post.faq_schema);
    return res.status(201).json({ success: true, data: post });
  } catch (err) {
    console.error('Create post error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create post' });
  }
}

export async function updatePost(req, res) {
  try {
    const { id } = req.params;
    const {
      category_id,
      author_id,
      title,
      slug,
      excerpt,
      content,
      featured_image_url,
      featured_image_alt,
      meta_title,
      meta_description,
      published_at,
      last_updated_at,
      is_published,
      related_product_ids,
      related_service_ids,
      faq_schema,
      link_target,
    } = req.body;

    const db = getDb();
    const [existing] = await db.query('SELECT id, slug FROM blog_posts WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    let finalSlug = existing[0].slug;
    if (slug !== undefined || title !== undefined) {
      const baseSlug = slug?.trim() || (title ? slugify(title) : existing[0].slug);
      const checkSlugExists = async (s) => {
        const [ex] = await db.query('SELECT id FROM blog_posts WHERE slug = ? AND id != ?', [s, id]);
        return ex.length > 0;
      };
      finalSlug = await generateUniqueSlug(baseSlug, checkSlugExists);
    }

    await db.query(
      `UPDATE blog_posts SET
        category_id = COALESCE(?, category_id),
        author_id = COALESCE(?, author_id),
        title = COALESCE(?, title),
        slug = ?,
        excerpt = COALESCE(?, excerpt),
        content = COALESCE(?, content),
        featured_image_url = COALESCE(?, featured_image_url),
        featured_image_alt = COALESCE(?, featured_image_alt),
        meta_title = COALESCE(?, meta_title),
        meta_description = COALESCE(?, meta_description),
        published_at = COALESCE(?, published_at),
        last_updated_at = COALESCE(?, last_updated_at),
        is_published = COALESCE(?, is_published),
        related_product_ids = COALESCE(?, related_product_ids),
        related_service_ids = COALESCE(?, related_service_ids),
        faq_schema = COALESCE(?, faq_schema),
        link_target = COALESCE(?, link_target)
       WHERE id = ?`,
      [
        category_id !== undefined ? category_id || null : null,
        author_id !== undefined ? author_id || null : null,
        title !== undefined ? title.trim() : null,
        finalSlug,
        excerpt !== undefined ? (excerpt?.trim() || null) : null,
        content !== undefined ? (content?.trim() || null) : null,
        featured_image_url !== undefined ? (featured_image_url?.trim() || null) : null,
        featured_image_alt !== undefined ? (featured_image_alt?.trim() || null) : null,
        meta_title !== undefined ? (meta_title?.trim() || null) : null,
        meta_description !== undefined ? (meta_description?.trim() || null) : null,
        published_at !== undefined ? published_at : null,
        last_updated_at !== undefined ? last_updated_at : null,
        is_published !== undefined ? (is_published ? 1 : 0) : null,
        related_product_ids !== undefined ? stringifyJson(related_product_ids) : null,
        related_service_ids !== undefined ? stringifyJson(related_service_ids) : null,
        faq_schema !== undefined ? stringifyJson(faq_schema) : null,
        link_target !== undefined ? (link_target?.trim() || null) : null,
        id,
      ]
    );

    const [rows] = await db.query(
      `SELECT bp.*, bc.name as category_name, bc.slug as category_slug, ba.full_name as author_name
       FROM blog_posts bp
       LEFT JOIN blog_categories bc ON bp.category_id = bc.id
       LEFT JOIN blog_authors ba ON bp.author_id = ba.id
       WHERE bp.id = ?`,
      [id]
    );
    const post = rows[0];
    post.related_product_ids = parseJsonField(post.related_product_ids);
    post.related_service_ids = parseJsonField(post.related_service_ids);
    post.faq_schema = parseJsonField(post.faq_schema);
    return res.status(200).json({ success: true, data: post });
  } catch (err) {
    console.error('Update post error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update post' });
  }
}

export async function deletePost(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const [existing] = await db.query('SELECT id FROM blog_posts WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    await db.query('DELETE FROM blog_posts WHERE id = ?', [id]);
    return res.status(200).json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
}
