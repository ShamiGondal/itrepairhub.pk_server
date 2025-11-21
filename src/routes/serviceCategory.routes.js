import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/admin.middleware.js';
import {
  getAllCategories,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/serviceCategory.controller.js';

const router = Router();

// Public endpoints - SEO-critical for navigation and listings
router.get('/', getAllCategories);
router.get('/:slug', getCategoryBySlug);

// Admin endpoints - require authentication and admin role
router.post('/', isAuth, isAdmin, createCategory);
router.put('/:id', isAuth, isAdmin, updateCategory);
router.delete('/:id', isAuth, isAdmin, deleteCategory);

export default router;

