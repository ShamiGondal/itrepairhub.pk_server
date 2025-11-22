import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/admin.middleware.js';
import {
  getAllProducts,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  addProductImage,
  updateProductImage,
  deleteProductImage,
} from '../controllers/product.controller.js';

const router = Router();

// Public endpoints - SEO-critical for product listings and detail pages
router.get('/', getAllProducts);
router.get('/:slug', getProductBySlug);

// Admin endpoints - require authentication and admin role
router.post('/', isAuth, isAdmin, createProduct);
router.put('/:id', isAuth, isAdmin, updateProduct);
router.delete('/:id', isAuth, isAdmin, deleteProduct);

// Product image management endpoints
router.post('/:product_id/images', isAuth, isAdmin, addProductImage);
router.put('/:product_id/images/:image_id', isAuth, isAdmin, updateProductImage);
router.delete('/:product_id/images/:image_id', isAuth, isAdmin, deleteProductImage);

export default router;

