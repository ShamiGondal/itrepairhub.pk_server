import { Router } from 'express';
import { isAuth } from '../middleware/auth.middleware.js';
import { isAdmin } from '../middleware/admin.middleware.js';
import {
  validatePromoCode,
  getAllPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from '../controllers/promoCode.controller.js';

const router = Router();

// Public endpoint - validate promo code
router.get('/validate', validatePromoCode);

// Admin endpoints - require authentication and admin role
router.get('/', isAuth, isAdmin, getAllPromoCodes);
router.post('/', isAuth, isAdmin, createPromoCode);
router.put('/:id', isAuth, isAdmin, updatePromoCode);
router.delete('/:id', isAuth, isAdmin, deletePromoCode);

export default router;

