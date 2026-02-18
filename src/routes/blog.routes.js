import { Router } from 'express';
import {
  getAllPosts,
  getPostBySlug,
  getCategories,
  getCategoryBySlug,
  getRelatedPosts,
} from '../controllers/blog.controller.js';
import { getAdsByPost } from '../controllers/blog_ads.controller.js';

const router = Router();

// GET /v1/blog/posts - List published posts (paginated, filter by category)
router.get('/posts', getAllPosts);

// GET /v1/blog/posts/:slug/related - Related posts (must be before /:slug)
router.get('/posts/:slug/related', getRelatedPosts);

// GET /v1/blog/posts/:slugOrId/ads - Ads for post (slug or numeric id)
router.get('/posts/:slugOrId/ads', getAdsByPost);

// GET /v1/blog/posts/:slug - Single post by slug
router.get('/posts/:slug', getPostBySlug);

// GET /v1/blog/categories - List categories
router.get('/categories', getCategories);

// GET /v1/blog/categories/:slug - Category hub with posts
router.get('/categories/:slug', getCategoryBySlug);

export default router;
