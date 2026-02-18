import { Router } from 'express';
import { requireAdmin } from '../middleware/admin.middleware.js';
import {
  getAllAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
} from '../controllers/admin_blog.controller.js';
import {
  getAllAds,
  getAdById,
  createAd,
  updateAd,
  deleteAd,
  getPostAds,
  setPostAds,
} from '../controllers/admin_blog_ads.controller.js';

const router = Router();
router.use(requireAdmin);

// Ads (must be before /posts/:id to avoid conflict)
router.get('/ads', getAllAds);
router.get('/ads/:id', getAdById);
router.post('/ads', createAd);
router.put('/ads/:id', updateAd);
router.delete('/ads/:id', deleteAd);

// Authors
router.get('/authors', getAllAuthors);
router.get('/authors/:id', getAuthorById);
router.post('/authors', createAuthor);
router.put('/authors/:id', updateAuthor);
router.delete('/authors/:id', deleteAuthor);

// Categories
router.get('/categories', getAllCategories);
router.get('/categories/:id', getCategoryById);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Posts
router.get('/posts', getAllPosts);
router.get('/posts/:id', getPostById);
router.post('/posts', createPost);
router.put('/posts/:id', updatePost);
router.delete('/posts/:id', deletePost);
router.get('/posts/:id/ads', getPostAds);
router.put('/posts/:id/ads', setPostAds);

export default router;
